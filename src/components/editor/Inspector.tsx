"use client";

import type { ReactNode } from "react";
import { type Design, type DesignElement, type FieldCase, SIZES, type TextElement, caseFor, minChFor, padChFor, sampleFor } from "@/lib/design";
import { FONTS } from "@/lib/fonts";

export interface InspectorProps {
  design: Design;
  el: DesignElement | null;
  fields: string[];
  patchEl: (patch: Partial<DesignElement>, key?: string) => void;
  patchDesign: (patch: Partial<Design>, key?: string) => void;
  arrange: (a: "front" | "forward" | "backward" | "back") => void;
  duplicate: () => void;
  remove: () => void;
  startEdit: () => void;
  openPicker: (target: "element" | "background") => void;
  rows: string[];
  rowGap: number;
  setRowGap: (row: string, gap: number) => void;
  recentreRow: (row: string) => void;
}

/** Membership of an auto-spacing row: members stay centred on the page with equal gaps. */
function RowSection(p: InspectorProps & { el: DesignElement }) {
  const { el } = p;
  const options = [...new Set([...p.rows, "logos"])];
  return (
    <Section title="Auto-spacing row">
      <p className="text-[11px] leading-snug text-slate-500">
        Items in the same row stay centred on the page with equal gaps. Remove or hide one and the rest re-centre; drag one
        sideways to change the order.
      </p>
      <select
        className="input"
        value={el.row ?? ""}
        onChange={(e) => {
          let v = e.target.value;
          if (v === "__new") v = window.prompt("Name for the new row, e.g. partners")?.trim() ?? "";
          p.patchEl({ row: v || undefined });
        }}
      >
        <option value="">Not in a row (free position)</option>
        {options.map((r) => (
          <option key={r} value={r}>
            Row: {r}
          </option>
        ))}
        <option value="__new">+ New row…</option>
      </select>
      {el.row && (
        <div className="flex items-end gap-2">
          <Row label="Gap between items">
            <Num value={p.rowGap} min={0} max={1000} suffix="px" onChange={(v) => p.setRowGap(el.row!, v)} />
          </Row>
          <button className="btn-ghost shrink-0 px-2 py-1.5 text-xs" onClick={() => p.recentreRow(el.row!)}>
            Re-centre row
          </button>
        </div>
      )}
    </Section>
  );
}

const Row = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="block">
    <span className="mb-1 block text-[11px] font-medium text-slate-500">{label}</span>
    {children}
  </label>
);

function Num({ value, onChange, step = 1, min, max, suffix }: { value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number; suffix?: string }) {
  return (
    <div className="relative">
      <input
        type="number"
        className="input pr-7"
        value={Number.isFinite(value) ? Math.round(value * 100) / 100 : ""}
        step={step}
        min={min}
        max={max}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (e.target.value !== "" && Number.isFinite(v)) onChange(min !== undefined ? Math.max(min, max !== undefined ? Math.min(max, v) : v) : v);
        }}
      />
      {suffix && <span className="pointer-events-none absolute right-2 top-1.5 text-xs text-slate-400">{suffix}</span>}
    </div>
  );
}

function Color({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const hex = /^#[0-9a-f]{6}$/i.test(value) ? value : "#000000";
  return (
    <div className="flex gap-1">
      <input type="color" className="h-8 w-9 shrink-0 cursor-pointer rounded border border-slate-300" value={hex} onChange={(e) => onChange(e.target.value)} />
      <input className="input font-mono text-xs" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

const Seg = <T extends string>({ value, options, onChange }: { value: T; options: { v: T; label: ReactNode; title?: string }[]; onChange: (v: T) => void }) => (
  <div className="flex overflow-hidden rounded-md ring-1 ring-slate-300">
    {options.map((o) => (
      <button key={o.v} title={o.title} onClick={() => onChange(o.v)} className={`flex-1 py-1 text-xs ${value === o.v ? "bg-navy-800 text-white" : "bg-white hover:bg-slate-50"}`}>
        {o.label}
      </button>
    ))}
  </div>
);

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2.5 border-b border-slate-100 px-4 py-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      {children}
    </section>
  );
}

export default function Inspector(p: InspectorProps) {
  const { el, design } = p;
  return (
    <aside className="w-64 shrink-0 overflow-y-auto border-l border-slate-200 bg-white text-sm xl:w-80">
      {!el ? <DesignPanel {...p} /> : el.type === "text" ? <TextPanel {...p} el={el} /> : <ElementPanel {...p} el={el} />}
      {el && (
        <>
          <RowSection {...p} el={el} />
          <Section title="Position & size">
            <div className="grid grid-cols-2 gap-2">
              <Row label="X">
                <Num value={el.x} onChange={(v) => p.patchEl({ x: v }, "x")} />
              </Row>
              <Row label="Y">
                <Num value={el.y} onChange={(v) => p.patchEl({ y: v }, "y")} />
              </Row>
              <Row label="Width">
                <Num value={el.w} min={4} onChange={(v) => p.patchEl({ w: v }, "w")} />
              </Row>
              <Row label="Height">
                <Num value={el.h} min={2} onChange={(v) => p.patchEl({ h: v }, "h")} />
              </Row>
              <Row label="Rotation">
                <Num value={el.rotation ?? 0} min={-180} max={180} suffix="°" onChange={(v) => p.patchEl({ rotation: v || undefined }, "rot")} />
              </Row>
              <Row label="Transparency">
                <input
                  type="range"
                  min={0.05}
                  max={1}
                  step={0.05}
                  className="mt-2 w-full accent-gold-500"
                  value={el.opacity ?? 1}
                  onChange={(e) => p.patchEl({ opacity: Number(e.target.value) === 1 ? undefined : Number(e.target.value) }, "opacity")}
                />
              </Row>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <button className="btn-ghost px-2 py-1 text-xs" onClick={() => p.patchEl({ x: Math.round((design.width - el.w) / 2) })}>
                Centre horizontally
              </button>
              <button className="btn-ghost px-2 py-1 text-xs" onClick={() => p.patchEl({ y: Math.round((design.height - el.h) / 2) })}>
                Centre vertically
              </button>
            </div>
          </Section>
          <Section title="Arrange">
            <div className="grid grid-cols-4 gap-1">
              {(
                [
                  ["front", "To front"],
                  ["forward", "Forward"],
                  ["backward", "Backward"],
                  ["back", "To back"],
                ] as const
              ).map(([a, l]) => (
                <button key={a} className="btn-ghost px-1 py-1 text-[11px]" onClick={() => p.arrange(a)}>
                  {l}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5">
              <button className="btn-ghost flex-1 py-1.5 text-xs" onClick={p.duplicate}>
                Duplicate
              </button>
              <button className="btn-ghost flex-1 py-1.5 text-xs" onClick={() => p.patchEl({ locked: !el.locked || undefined })}>
                {el.locked ? "Unlock" : "Lock"}
              </button>
              <button className="btn-ghost flex-1 py-1.5 text-xs text-red-600" onClick={p.remove}>
                Delete
              </button>
            </div>
          </Section>
        </>
      )}
    </aside>
  );
}

function DesignPanel(p: InspectorProps) {
  const d = p.design;
  const size = SIZES.find((s) => s.width === d.width && s.height === d.height)?.label ?? "Custom";
  return (
    <>
      <Section title="Design">
        <Row label="Event (designs with the same event are grouped)">
          <input className="input" value={d.event} placeholder="e.g. Academic Staff College" onChange={(e) => p.patchDesign({ event: e.target.value }, "event")} />
        </Row>
        <Row label="Page size">
          <select
            className="input"
            value={size}
            onChange={(e) => {
              const s = SIZES.find((x) => x.label === e.target.value);
              if (s) p.patchDesign({ width: s.width, height: s.height });
            }}
          >
            {SIZES.map((s) => (
              <option key={s.label}>{s.label}</option>
            ))}
            {size === "Custom" && <option>Custom</option>}
          </select>
        </Row>
        <div className="grid grid-cols-2 gap-2">
          <Row label="Width (px)">
            <Num value={d.width} min={200} max={6000} onChange={(v) => p.patchDesign({ width: v }, "dw")} />
          </Row>
          <Row label="Height (px)">
            <Num value={d.height} min={200} max={6000} onChange={(v) => p.patchDesign({ height: v }, "dh")} />
          </Row>
        </div>
      </Section>
      <Section title="Background">
        <Row label="Colour">
          <Color value={d.background} onChange={(v) => p.patchDesign({ background: v }, "bg")} />
        </Row>
        <div className="flex items-center gap-2">
          {d.backgroundImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={d.backgroundImage} alt="" className="h-12 w-16 rounded border border-slate-200 object-cover" />
          ) : (
            <span className="grid h-12 w-16 place-items-center rounded border border-dashed border-slate-300 text-[10px] text-slate-400">none</span>
          )}
          <button className="btn-ghost px-2 py-1 text-xs" onClick={() => p.openPicker("background")}>
            {d.backgroundImage ? "Change image" : "Add image"}
          </button>
          {d.backgroundImage && (
            <button className="text-xs text-red-600 hover:underline" onClick={() => p.patchDesign({ backgroundImage: null })}>
              Remove
            </button>
          )}
        </div>
      </Section>
      <Section title="Fill-in fields">
        {p.fields.length === 0 ? (
          <p className="text-xs text-slate-500">
            No fields yet. Add one from <b>Add → Fill-in fields</b>, or type <code>{"{Name}"}</code> in any text.
          </p>
        ) : (
          <>
            <p className="text-[11px] text-slate-500">
              Each becomes a column when creating certificates. The value sits in a fixed blank (width + space each side), so the
              layout stays the same for short and long names. Sample text is only for the preview.
            </p>
            {p.fields.map((f) => (
              <div key={f} className="rounded-lg border border-slate-200 p-2">
                <p className="mb-1.5 font-mono text-xs font-semibold text-gold-600">{`{${f}}`}</p>
                <div className="grid grid-cols-[1fr_auto] gap-1.5">
                  <input
                    className="input text-xs"
                    value={sampleFor(d, f)}
                    placeholder="Sample"
                    onChange={(e) => p.patchDesign({ fields: { ...d.fields, [f]: { ...d.fields?.[f], sample: e.target.value } } }, `sample-${f}`)}
                  />
                  <select
                    className="input w-28 text-xs"
                    value={caseFor(d, f)}
                    onChange={(e) => p.patchDesign({ fields: { ...d.fields, [f]: { ...d.fields?.[f], case: e.target.value as FieldCase } } })}
                    title="How the value is written on the certificate"
                  >
                    <option value="none">As typed</option>
                    <option value="title">Title Case</option>
                    <option value="upper">UPPERCASE</option>
                  </select>
                </div>
                <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                  <Row label="Blank width (letters)">
                    <Num value={minChFor(d, f)} min={0} max={200} onChange={(v) => p.patchDesign({ fields: { ...d.fields, [f]: { ...d.fields?.[f], minCh: v } } }, `minch-${f}`)} />
                  </Row>
                  <Row label="Space each side">
                    <Num value={padChFor(d, f)} min={0} max={20} step={0.5} onChange={(v) => p.patchDesign({ fields: { ...d.fields, [f]: { ...d.fields?.[f], padCh: v } } }, `padch-${f}`)} />
                  </Row>
                </div>
              </div>
            ))}
          </>
        )}
      </Section>
      <p className="px-4 py-3 text-[11px] leading-relaxed text-slate-500">
        Tip: click an item on the certificate to change it, double-click text to type, drag to move. Ctrl+Z undoes.
      </p>
    </>
  );
}

function TextPanel(p: InspectorProps & { el: TextElement }) {
  const { el } = p;
  const font = FONTS.find((f) => f.family === el.fontFamily);
  const weights = font?.weights ?? [400, 700];
  const categories = [...new Set(FONTS.map((f) => f.category))];
  return (
    <>
      <Section title="Text">
        <button className="btn-gold w-full" onClick={p.startEdit}>
          Edit text
        </button>
        <p className="text-[11px] text-slate-500">Or double-click the text. Select words to make them bold, underlined or a different colour.</p>
        <Row label="Font">
          <select
            className="input"
            value={el.fontFamily}
            style={{ fontFamily: `"${el.fontFamily}"` }}
            onChange={(e) => {
              const f = FONTS.find((x) => x.family === e.target.value);
              const w = f && !f.weights.includes(el.fontWeight) ? f.weights.reduce((a, b) => (Math.abs(b - el.fontWeight) < Math.abs(a - el.fontWeight) ? b : a)) : el.fontWeight;
              p.patchEl({ fontFamily: e.target.value, fontWeight: w, italic: f?.italic ? el.italic : undefined } as Partial<TextElement>);
            }}
          >
            {categories.map((c) => (
              <optgroup key={c} label={c}>
                {FONTS.filter((f) => f.category === c).map((f) => (
                  <option key={f.family} value={f.family} style={{ fontFamily: `"${f.family}"` }}>
                    {f.family}
                  </option>
                ))}
              </optgroup>
            ))}
            {!font && <option value={el.fontFamily}>{el.fontFamily}</option>}
          </select>
        </Row>
        <div className="grid grid-cols-2 gap-2">
          <Row label="Size">
            <Num value={el.fontSize} min={6} max={600} suffix="px" onChange={(v) => p.patchEl({ fontSize: v } as Partial<TextElement>, "fs")} />
          </Row>
          <Row label="Weight">
            <select className="input" value={el.fontWeight} onChange={(e) => p.patchEl({ fontWeight: Number(e.target.value) } as Partial<TextElement>)}>
              {weights.map((w) => (
                <option key={w} value={w}>
                  {{ 300: "Light", 400: "Regular", 500: "Medium", 600: "Semibold", 700: "Bold", 800: "Extra bold", 900: "Black" }[w] ?? w}
                </option>
              ))}
            </select>
          </Row>
        </div>
        <Row label="Colour">
          <div className="space-y-1.5">
            <Seg
              value={el.gradient ? "gradient" : "solid"}
              options={[
                { v: "solid", label: "Solid" },
                { v: "gradient", label: "Gradient" },
              ]}
              onChange={(v) => p.patchEl({ gradient: v === "gradient" ? [el.color, "#f2c552"] : null } as Partial<TextElement>)}
            />
            {el.gradient ? (
              <div className="grid grid-cols-2 gap-1.5">
                <Color value={el.gradient[0]} onChange={(v) => p.patchEl({ gradient: [v, el.gradient![1]], color: v } as Partial<TextElement>, "g0")} />
                <Color value={el.gradient[1]} onChange={(v) => p.patchEl({ gradient: [el.gradient![0], v] } as Partial<TextElement>, "g1")} />
              </div>
            ) : (
              <Color value={el.color} onChange={(v) => p.patchEl({ color: v } as Partial<TextElement>, "color")} />
            )}
          </div>
        </Row>
        <Row label="Align">
          <Seg
            value={el.align}
            options={[
              { v: "left", label: "Left" },
              { v: "center", label: "Centre" },
              { v: "right", label: "Right" },
              { v: "justify", label: "Justify" },
            ]}
            onChange={(v) => p.patchEl({ align: v } as Partial<TextElement>)}
          />
        </Row>
        <Row label="Vertical position in box">
          <Seg
            value={el.valign ?? "top"}
            options={[
              { v: "top", label: "Top" },
              { v: "middle", label: "Middle" },
              { v: "bottom", label: "Bottom" },
            ]}
            onChange={(v) => p.patchEl({ valign: v } as Partial<TextElement>)}
          />
        </Row>
        <div className="grid grid-cols-2 gap-2">
          <Row label="Line spacing">
            <Num value={el.lineHeight} step={0.05} min={0.6} max={4} onChange={(v) => p.patchEl({ lineHeight: v } as Partial<TextElement>, "lh")} />
          </Row>
          <Row label="Letter spacing">
            <Num value={el.letterSpacing ?? 0} step={0.5} min={-20} max={200} suffix="px" onChange={(v) => p.patchEl({ letterSpacing: v || undefined } as Partial<TextElement>, "ls")} />
          </Row>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {font?.italic !== false && (
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={!!el.italic} onChange={(e) => p.patchEl({ italic: e.target.checked || undefined } as Partial<TextElement>)} /> Italic
            </label>
          )}
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={!!el.uppercase} onChange={(e) => p.patchEl({ uppercase: e.target.checked || undefined } as Partial<TextElement>)} /> UPPERCASE
          </label>
          <label className="flex items-center gap-1.5" title="Shrinks the text when a long name doesn't fit the box">
            <input type="checkbox" checked={!!el.autoFit} onChange={(e) => p.patchEl({ autoFit: e.target.checked || undefined } as Partial<TextElement>)} /> Shrink to fit box
          </label>
        </div>
      </Section>
    </>
  );
}

function ElementPanel(p: InspectorProps & { el: Exclude<DesignElement, TextElement> }) {
  const { el } = p;
  if (el.type === "image") {
    return (
      <Section title="Image">
        <div className="checker grid h-28 place-items-center rounded border border-slate-200 p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={el.src} alt="" className="max-h-full max-w-full object-contain" />
        </div>
        <button className="btn-gold w-full" onClick={() => p.openPicker("element")}>
          Replace image
        </button>
        <Row label="Fit in box">
          <Seg
            value={el.fit}
            options={[
              { v: "contain", label: "Fit" },
              { v: "cover", label: "Fill & crop" },
              { v: "fill", label: "Stretch" },
            ]}
            onChange={(v) => p.patchEl({ fit: v } as Partial<DesignElement>)}
          />
        </Row>
        <button
          className="btn-ghost w-full py-1 text-xs"
          onClick={() => {
            const img = new Image();
            img.onload = () => p.patchEl({ h: Math.round((el.w * img.naturalHeight) / img.naturalWidth) });
            img.src = el.src;
          }}
        >
          Reset to original proportions
        </button>
      </Section>
    );
  }
  return (
    <Section title="Shape">
      <Row label="Shape">
        <Seg
          value={el.shape}
          options={[
            { v: "rect", label: "Rectangle" },
            { v: "ellipse", label: "Circle / oval" },
          ]}
          onChange={(v) => p.patchEl({ shape: v } as Partial<DesignElement>)}
        />
      </Row>
      <Row label="Fill">
        <Color value={el.fill} onChange={(v) => p.patchEl({ fill: v } as Partial<DesignElement>, "fill")} />
      </Row>
      <div className="grid grid-cols-2 gap-2">
        <Row label="Border width">
          <Num value={el.strokeWidth ?? 0} min={0} max={100} onChange={(v) => p.patchEl({ strokeWidth: v || undefined, stroke: el.stroke ?? "#c8912e" } as Partial<DesignElement>, "sw")} />
        </Row>
        {el.shape === "rect" && (
          <Row label="Corner radius">
            <Num value={el.radius ?? 0} min={0} max={1000} onChange={(v) => p.patchEl({ radius: v || undefined } as Partial<DesignElement>, "radius")} />
          </Row>
        )}
      </div>
      {!!el.strokeWidth && (
        <Row label="Border colour">
          <Color value={el.stroke ?? "#c8912e"} onChange={(v) => p.patchEl({ stroke: v } as Partial<DesignElement>, "stroke")} />
        </Row>
      )}
      <Row label="Transparent fill">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={el.fill === "transparent"} onChange={(e) => p.patchEl({ fill: e.target.checked ? "transparent" : "#1f2f5c" } as Partial<DesignElement>)} /> No fill (border only)
        </label>
      </Row>
    </Section>
  );
}
