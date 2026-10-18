# sleeve

Jack's sleeve integration (S1–S3). `sleeveSession.ts` holds the one shared connection (USB via Web Serial, or the A3 demo sleeve) and feeds `arm/armInput`'s `pushSensorFrame`. The vision model calls `captureSleeveRest`, `withSleeve` and `buzzOnFlags`; `arm/PoseFusion` reads `sleeveBodyRotations`. `SleevePill.tsx` is the connect / zero / status pill on the Session camera panel. Without a sleeve, every call is a no-op, so camera-only mode is unchanged. How the math works: `docs/sleeve.md`.

**Before connecting, start the bridge** in a terminal and leave it running. Chrome's Web Serial reported "device lost" on every read on our Linux laptop, so the app reads the USB port through this local bridge, and falls back to Web Serial only if the bridge isn't running:
```bash
python3 -m pip install pyserial          # once per computer
python3 firmware/tools/sleeve_bridge.py  # from the repo root; finds the ESP32's port by itself
```

Session order with the sleeve:
1. **Connect sleeve:** the board restarts once, when the bridge starts.
2. **Zero:** sit still for 2 s (the sleeve stays on).
3. Put the sleeve on.
4. **Capture rest pose:** the camera and sleeve rest are captured together.
