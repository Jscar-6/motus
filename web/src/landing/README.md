# landing

Pieces of the landing page (`src/pages/Landing.tsx`).

- `Lens.tsx`: the 460px decorative lens. A dotted ring (`LensRing.tsx`, inline SVG on the paper and ink-3 tokens) spins slowly with `DotHand` layered over it. Reduced motion renders it still.
- `DotHand.tsx`: canvas that redraws the 3D hand every frame (curl, nod, a full turn every 6 s), pauses when the tab is hidden, and draws one still frame under reduced motion. The 400-unit model space is scaled by `size / 460 * 1.15` and centred on the hand's midpoint so it sits inside the ring.
- `handModel.ts`: pure TS point-cloud hand (`buildHand`) and perspective projection (`projectHand`), ported from the Hand.dc.html prototype.
- `useFlipFrom.ts`: FLIP hook plus the router-state shape. Landing passes the lens and wordmark rectangles when navigating to `/session`; Session animates its video panel and wordmark from those rectangles to their natural place. Without that state (direct visit, reload, `?demo=1`) nothing animates.
