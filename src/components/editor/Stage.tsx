"use client";

import { type CSSProperties, useEffect, useRef, useState } from "react";
import CertificateView from "@/components/CertificateView";
import type { Design, DesignElement } from "@/lib/design";

type Handle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
type Drag =
  | { kind: "move"; id: string; sx: number; sy: number; orig: DesignElement }
  | { kind: "resize"; id: string; handle: Handle; sx: number; sy: number; orig: DesignElement }
  | { kind: "rotate"; id: string; orig: DesignElement };

const HANDLES: Handle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
const SNAP_PX = 6;
const PAD = 48;

export interface StageProps {
  design: Design;
  zoom: number;
  values: Record<string, string> | null;
  selectedId: string | null;
  editingId: string | null;
  onSelect: (id: string | null) => void;
  onStartEdit: (id: string) => void;
  onCommitText: (id: string, html: string) => void;
  /** Live update while dragging (not recorded in undo history until onGestureEnd). */
  onLive: (id: string, patch: Partial<DesignElement>) => void;
  onGestureStart: () => void;
  onGestureEnd: () => void;
  scrollerRef: React.RefObject<HTMLDivElement | null>;
}

export default function Stage(p: StageProps) {
  const { design, zoom: z } = p;
  const surface = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const [guides, setGuides] = useState<{ x: number[]; y: number[] }>({ x: [], y: [] });
  const selected = design.elements.find((e) => e.id === p.selectedId && !e.hidden) ?? null;

  const toDesign = (clientX: number, clientY: number) => {
    const r = surface.current!.getBoundingClientRect();
    return { x: (clientX - r.left) / z, y: (clientY - r.top) / z };
  };

  const begin = (e: React.PointerEvent, d: Drag) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // Some pointer sources (pens/automation) can't be captured; the stage's move/up handlers still work.
    }
    drag.current = d;
    p.onGestureStart();
  };

  // Snap an element's edges/centre to the page and other elements.
  const snap = (x: number, y: number, w: number, h: number, id: string, axisLock: "x" | "y" | null) => {
    const tx = [0, design.width / 2, design.width];
    const ty = [0, design.height / 2, design.height];
    for (const o of design.elements) {
      if (o.id === id || o.hidden) continue;
      tx.push(o.x, o.x + o.w / 2, o.x + o.w);
      ty.push(o.y, o.y + o.h / 2, o.y + o.h);
    }
    const tol = SNAP_PX / z;
    const best = (vals: number[], targets: number[]) => {
      let bestD = Infinity;
      let shift = 0;
      let line: number | null = null;
      for (const v of vals)
        for (const t of targets) {
          const d = Math.abs(t - v);
          if (d < tol && d < bestD) {
            bestD = d;
            shift = t - v;
            line = t;
          }
        }
      return { shift, line };
    };
    const sx = axisLock === "y" ? { shift: 0, line: null } : best([x, x + w / 2, x + w], tx);
    const sy = axisLock === "x" ? { shift: 0, line: null } : best([y, y + h / 2, y + h], ty);
    setGuides({ x: sx.line === null ? [] : [sx.line], y: sy.line === null ? [] : [sy.line] });
    return { x: x + sx.shift, y: y + sy.shift };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const o = d.orig;
    if (d.kind === "move") {
      let dx = (e.clientX - d.sx) / z;
      let dy = (e.clientY - d.sy) / z;
      let lock: "x" | "y" | null = null;
      if (e.shiftKey) {
        if (Math.abs(dx) > Math.abs(dy)) {
          dy = 0;
          lock = "y";
        } else {
          dx = 0;
          lock = "x";
        }
      }
      const s = e.altKey ? { x: o.x + dx, y: o.y + dy } : snap(o.x + dx, o.y + dy, o.w, o.h, o.id, lock);
      p.onLive(d.id, { x: Math.round(s.x), y: Math.round(s.y) });
    } else if (d.kind === "resize") {
      const dx = (e.clientX - d.sx) / z;
      const dy = (e.clientY - d.sy) / z;
      let { x, y, w, h } = o;
      const hd = d.handle;
      if (hd.includes("e")) w = o.w + dx;
      if (hd.includes("w")) {
        w = o.w - dx;
        x = o.x + dx;
      }
      if (hd.includes("s")) h = o.h + dy;
      if (hd.includes("n")) {
        h = o.h - dy;
        y = o.y + dy;
      }
      // Images keep their proportions on corner handles (Shift toggles).
      const corner = hd.length === 2;
      const keepRatio = corner && (o.type === "image" ? !e.shiftKey : e.shiftKey);
      if (keepRatio) {
        const ratio = o.w / o.h;
        if (Math.abs(w / o.w) > Math.abs(h / o.h)) h = w / ratio;
        else w = h * ratio;
        if (hd.includes("w")) x = o.x + o.w - w;
        if (hd.includes("n")) y = o.y + o.h - h;
      }
      w = Math.max(8, w);
      h = Math.max(4, h);
      p.onLive(d.id, { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) });
    } else {
      const c = toDesign(e.clientX, e.clientY);
      const cx = o.x + o.w / 2;
      const cy = o.y + o.h / 2;
      let deg = (Math.atan2(c.y - cy, c.x - cx) * 180) / Math.PI + 90;
      if (e.shiftKey) deg = Math.round(deg / 15) * 15;
      deg = ((deg + 540) % 360) - 180;
      if (Math.abs(deg) < 3) deg = 0;
      p.onLive(d.id, { rotation: Math.round(deg) || undefined });
    }
  };

  const end = () => {
    if (!drag.current) return;
    drag.current = null;
    setGuides({ x: [], y: [] });
    p.onGestureEnd();
  };

  // Stop a drag if the pointer is released outside the window.
  useEffect(() => {
    window.addEventListener("blur", end);
    return () => window.removeEventListener("blur", end);
  });

  const boxStyle = (el: DesignElement): CSSProperties => ({
    position: "absolute",
    left: el.x * z,
    top: el.y * z,
    width: el.w * z,
    height: el.h * z,
    transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
  });

  return (
    <div
      ref={p.scrollerRef}
      className={`relative min-h-0 flex-1 overflow-auto bg-slate-200 ${p.editingId ? "" : "select-none"}`}
      onPointerDown={() => p.onSelect(null)}
      onPointerMove={onPointerMove}
      onPointerUp={end}
    >
      <div style={{ width: design.width * z + PAD * 2, height: design.height * z + PAD * 2, position: "relative", margin: "0 auto" }}>
        <div ref={surface} className="absolute shadow-xl" style={{ left: PAD, top: PAD, width: design.width * z, height: design.height * z }}>
          <div style={{ transform: `scale(${z})`, transformOrigin: "0 0", width: design.width, height: design.height }}>
            <CertificateView design={design} values={p.editingId ? null : p.values} editingId={p.editingId} onCommitText={p.onCommitText} />
          </div>

          {/* hit targets, in paint order so the topmost element wins */}
          {design.elements.map((el) =>
            el.hidden || el.id === p.editingId ? null : (
              <div
                key={el.id}
                style={{ ...boxStyle(el), cursor: el.locked ? "default" : "move" }}
                className="hover:outline hover:outline-1 hover:outline-sky-400"
                onPointerDown={(e) => {
                  if (e.button !== 0) return;
                  e.stopPropagation();
                  p.onSelect(el.id);
                  if (!el.locked) begin(e, { kind: "move", id: el.id, sx: e.clientX, sy: e.clientY, orig: { ...el } });
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  if (el.type === "text" && !el.locked) p.onStartEdit(el.id);
                }}
              />
            ),
          )}

          {selected && (
            <div style={{ ...boxStyle(selected), pointerEvents: "none" }} className="outline outline-2 outline-offset-0 outline-gold-500">
              {!selected.locked && p.editingId !== selected.id && (
                <>
                  {HANDLES.map((h) => {
                    const pos: CSSProperties = {
                      left: h.includes("w") ? -6 : h.includes("e") ? "calc(100% - 6px)" : "calc(50% - 6px)",
                      top: h.includes("n") ? -6 : h.includes("s") ? "calc(100% - 6px)" : "calc(50% - 6px)",
                      cursor: `${h}-resize`,
                    };
                    return (
                      <span
                        key={h}
                        className="pointer-events-auto absolute h-3 w-3 rounded-sm border border-gold-600 bg-white shadow"
                        style={pos}
                        onPointerDown={(e) => begin(e, { kind: "resize", id: selected.id, handle: h, sx: e.clientX, sy: e.clientY, orig: { ...selected } })}
                      />
                    );
                  })}
                  <span className="absolute left-1/2 top-[-34px] h-6 w-px bg-gold-500" />
                  <span
                    title="Rotate (Shift = 15° steps)"
                    className="pointer-events-auto absolute left-[calc(50%-8px)] top-[-44px] grid h-4 w-4 cursor-grab place-items-center rounded-full border border-gold-600 bg-white text-[9px] shadow"
                    onPointerDown={(e) => begin(e, { kind: "rotate", id: selected.id, orig: { ...selected } })}
                  >
                    ↻
                  </span>
                </>
              )}
              {selected.locked && <span className="absolute -top-6 left-0 rounded bg-slate-700 px-1.5 text-[10px] text-white">🔒 locked</span>}
            </div>
          )}

          {guides.x.map((x) => (
            <div key={`gx${x}`} className="pointer-events-none absolute top-0 h-full w-px bg-fuchsia-500" style={{ left: x * z }} />
          ))}
          {guides.y.map((y) => (
            <div key={`gy${y}`} className="pointer-events-none absolute left-0 h-px w-full bg-fuchsia-500" style={{ top: y * z }} />
          ))}
        </div>
      </div>
    </div>
  );
}

export const STAGE_PAD = PAD;
