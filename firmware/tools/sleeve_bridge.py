"""Sleeve bridge: reads the ESP32 over USB serial and serves its lines to the web app over HTTP on localhost.

Chrome's Web Serial reported "device lost" on every read on our Linux laptop while pyserial read the same port
fine, so the app talks to this bridge instead (web/src/lib/serial.ts BridgeLineSource):
  GET  /stream  Server-Sent Events, one event per D,/S, line
  POST /cmd     body = one command line (G, P, V,<motor>,<pattern>[,<percent>])

Run (keep it open during the session):
  ~/.local/share/pipx/venvs/platformio/bin/python ~/Workspace/motus/firmware/tools/sleeve_bridge.py
"""
import argparse
import queue
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import serial

clients = set()           # one queue per connected browser
clients_lock = threading.Lock()
port_lock = threading.Lock()
ser = None                # the open serial port, or None while (re)connecting


def broadcast(line):
    """Hand one line to every connected browser, dropping it for any that has fallen far behind."""
    with clients_lock:
        for q in clients:
            if q.qsize() < 2000:
                q.put(line)


def serial_loop(port, baud):
    """Keep the serial port open, reconnecting after unplugs, and broadcast every line it sends."""
    global ser
    while True:
        try:
            s = serial.Serial()
            s.port, s.baudrate, s.timeout = port, baud, 0.1
            s.dtr = s.rts = False  # released: on ESP32 boards these lines drive reset and boot mode
            s.open()
            with port_lock:
                ser = s
            print(f"Connected to {port} at {baud} baud", flush=True)
            buf = b""
            while True:
                buf += s.read(4096)
                *lines, buf = buf.split(b"\n")
                for raw in lines:
                    line = raw.decode(errors="replace").strip()
                    if line:
                        broadcast(line)
        except (serial.SerialException, OSError) as e:
            with port_lock:
                ser = None
            print(f"Serial unavailable ({e}); retrying in 1 s", flush=True)
            time.sleep(1)


class Handler(BaseHTTPRequestHandler):
    """Serves /stream (SSE) and /cmd (POST) with CORS open to the local dev server."""

    def _cors(self):
        """Allow the Vite dev server (another localhost port) to call the bridge."""
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self):
        """CORS preflight."""
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        """Stream every sleeve line as one SSE event until the browser disconnects."""
        if self.path != "/stream":
            self.send_response(404)
            self.end_headers()
            return
        self.send_response(200)
        self._cors()
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        q = queue.Queue()
        with clients_lock:
            clients.add(q)
        try:
            while True:
                try:
                    out = [f"data: {q.get(timeout=5)}\n\n"]
                    while not q.empty() and len(out) < 50:
                        out.append(f"data: {q.get_nowait()}\n\n")
                    self.wfile.write("".join(out).encode())
                except queue.Empty:
                    self.wfile.write(b": keep-alive\n\n")
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError):
            pass
        finally:
            with clients_lock:
                clients.discard(q)

    def do_POST(self):
        """Write one command line to the sleeve."""
        if self.path != "/cmd":
            self.send_response(404)
            self.end_headers()
            return
        line = self.rfile.read(int(self.headers.get("Content-Length", 0))).decode().strip()
        with port_lock:
            ok = ser is not None
            if ok:
                ser.write((line + "\n").encode())
        self.send_response(204 if ok else 503)
        self._cors()
        self.end_headers()

    def log_message(self, *args):
        """Silence per-request logging (the stream would flood the terminal)."""


def main():
    """Start the serial reader thread and the HTTP server."""
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--port", default="/dev/ttyUSB0")
    ap.add_argument("--baud", type=int, default=921600)
    ap.add_argument("--http-port", type=int, default=8765)
    args = ap.parse_args()
    threading.Thread(target=serial_loop, args=(args.port, args.baud), daemon=True).start()
    print(f"Sleeve bridge on http://localhost:{args.http_port}/stream (Ctrl+C to stop)", flush=True)
    ThreadingHTTPServer(("127.0.0.1", args.http_port), Handler).serve_forever()


if __name__ == "__main__":
    main()
