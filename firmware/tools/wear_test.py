"""Worn-sleeve check: confirms the ESP32 streams data, buzzes both motors at 75%, and that each IMU responds when
its body part moves. Works with the sleeve on (no table needed). Needs the sleeve firmware (firmware/src) and pyserial.

Run from the repo root:  ~/.local/share/pipx/venvs/platformio/bin/python firmware/tools/wear_test.py
"""
import argparse
import math
import time

import serial

IMUS = ["upper arm", "forearm", "chest"]  # D-line order
MOTORS = [(1, "chest"), (3, "upper arm")]
MOVE_DEG = 25   # an IMU passes once it has turned this far from where it started
MOVE_SECS = 8   # time allowed for each movement
MOVES = [(2, "LEAN your trunk forward and back"), (0, "RAISE your arm forward"), (1, "BEND your elbow / twist your wrist")]


class Sleeve:
    """Line-based connection to the sleeve."""

    def __init__(self, port, baud):
        """Open the port and wait until the board is streaming (opening it on Linux restarts the ESP32)."""
        self.s = serial.Serial()
        self.s.port, self.s.baudrate, self.s.timeout = port, baud, 0.05
        self.s.dtr = self.s.rts = False
        self.s.open()
        self.buf = b""
        self.settle()

    def settle(self):
        """Return once S,READY arrives (board restarted) or D lines have flowed for 1 s (it didn't)."""
        streaming_since = None
        for line in self.lines(5.0):
            if line == "S,READY":
                return
            if line.startswith("D,"):
                streaming_since = streaming_since or time.time()
                if time.time() - streaming_since > 1.0:
                    return
            else:
                streaming_since = None

    def send(self, line):
        """Send one command line."""
        self.s.write((line + "\n").encode())

    def lines(self, secs):
        """Yield complete lines received during the next `secs` seconds."""
        end = time.time() + secs
        while time.time() < end:
            self.buf += self.s.read(4096)
            *done, self.buf = self.buf.split(b"\n")
            for raw in done:
                yield raw.decode(errors="replace").strip()

    def wait_status(self, wanted, secs):
        """Return the first S, line in `wanted` within `secs`, or None."""
        for line in self.lines(secs):
            if line in wanted:
                return line
        return None


def parse_d(line):
    """Three (w, x, y, z) quaternions from a D line, or None if malformed."""
    p = line.split(",")
    if p[0] != "D" or len(p) != 14:
        return None
    try:
        v = [float(x) for x in p[2:]]
    except ValueError:
        return None
    return [v[0:4], v[4:8], v[8:12]]


def turned_deg(q0, q1):
    """Rotation angle in degrees between two unit quaternions."""
    d = abs(sum(a * b for a, b in zip(q0, q1)))
    return math.degrees(2 * math.acos(min(1.0, d)))


def check_stream(sl):
    """Measure line rate and malformed lines over 2 s; True if healthy."""
    good = bad = 0
    norms = []
    for line in sl.lines(2.0):
        if line.startswith("D,"):
            q = parse_d(line)
            if q:
                good += 1
                norms += [math.sqrt(sum(c * c for c in qi)) for qi in q]
            else:
                bad += 1
        elif line.startswith("S,IMU_FAIL"):
            print(f"  !! {line}: IMU {IMUS[int(line.split(',')[2]) - 1]} failed at boot")
    rate = good / 2.0
    ok = rate > 80 and bad == 0 and norms and max(abs(n - 1) for n in norms) < 0.01
    print(f"  {rate:.0f} lines/s, {bad} malformed, quaternion length {min(norms or [0]):.4f}–{max(norms or [0]):.4f}"
          f"  -> {'PASS' if ok else 'FAIL'}")
    return ok


def main():
    """Run the four checks and print a summary."""
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--port", default="/dev/ttyUSB0")
    ap.add_argument("--baud", type=int, default=921600)
    ap.add_argument("--strength", type=int, default=75, help="motor strength in percent")
    args = ap.parse_args()
    sl = Sleeve(args.port, args.baud)
    results = {}

    print("\n1) Talking to the ESP32")
    sl.send("P")
    results["ping"] = sl.wait_status({"S,PONG"}, 1.5) is not None
    print(f"  ping -> {'PASS (S,PONG)' if results['ping'] else 'FAIL (no reply: wrong port, or old firmware?)'}")
    results["stream"] = check_stream(sl)

    print("\n2) Gyro zero: SIT STILL for 3 seconds...")
    time.sleep(1)
    for attempt in (1, 2):
        sl.send("G")
        reply = sl.wait_status({"S,ZERO_OK", "S,ZERO_MOVED"}, 4)
        print(f"  {reply or 'no reply'}")
        if reply == "S,ZERO_OK":
            break
        if attempt == 1:
            print("  Moved; trying once more. Stay still...")
    results["zero"] = reply == "S,ZERO_OK"

    print(f"\n3) Motors at {args.strength}%")
    for motor, where in MOTORS:
        print(f"  Buzzing motor {motor} ({where}) for 1.5 s...")
        sl.send(f"V,{motor},3,{args.strength}")
        alive = sum(1 for line in sl.lines(1.5) if line.startswith("D,"))
        sl.send(f"V,{motor},0")
        print(f"    data kept flowing during the buzz: {alive} lines")
        list(sl.lines(0.5))
    print("  -> Did you feel the chest motor, then the upper-arm motor? (tell Claude)")

    print("\n4) IMUs respond to movement")
    for imu, prompt in MOVES:
        print(f"  {IMUS[imu].upper()}: {prompt} (within {MOVE_SECS} s)...")
        start, peak = None, 0.0
        for line in sl.lines(MOVE_SECS):
            q = parse_d(line)
            if not q:
                continue
            start = start or q[imu]
            peak = max(peak, turned_deg(start, q[imu]))
            if peak >= MOVE_DEG:
                break
        results[IMUS[imu]] = peak >= MOVE_DEG
        print(f"    turned {peak:.0f} deg -> {'PASS' if results[IMUS[imu]] else 'FAIL (no movement seen: check this IMU wire)'}")
        list(sl.lines(1.0))

    print("\n===== Summary =====")
    for name, ok in results.items():
        print(f"  {name:10s} {'PASS' if ok else 'FAIL'}")
    print("  motors     (confirm by feel)")
    print("\nNote: the zero here measured gyro bias only. Before real use, run Zero sensors with the sleeve flat (docs/sleeve.md).")


if __name__ == "__main__":
    main()
