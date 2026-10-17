// Stippled text sampling: draws the message offscreen and scatters dots on a jittered grid inside the glyphs.

export type Vec3 = [number, number, number];

const W = 1400;
const H = 640;
const FONT = (size: number): string => `800 ${size}px "Tanker", "Helvetica Neue", Helvetica, Arial, sans-serif`;

/** Fisher-Yates shuffle in place. */
function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Waits for the display font so the sampled glyphs use it; falls back silently if it cannot load. */
async function fontsReady(): Promise<void> {
  try {
    await document.fonts.load('800 100px Tanker');
  } catch {
    /* the fallback stack in FONT is used instead */
  }
  await document.fonts.ready;
}

/** Returns exactly `count` stipple points (world units, centered on the origin) filling the glyphs of `lines`. */
export async function sampleText(lines: readonly string[], count: number, worldWidth: number): Promise<Vec3[]> {
  await fontsReady();
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('2D canvas unavailable');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  let size = 220;
  ctx.font = FONT(size);
  const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
  size = Math.min((size * (W * 0.92)) / widest, (H * 0.9) / (lines.length * 1.08));
  ctx.font = FONT(size);
  const lh = size * 1.08;
  const y0 = H / 2 - (lh * (lines.length - 1)) / 2;
  lines.forEach((l, i) => ctx.fillText(l, W / 2, y0 + i * lh));

  const data = ctx.getImageData(0, 0, W, H).data;
  let filled = 0;
  for (let i = 0; i < data.length; i += 4) if (data[i] > 127) filled++;

  const step = Math.sqrt(filled / count);
  const pts: [number, number][] = [];
  for (let gy = step / 2; gy < H; gy += step) {
    for (let gx = step / 2; gx < W; gx += step) {
      const x = gx + (Math.random() - 0.5) * step * 0.9;
      const y = gy + (Math.random() - 0.5) * step * 0.9;
      const xi = Math.round(x);
      const yi = Math.round(y);
      if (xi >= 0 && yi >= 0 && xi < W && yi < H && data[(yi * W + xi) * 4] > 127) pts.push([x, y]);
    }
  }
  shuffle(pts);
  while (pts.length < count) {
    const p = pts[(Math.random() * pts.length) | 0];
    pts.push([p[0] + (Math.random() - 0.5) * step * 0.5, p[1] + (Math.random() - 0.5) * step * 0.5]);
  }
  pts.length = count;

  const s = worldWidth / W;
  return pts.map(([x, y]) => [(x - W / 2) * s, -(y - H / 2) * s + 0.15, (Math.random() - 0.5) * 0.08]);
}
