"use client";

import { useState } from "react";
import { type Design, type DesignElement, fieldHtml, newId, type TextElement } from "@/lib/design";
import ImageLibrary, { type PickedImage } from "./ImageLibrary";

type Tab = "add" | "images" | "layers";

export interface SidePanelProps {
  design: Design;
  selectedId: string | null;
  onAdd: (el: DesignElement) => void;
  onSelect: (id: string) => void;
  onPatch: (id: string, patch: Partial<DesignElement>) => void;
  onReorder: (id: string, dir: "up" | "down") => void;
  onBackground: (img: PickedImage) => void;
}

const FIELDS = ["Name", "Department", "Position", "Title", "Date", "Event"];

export const describe = (el: DesignElement) =>
  el.name ||
  (el.type === "text"
    ? el.html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim().slice(0, 40) || "Text"
    : el.type === "image"
      ? "Image"
      : el.shape === "ellipse"
        ? "Circle"
        : "Rectangle");

export default function SidePanel(p: SidePanelProps) {
  const [tab, setTab] = useState<Tab>("add");
  const { design } = p;
  const W = design.width;
  const H = design.height;

  const addText = (html: string, style: Partial<TextElement>, w: number, h: number, name?: string) =>
    p.onAdd({
      type: "text", id: newId(), name, html, x: Math.round((W - w) / 2), y: Math.round((H - h) / 2), w, h,
      fontFamily: "Lora", fontSize: 40, fontWeight: 400, color: "#1a1a1a", align: "center", valign: "top", lineHeight: 1.35, autoFit: true,
      ...style,
    });

  const addImage = (img: PickedImage) => {
    const maxW = W * 0.4;
    const maxH = H * 0.4;
    const s = Math.min(1, maxW / img.w, maxH / img.h);
    const w = Math.round(img.w * s);
    const h = Math.round(img.h * s);
    p.onAdd({ type: "image", id: newId(), name: img.name, src: img.src, x: Math.round((W - w) / 2), y: Math.round((H - h) / 2), w, h, fit: "contain" });
  };

  const addShape = (shape: "rect" | "ellipse", w: number, h: number, fill: string, name: string) =>
    p.onAdd({ type: "shape", id: newId(), name, shape, fill, x: Math.round((W - w) / 2), y: Math.round((H - h) / 2), w, h });

  const customField = () => {
    const name = window.prompt("Field name (the column heading in your Excel sheet), e.g. Roll No");
    const clean = name?.replace(/[{}<>]/g, "").trim();
    if (clean) addText(fieldHtml(clean), { fontSize: 44 }, 800, 64, `Field: ${clean}`);
  };

  const layers = [...design.elements].reverse();

  return (
    <aside className="flex w-72 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="grid grid-cols-3 border-b border-slate-200 text-sm">
        {(["add", "images", "layers"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`py-2.5 font-medium capitalize ${tab === t ? "border-b-2 border-gold-500 text-navy-800" : "text-slate-500 hover:text-slate-800"}`}>
            {t}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {tab === "add" && (
          <div className="space-y-5">
            <section className="space-y-2">
              <h3 className="label">Text</h3>
              <button className="w-full rounded-lg border border-slate-200 px-3 py-2 text-left hover:border-gold-500" onClick={() => addText("Add a heading", { fontFamily: "Playfair Display", fontSize: 96, fontWeight: 800, color: "#1f2f5c" }, 1100, 120, "Heading")}>
                <span className="font-serif text-xl font-bold">Add a heading</span>
              </button>
              <button className="w-full rounded-lg border border-slate-200 px-3 py-2 text-left hover:border-gold-500" onClick={() => addText("Add a subheading", { fontFamily: "Playfair Display", fontSize: 50, fontWeight: 700, color: "#c8912e" }, 900, 68, "Subheading")}>
                <span className="font-serif text-base font-semibold">Add a subheading</span>
              </button>
              <button className="w-full rounded-lg border border-slate-200 px-3 py-2 text-left hover:border-gold-500" onClick={() => addText("Add a little bit of body text", { fontSize: 40, align: "left" }, 1400, 120, "Text")}>
                <span className="text-sm">Add body text</span>
              </button>
            </section>

            <section>
              <h3 className="label">Fill-in fields</h3>
              <p className="mb-2 text-[11px] leading-snug text-slate-500">
                Replaced for each person from the table or Excel. You can also type <code>{"{Name}"}</code> inside any text.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {FIELDS.map((f) => (
                  <button key={f} onClick={() => addText(fieldHtml(f), { fontSize: 44 }, f === "Title" ? 1400 : 800, 64, `Field: ${f}`)} className="rounded-full border border-gold-400 bg-gold-100/50 px-2.5 py-1 text-xs font-medium text-gold-600 hover:bg-gold-100">
                    {`{${f}}`}
                  </button>
                ))}
                <button onClick={customField} className="rounded-full border border-dashed border-slate-400 px-2.5 py-1 text-xs text-slate-600 hover:border-gold-500">
                  + Custom
                </button>
              </div>
            </section>

            <section>
              <h3 className="label">Shapes & lines</h3>
              <div className="grid grid-cols-4 gap-2">
                <button title="Rectangle" onClick={() => addShape("rect", 500, 260, "#1f2f5c", "Rectangle")} className="grid h-14 place-items-center rounded border border-slate-200 hover:border-gold-500">
                  <span className="h-6 w-9 bg-navy-800" />
                </button>
                <button title="Circle" onClick={() => addShape("ellipse", 260, 260, "#c8912e", "Circle")} className="grid h-14 place-items-center rounded border border-slate-200 hover:border-gold-500">
                  <span className="h-8 w-8 rounded-full bg-gold-500" />
                </button>
                <button title="Line" onClick={() => addShape("rect", 600, 4, "#111111", "Line")} className="grid h-14 place-items-center rounded border border-slate-200 hover:border-gold-500">
                  <span className="h-0.5 w-10 bg-slate-900" />
                </button>
                <button title="Gold line" onClick={() => addShape("rect", 600, 4, "#c8912e", "Gold line")} className="grid h-14 place-items-center rounded border border-slate-200 hover:border-gold-500">
                  <span className="h-0.5 w-10 bg-gold-500" />
                </button>
              </div>
            </section>
          </div>
        )}

        {tab === "images" && <ImageLibrary onPick={(img, kind) => (kind === "background" ? p.onBackground(img) : addImage(img))} />}

        {tab === "layers" && (
          <div>
            <p className="mb-2 text-[11px] text-slate-500">Top of the list is in front.</p>
            <ul className="space-y-1">
              {layers.map((el, i) => (
                <li
                  key={el.id}
                  onClick={() => p.onSelect(el.id)}
                  className={`group flex cursor-pointer items-center gap-1.5 rounded px-2 py-1.5 text-sm ${el.id === p.selectedId ? "bg-navy-50 ring-1 ring-navy-600" : "hover:bg-slate-50"} ${el.hidden ? "opacity-50" : ""}`}
                >
                  <span className="w-4 text-center text-xs text-slate-400">{el.type === "text" ? "T" : el.type === "image" ? "▣" : "■"}</span>
                  <span className="min-w-0 flex-1 truncate">{describe(el)}</span>
                  <button
                    title="Move forward"
                    disabled={i === 0}
                    className="px-0.5 text-slate-400 hover:text-slate-800 disabled:opacity-20"
                    onClick={(e) => {
                      e.stopPropagation();
                      p.onReorder(el.id, "up");
                    }}
                  >
                    ▲
                  </button>
                  <button
                    title="Move backward"
                    disabled={i === layers.length - 1}
                    className="px-0.5 text-slate-400 hover:text-slate-800 disabled:opacity-20"
                    onClick={(e) => {
                      e.stopPropagation();
                      p.onReorder(el.id, "down");
                    }}
                  >
                    ▼
                  </button>
                  <button
                    title={el.hidden ? "Show" : "Hide"}
                    className="px-0.5 text-xs text-slate-500 hover:text-slate-900"
                    onClick={(e) => {
                      e.stopPropagation();
                      p.onPatch(el.id, { hidden: !el.hidden || undefined });
                    }}
                  >
                    {el.hidden ? "◌" : "◉"}
                  </button>
                  <button
                    title={el.locked ? "Unlock" : "Lock"}
                    className={`px-0.5 text-xs ${el.locked ? "text-slate-900" : "text-slate-300 hover:text-slate-700"}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      p.onPatch(el.id, { locked: !el.locked || undefined });
                    }}
                  >
                    🔒
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </aside>
  );
}
