/**
 * Finds the "fill in the blank" underlines on a certificate image: thin horizontal strokes
 * that contrast with the pixels a few rows above and below. Ported from the script used
 * to seed the first templates.
 */
export interface Blank {
  x1: number;
  x2: number;
  y: number;
}

export function detectBlanks(img: HTMLImageElement, minLength = 140): Blank[] {
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, W, H);
  const gray = new Uint8Array(W * H);
  for (let i = 0, p = 0; i < gray.length; i++, p += 4) gray[i] = (data[p] * 299 + data[p + 1] * 587 + data[p + 2] * 114) / 1000;

  const D = 5;
  const y0 = Math.floor(H * 0.3);
  const y1 = Math.floor(H * 0.88);
  const lines: { x1: number; x2: number; ya: number; yb: number }[] = [];

  for (let y = y0; y < y1; y++) {
    const runs: [number, number][] = [];
    let start = -1;
    let last = -100;
    for (let x = 0; x < W; x++) {
      const c = gray[y * W + x];
      const up = gray[(y - D) * W + x];
      const dn = gray[(y + D) * W + x];
      const hit = Math.abs(c - up) > 40 && Math.abs(c - dn) > 40 && Math.abs(up - dn) < 30;
      if (!hit) continue;
      if (x - last > 8) {
        if (start >= 0) runs.push([start, last + 1]);
        start = x;
      }
      last = x;
    }
    if (start >= 0) runs.push([start, last + 1]);
    for (const [s, e] of runs) {
      if (e - s < 80) continue;
      const L = lines.find((l) => y - l.yb <= 2 && Math.min(e, l.x2) - Math.max(s, l.x1) > 0.5 * (e - s));
      if (L) {
        L.x1 = Math.min(L.x1, s);
        L.x2 = Math.max(L.x2, e);
        L.yb = y;
      } else lines.push({ x1: s, x2: e, ya: y, yb: y });
    }
  }
  return lines
    .filter((l) => l.yb - l.ya <= 7 && l.x2 - l.x1 >= minLength)
    .map((l) => ({ x1: l.x1, x2: l.x2, y: l.ya }))
    .sort((a, b) => a.y - b.y || a.x1 - b.x1);
}
