# sleeve

Jack's sleeve integration (S1–S3). `sleeveSession.ts` holds the one shared connection (USB via Web Serial, or the A3 demo sleeve) and feeds `arm/armInput`'s `pushSensorFrame`. The vision model calls `captureSleeveRest`, `withSleeve` and `buzzOnFlags`; `arm/PoseFusion` reads `sleeveBodyRotations`. `SleevePill.tsx` is the connect / zero / status pill on the Session camera panel. Without a sleeve, every call is a no-op, so camera-only mode is unchanged. How the math works: `docs/sleeve.md`.

Session order with the sleeve:
1. **Connect sleeve:** the board restarts when the port opens.
2. **Zero:** lay the sleeve flat with the X arrows aligned.
3. Put the sleeve on.
4. **Capture rest pose:** the camera and sleeve rest are captured together.
