// Sleeve link (S1): reads the ESP32's `D,` / `S,` lines and writes `V` / `G` / `P` commands (PLAN.md §16).
// The real port (Web Serial, Chrome) and the fake sleeve (fakeSensor.ts) share the LineSource interface,
// so the same parser and app code run with or without hardware.
import type { Quat, SensorFrame } from './types';

/** Anything that produces text lines and accepts command lines: the USB port or the fake sleeve. */
export interface LineSource {
  start(onLine: (line: string) => void, onClose: () => void): Promise<void>;
  write(line: string): Promise<void>;
  stop(): Promise<void>;
}

export type SleeveStatus = 'ready' | 'pong' | 'zero_ok' | 'zero_moved' | `imu_fail_${1 | 2 | 3}` | `imu_ok_${1 | 2 | 3}`;

export type ParsedLine =
  | { kind: 'frame'; frame: SensorFrame; deviceMs: number }
  | { kind: 'status'; status: SleeveStatus }
  | null;

/** IMU numbers in `S,IMU_FAIL,<n>` / `S,IMU_OK,<n>` follow the D-line order. */
export const IMU_NAMES = { 1: 'upper arm', 2: 'forearm', 3: 'chest' } as const;

/** Motor IDs in `V,<motor>,<pattern>`, as wired (hw-notes/B1-as-wired.md). ID 2 has no motor. */
export const MOTOR = { chest: 1, upperArm: 3 } as const;

/** Patterns in `V,<motor>,<pattern>` (PLAN.md §16). */
export const PATTERN = { off: 0, pulse: 1, doublePulse: 2, on: 3 } as const;

/** Parse one line from the sleeve; null for anything malformed (dropped, never thrown). */
export function parseLine(line: string, now: number = performance.now()): ParsedLine {
  const p = line.trim().split(',');
  if (p[0] === 'D' && p.length === 14) {
    const n = p.slice(1).map(Number);
    if (n.some((v) => !Number.isFinite(v))) return null;
    const q = (i: number): Quat => [n[i], n[i + 1], n[i + 2], n[i + 3]];
    return { kind: 'frame', deviceMs: n[0], frame: { t: now, upper: q(1), fore: q(5), chest: q(9) } };
  }
  if (p[0] !== 'S') return null;
  if (p[1] === 'READY') return { kind: 'status', status: 'ready' };
  if (p[1] === 'PONG') return { kind: 'status', status: 'pong' };
  if (p[1] === 'ZERO_OK') return { kind: 'status', status: 'zero_ok' };
  if (p[1] === 'ZERO_MOVED') return { kind: 'status', status: 'zero_moved' };
  if (p[1] === 'IMU_FAIL' && ['1', '2', '3'].includes(p[2])) return { kind: 'status', status: `imu_fail_${Number(p[2]) as 1 | 2 | 3}` };
  if (p[1] === 'IMU_OK' && ['1', '2', '3'].includes(p[2])) return { kind: 'status', status: `imu_ok_${Number(p[2]) as 1 | 2 | 3}` };
  return null;
}

// Minimal Web Serial types: the API is Chrome-only and not in TypeScript's DOM lib.
interface WebSerialPort {
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  setSignals(signals: { dataTerminalReady?: boolean; requestToSend?: boolean }): Promise<void>;
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
}
interface WebSerial {
  requestPort(options?: { filters?: { usbVendorId: number }[] }): Promise<WebSerialPort>;
}

/** The browser's Web Serial API, or undefined outside Chrome/Edge. */
function webSerial(): WebSerial | undefined {
  return (navigator as Navigator & { serial?: WebSerial }).serial;
}

/** True when this browser can talk to the sleeve over USB. */
export function serialSupported(): boolean {
  return webSerial() !== undefined;
}

// USB-serial chips on common ESP32 boards: CP210x (ours) and CH340.
const USB_VENDOR_IDS = [0x10c4, 0x1a86];
// PLAN.md §16: 921600 baud; 115200 is the fallback if lines get corrupted.
export const DEFAULT_BAUD = 921600;

/** USB serial port as a LineSource. Must be created from a click handler (Chrome asks the user to pick the port). */
export class SerialLineSource implements LineSource {
  private port: WebSerialPort | null = null;
  private reader: ReadableStreamDefaultReader<string> | null = null;
  private readonly encoder = new TextEncoder();

  constructor(private readonly baud: number = DEFAULT_BAUD) {}

  /** Ask the user for the port, open it, and read lines until it closes. */
  async start(onLine: (line: string) => void, onClose: () => void): Promise<void> {
    const serial = webSerial();
    if (!serial) throw new Error('Web Serial is not available in this browser (use Chrome).');
    this.port = await serial.requestPort({ filters: USB_VENDOR_IDS.map((usbVendorId) => ({ usbVendorId })) });
    await this.port.open({ baudRate: this.baud });
    try {
      // ESP32 boards wire DTR/RTS to their reset (EN) and boot (IO0) pins: with RTS asserted and DTR not, the board
      // is held in reset and sends nothing, so the app shows the sleeve as "stale". Release both so the firmware runs.
      await this.port.setSignals({ dataTerminalReady: false, requestToSend: false });
    } catch (e) {
      await this.stop();  // never leave the port open after a failed start: it would block the next attempt
      throw e;
    }
    this.reader = this.port.readable!.pipeThrough(new TextDecoderStream()).getReader();
    void this.readLoop(onLine, onClose);
  }

  /** Split the incoming text into lines and hand each one over. */
  private async readLoop(onLine: (line: string) => void, onClose: () => void): Promise<void> {
    let buf = '';
    try {
      for (;;) {
        const { value, done } = await this.reader!.read();
        if (done) break;
        buf += value;
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        lines.forEach(onLine);
      }
    } catch (e) {
      console.warn('Sleeve read stopped:', e);  // unplugged or closed: fall through to onClose
    }
    onClose();
  }

  /** Send one command line. */
  async write(line: string): Promise<void> {
    const writer = this.port?.writable?.getWriter();
    if (!writer) return;
    try {
      await writer.write(this.encoder.encode(`${line}\n`));
    } finally {
      writer.releaseLock();
    }
  }

  /** Stop reading and close the port. */
  async stop(): Promise<void> {
    await this.reader?.cancel().catch(() => undefined);
    await this.port?.close().catch(() => undefined);
    this.reader = null;
    this.port = null;
  }
}

/** One sleeve connection: parses lines into frames and statuses, and sends commands. */
export class SleeveLink {
  /** Raw lines received, and how many of them were valid frames (for diagnosing "no data"). */
  readonly stats = { lines: 0, frames: 0 };
  private frameFns = new Set<(f: SensorFrame) => void>();
  private statusFns = new Set<(s: SleeveStatus) => void>();
  private closeFns = new Set<() => void>();

  constructor(private readonly source: LineSource) {}

  /** Start the source; frames and statuses flow to the subscribers from here on. */
  async connect(): Promise<void> {
    await this.source.start(
      (line) => {
        this.stats.lines++;
        const parsed = parseLine(line);
        if (parsed?.kind === 'frame') this.stats.frames++;
        if (parsed?.kind === 'frame') this.frameFns.forEach((fn) => fn(parsed.frame));
        else if (parsed?.kind === 'status') this.statusFns.forEach((fn) => fn(parsed.status));
      },
      () => this.closeFns.forEach((fn) => fn()),
    );
  }

  /** Subscribe to sensor frames (e.g. arm/armInput's pushSensorFrame); returns the unsubscribe function. */
  onFrame(fn: (f: SensorFrame) => void): () => void {
    this.frameFns.add(fn);
    return () => this.frameFns.delete(fn);
  }

  /** Subscribe to status lines; returns the unsubscribe function. */
  onStatus(fn: (s: SleeveStatus) => void): () => void {
    this.statusFns.add(fn);
    return () => this.statusFns.delete(fn);
  }

  /** Subscribe to the connection closing (unplugged or stopped); returns the unsubscribe function. */
  onClose(fn: () => void): () => void {
    this.closeFns.add(fn);
    return () => this.closeFns.delete(fn);
  }

  /** Play a motor pattern (PATTERN) on one motor (MOTOR). */
  buzz(motor: number, pattern: number): Promise<void> {
    return this.source.write(`V,${motor},${pattern}`);
  }

  /** `G`: re-zero the gyros with the sleeve flat and still, X arrows aligned. Resolves 'ok' or 'moved'. */
  zero(timeoutMs = 4000): Promise<'ok' | 'moved' | 'timeout'> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => done('timeout'), timeoutMs);
      const off = this.onStatus((s) => {
        if (s === 'zero_ok') done('ok');
        else if (s === 'zero_moved') done('moved');
      });
      const done = (r: 'ok' | 'moved' | 'timeout') => {
        clearTimeout(timer);
        off();
        resolve(r);
      };
      void this.source.write('G');
    });
  }

  /** `P`: resolves true if the sleeve answers S,PONG in time. */
  ping(timeoutMs = 1000): Promise<boolean> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => { off(); resolve(false); }, timeoutMs);
      const off = this.onStatus((s) => {
        if (s !== 'pong') return;
        clearTimeout(timer);
        off();
        resolve(true);
      });
      void this.source.write('P');
    });
  }

  /** Turn every motor off and close the connection. */
  async disconnect(): Promise<void> {
    await this.buzz(MOTOR.chest, PATTERN.off);
    await this.buzz(MOTOR.upperArm, PATTERN.off);
    await this.source.stop();
  }
}
