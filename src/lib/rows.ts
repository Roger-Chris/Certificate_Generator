import type { Design, DesignElement } from "./design";

/**
 * Auto-spacing rows: every visible element tagged with the same `row` is laid out left-to-right
 * (in current x order), centred on the page, with an equal gap, and vertically centred on one line.
 */

const DEFAULT_GAP = 60;

const members = (d: Design, row: string) =>
  d.elements.filter((e) => e.row === row && !e.hidden).sort((a, b) => a.x + a.w / 2 - (b.x + b.w / 2));

/** Average gap between neighbours as they are placed now (used when a row has no stored gap yet). */
export function measureGap(items: DesignElement[]): number {
  if (items.length < 2) return DEFAULT_GAP;
  const sorted = [...items].sort((a, b) => a.x - b.x);
  let sum = 0;
  for (let i = 1; i < sorted.length; i++) sum += Math.max(0, sorted[i].x - (sorted[i - 1].x + sorted[i - 1].w));
  return Math.round(sum / (sorted.length - 1));
}

export const gapOf = (d: Design, row: string) => d.rowGaps?.[row] ?? measureGap(members(d, row));

/** Remember the row's current gap before its membership changes, so spacing stays the same afterwards. */
export function pinGap(d: Design, row: string): Design {
  if (d.rowGaps?.[row] !== undefined) return d;
  return { ...d, rowGaps: { ...d.rowGaps, [row]: measureGap(members(d, row)) } };
}

export function layoutRow(d: Design, row: string): Design {
  const items = members(d, row);
  if (!items.length) return d;
  const gap = gapOf(d, row);
  const total = items.reduce((s, e) => s + e.w, 0) + gap * (items.length - 1);
  const cy = items.reduce((s, e) => s + e.y + e.h / 2, 0) / items.length;
  const pos = new Map<string, { x: number; y: number }>();
  let x = (d.width - total) / 2;
  for (const e of items) {
    pos.set(e.id, { x: Math.round(x), y: Math.round(cy - e.h / 2) });
    x += e.w + gap;
  }
  return {
    ...d,
    rowGaps: { ...d.rowGaps, [row]: gap },
    elements: d.elements.map((e) => (pos.has(e.id) ? ({ ...e, ...pos.get(e.id)! } as DesignElement) : e)),
  };
}

export function layoutRows(d: Design, rows: Iterable<string | undefined>): Design {
  let out = d;
  for (const r of new Set(rows)) if (r) out = layoutRow(out, r);
  return out;
}

export const rowNames = (d: Design) => [...new Set(d.elements.map((e) => e.row).filter(Boolean) as string[])];
