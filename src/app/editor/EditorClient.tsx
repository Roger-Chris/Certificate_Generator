"use client";

import JSZip from "jszip";
import { useEffect, useMemo, useRef, useState } from "react";
import { downloadBlob } from "@/lib/data";
import { type Blank, detectBlanks } from "@/lib/detect";
import { FONTS } from "@/lib/fonts";
import { drawFields, ensureFonts, loadImage } from "@/lib/render";
import type { Column, EventTemplate, FieldLayout, Variant } from "@/lib/types";

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "event";

const DEFAULT_BODY =
  "Dear {Name},\n\nGreetings from Rajalakshmi Institute of Technology.\n\nPlease find attached your {Type} certificate for {Event}.\n\nThank you for being part of it.\n\nRegards,\nRajalakshmi Institute of Technology, Chennai";

const blankEvent = (): EventTemplate => ({
  slug: "",
  name: "",
  description: "",
  order: 0,
  columns: [
    { key: "name", label: "Name", aliases: ["full name", "participant name", "staff name", "faculty name"] },
    { key: "department", label: "Department / Institution", aliases: ["from", "dept", "institution", "college"] },
  ],
  variants: [],
  email: { subject: "Your {Event} certificate", body: DEFAULT_BODY },
});

const SAMPLE: Record<string, string> = {
  name: "Dr. Lakshmi Narayanan",
  department: "Department of Computer Science",
  position: "First",
  title: "A Study on Sustainable Campus Energy Systems",
};

export default function EditorClient({ events }: { events: EventTemplate[] }) {
  const [ev, setEv] = useState<EventTemplate>(blankEvent);
  const [sourceSlug, setSourceSlug] = useState<string | null>(null);
  /** variant id -> image URL (existing template path or object URL for a new upload) */
  const [images, setImages] = useState<Record<string, string>>({});
  /** variant id -> newly uploaded file (needed when exporting) */
  const [uploads, setUploads] = useState<Record<string, File>>({});
  const [vIdx, setVIdx] = useState(0);
  const [fIdx, setFIdx] = useState<number | null>(null);
  const [samples, setSamples] = useState<Record<string, string>>(SAMPLE);
  const [blanks, setBlanks] = useState<Blank[]>([]);
  const [showBlanks, setShowBlanks] = useState(true);
  const [displayW, setDisplayW] = useState(800);
  const [msg, setMsg] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const variant: Variant | undefined = ev.variants[vIdx];
  const field: FieldLayout | undefined = variant && fIdx !== null ? variant.fields[fIdx] : undefined;
  const scale = variant ? displayW / variant.width : 1;
  const slug = ev.slug || slugify(ev.name);

  // ---- loading ----
  const loadEvent = (s: string) => {
    if (!s) {
      setEv(blankEvent());
      setImages({});
      setSourceSlug(null);
    } else {
      const e = events.find((x) => x.slug === s)!;
      setEv(structuredClone(e));
      setImages(Object.fromEntries(e.variants.map((v) => [v.id, `/templates/${e.slug}/${v.image}`])));
      setSourceSlug(e.slug);
    }
    setUploads({});
    setVIdx(0);
    setFIdx(null);
  };

  const addDesign = async (files: FileList | null) => {
    if (!files?.length) return;
    const added: Variant[] = [];
    const newImages: Record<string, string> = {};
    const newUploads: Record<string, File> = {};
    for (const file of Array.from(files)) {
      const url = URL.createObjectURL(file);
      const img = await loadImage(url);
      let id = slugify(file.name.replace(/\.[^.]+$/, "")) || "design";
      while (ev.variants.some((v) => v.id === id) || added.some((v) => v.id === id)) id += "-2";
      const ext = file.type === "image/jpeg" ? "jpg" : "png";
      added.push({ id, label: file.name.replace(/\.[^.]+$/, ""), image: `${id}.${ext}`, width: img.naturalWidth, height: img.naturalHeight, fields: [] });
      newImages[id] = url;
      newUploads[id] = file;
    }
    setEv((e) => ({ ...e, variants: [...e.variants, ...added] }));
    setImages((m) => ({ ...m, ...newImages }));
    setUploads((m) => ({ ...m, ...newUploads }));
    setVIdx(ev.variants.length);
    setFIdx(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  // ---- mutation helpers ----
  const patchVariant = (p: Partial<Variant>) =>
    setEv((e) => ({ ...e, variants: e.variants.map((v, i) => (i === vIdx ? { ...v, ...p } : v)) }));
  const patchField = (p: Partial<FieldLayout>, idx = fIdx) => {
    if (idx === null || !variant) return;
    patchVariant({ fields: variant.fields.map((f, i) => (i === idx ? { ...f, ...p } : f)) });
  };
  const addField = (blank?: Blank) => {
    if (!variant) return;
    const used = new Set(variant.fields.map((f) => f.key));
    const key = ev.columns.find((c) => !used.has(c.key))?.key ?? ev.columns[0]?.key ?? "name";
    const style = field ?? variant.fields[variant.fields.length - 1];
    const size = style?.fontSize ?? Math.round(variant.height / 36);
    const f: FieldLayout = {
      key,
      x: blank ? blank.x1 : Math.round(variant.width * 0.3),
      y: blank ? blank.y - Math.round(size * 0.2) : Math.round(variant.height * 0.5),
      width: blank ? blank.x2 - blank.x1 : Math.round(variant.width * 0.4),
      fontFamily: style?.fontFamily ?? "Lora",
      fontSize: size,
      fontWeight: style?.fontWeight ?? 700,
      italic: style?.italic ?? false,
      color: style?.color ?? "#1a1a1a",
      align: "center",
      transform: key === "name" ? "title" : "none",
    };
    patchVariant({ fields: [...variant.fields, f] });
    setFIdx(variant.fields.length);
  };
  const snapTo = (b: Blank) => {
    if (field && fIdx !== null) patchField({ x: b.x1, width: b.x2 - b.x1, y: b.y - Math.round(field.fontSize * 0.2) });
    else addField(b);
  };

  // ---- rendering ----
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setDisplayW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, [variant?.id]);

  const imageUrl = variant ? images[variant.id] : undefined;
  useEffect(() => {
    if (!imageUrl) return setBlanks([]);
    let cancelled = false;
    loadImage(imageUrl).then((img) => !cancelled && setBlanks(detectBlanks(img)));
    return () => {
      cancelled = true;
    };
  }, [imageUrl]);

  const drawKey = JSON.stringify([variant, samples, imageUrl]);
  useEffect(() => {
    if (!variant || !imageUrl) return;
    let cancelled = false;
    (async () => {
      const [img] = await Promise.all([loadImage(imageUrl), ensureFonts(variant.fields)]);
      const c = canvasRef.current;
      if (cancelled || !c) return;
      c.width = variant.width;
      c.height = variant.height;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(img, 0, 0, variant.width, variant.height);
      drawFields(ctx, variant.fields, samples);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawKey]);

  // ---- dragging ----
  const drag = useRef<{ mode: "move" | "resize-r" | "resize-l"; idx: number; sx: number; sy: number; orig: FieldLayout } | null>(null);
  const startDrag = (e: React.PointerEvent, idx: number, mode: "move" | "resize-r" | "resize-l") => {
    e.stopPropagation();
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setFIdx(idx);
    drag.current = { mode, idx, sx: e.clientX, sy: e.clientY, orig: { ...variant!.fields[idx] } };
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = Math.round((e.clientX - d.sx) / scale);
    const dy = Math.round((e.clientY - d.sy) / scale);
    if (d.mode === "move") patchField({ x: d.orig.x + dx, y: d.orig.y + dy }, d.idx);
    else if (d.mode === "resize-r") patchField({ width: Math.max(40, d.orig.width + dx) }, d.idx);
    else patchField({ x: d.orig.x + Math.min(dx, d.orig.width - 40), width: Math.max(40, d.orig.width - dx) }, d.idx);
  };
  const endDrag = () => (drag.current = null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!field || fIdx === null) return;
      const t = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) return;
      const step = e.shiftKey ? 10 : 1;
      const moves: Record<string, Partial<FieldLayout>> = {
        ArrowLeft: { x: field.x - step },
        ArrowRight: { x: field.x + step },
        ArrowUp: { y: field.y - step },
        ArrowDown: { y: field.y + step },
      };
      if (moves[e.key]) {
        e.preventDefault();
        patchField(moves[e.key]);
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        patchVariant({ fields: variant!.fields.filter((_, i) => i !== fIdx) });
        setFIdx(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ---- columns ----
  const patchColumn = (i: number, p: Partial<Column>) =>
    setEv((e) => ({ ...e, columns: e.columns.map((c, j) => (j === i ? { ...c, ...p } : c)) }));

  // ---- export ----
  const finalEvent = useMemo<EventTemplate>(() => ({ ...ev, slug }), [ev, slug]);
  const problems = useMemo(() => {
    const p: string[] = [];
    if (!ev.name.trim()) p.push("Give the event a name.");
    if (!ev.variants.length) p.push("Add at least one certificate design (PNG).");
    ev.variants.forEach((v) => !v.fields.length && p.push(`“${v.label}” has no fields yet.`));
    const keys = new Set(ev.columns.map((c) => c.key));
    ev.variants.forEach((v) => v.fields.forEach((f) => !keys.has(f.key) && p.push(`“${v.label}” uses unknown column “${f.key}”.`)));
    return p;
  }, [ev]);

  const exportZip = async () => {
    const zip = new JSZip();
    const folder = zip.folder(slug)!;
    folder.file("event.json", JSON.stringify(finalEvent, null, 2) + "\n");
    for (const v of ev.variants) {
      const file = uploads[v.id];
      const blob = file ?? (await fetch(images[v.id]).then((r) => r.blob()));
      folder.file(v.image, blob);
    }
    downloadBlob(await zip.generateAsync({ type: "blob" }), `${slug}.zip`);
    setMsg(`Downloaded ${slug}.zip — unzip it into public/templates/ so you get public/templates/${slug}/event.json, then commit and push.`);
  };
  const copyJson = async () => {
    await navigator.clipboard.writeText(JSON.stringify(finalEvent, null, 2));
    setMsg("event.json copied to clipboard.");
  };

  const fontMeta = FONTS.find((f) => f.family === field?.fontFamily);
  const labelOf = (key: string) => ev.columns.find((c) => c.key === key)?.label ?? key;

  return (
    <main className="mx-auto max-w-[1500px] px-4 py-6">
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="mr-auto">
          <h1 className="text-2xl font-semibold text-navy-800">Template editor</h1>
          <p className="text-sm text-slate-500">Upload a blank Canva PNG, drag the text boxes onto the blank lines, then export.</p>
        </div>
        <label className="text-sm">
          <span className="label">Start from</span>
          <select className="input w-72" value={sourceSlug ?? ""} onChange={(e) => loadEvent(e.target.value)}>
            <option value="">New event</option>
            {events.map((e) => (
              <option key={e.slug} value={e.slug}>
                Edit: {e.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {msg && (
        <div className="mb-4 flex justify-between gap-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <span>{msg}</span>
          <button onClick={() => setMsg(null)}>✕</button>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)_300px]">
        {/* ------------ left: event + columns ------------ */}
        <aside className="space-y-4">
          <section className="card space-y-3 p-4">
            <h2 className="label">Event</h2>
            <input className="input" placeholder="Event name, e.g. Academic Staff College" value={ev.name} onChange={(e) => setEv({ ...ev, name: e.target.value })} />
            <input className="input" placeholder="Short description (dates, venue)" value={ev.description ?? ""} onChange={(e) => setEv({ ...ev, description: e.target.value })} />
            <div>
              <span className="mb-1 block text-xs text-slate-600">Folder name</span>
              <input className="input font-mono text-xs" value={slug} disabled={!!sourceSlug} onChange={(e) => setEv({ ...ev, slug: slugify(e.target.value) })} />
            </div>
            <div>
              <span className="mb-1 block text-xs text-slate-600">Sort order (higher shows first)</span>
              <input className="input" type="number" value={ev.order ?? 0} onChange={(e) => setEv({ ...ev, order: Number(e.target.value) })} />
            </div>
          </section>

          <section className="card p-4">
            <h2 className="label">Data columns</h2>
            <p className="mb-3 text-xs text-slate-500">What changes per person. Email is always available and isn&apos;t drawn.</p>
            <div className="space-y-3">
              {ev.columns.map((c, i) => (
                <div key={i} className="rounded-lg border border-slate-200 p-2">
                  <div className="flex gap-1">
                    <input className="input" value={c.label} placeholder="Label" onChange={(e) => patchColumn(i, { label: e.target.value })} />
                    <button
                      className="px-2 text-slate-400 hover:text-red-600"
                      aria-label="Remove column"
                      onClick={() => setEv({ ...ev, columns: ev.columns.filter((_, j) => j !== i) })}
                    >
                      ✕
                    </button>
                  </div>
                  <input className="input mt-1 font-mono text-xs" value={c.key} placeholder="key" onChange={(e) => patchColumn(i, { key: slugify(e.target.value).replace(/-/g, "_") })} />
                  <input
                    className="input mt-1 text-xs"
                    value={c.default ?? ""}
                    placeholder="Default value (optional)"
                    onChange={(e) => patchColumn(i, { default: e.target.value || undefined })}
                  />
                  <input
                    className="input mt-1 text-xs"
                    value={(c.aliases ?? []).join(", ")}
                    placeholder="Other Excel header names, comma separated"
                    onChange={(e) => patchColumn(i, { aliases: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                  />
                </div>
              ))}
            </div>
            <button
              className="btn-ghost mt-3 w-full py-1.5"
              onClick={() => setEv({ ...ev, columns: [...ev.columns, { key: `field_${ev.columns.length + 1}`, label: "New field" }] })}
            >
              + Add column
            </button>
          </section>

          <section className="card p-4">
            <h2 className="label">Sample text for preview</h2>
            <div className="space-y-2">
              {ev.columns.map((c) => (
                <input
                  key={c.key}
                  className="input"
                  placeholder={c.label}
                  value={samples[c.key] ?? ""}
                  onChange={(e) => setSamples({ ...samples, [c.key]: e.target.value })}
                />
              ))}
            </div>
          </section>
        </aside>

        {/* ------------ middle: canvas ------------ */}
        <section className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {ev.variants.map((v, i) => (
              <button
                key={v.id}
                onClick={() => {
                  setVIdx(i);
                  setFIdx(null);
                }}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${i === vIdx ? "bg-navy-800 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"}`}
              >
                {v.label}
              </button>
            ))}
            <button className="btn-gold py-1.5" onClick={() => fileRef.current?.click()}>
              + Add design (PNG)
            </button>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg" multiple className="hidden" onChange={(e) => addDesign(e.target.files)} />
          </div>

          {!variant ? (
            <div
              className="card grid aspect-[1.414] place-items-center border-2 border-dashed border-slate-300 text-center text-slate-500"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                addDesign(e.dataTransfer.files);
              }}
            >
              <div>
                <p className="font-medium">Drop your blank certificate PNG here</p>
                <p className="text-sm">Export from Canva as PNG with the fill-in lines empty. Several designs (Winner / Participation…) can go in one event.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="card flex flex-wrap items-center gap-2 p-2 text-sm">
                <input className="input w-56" value={variant.label} onChange={(e) => patchVariant({ label: e.target.value })} title="Design name" />
                <span className="text-xs text-slate-400">
                  {variant.width}×{variant.height}px
                </span>
                <button className="btn-primary ml-auto py-1.5" onClick={() => addField()}>
                  + Text field
                </button>
                <label className="flex items-center gap-1 text-xs text-slate-600">
                  <input type="checkbox" checked={showBlanks} onChange={(e) => setShowBlanks(e.target.checked)} />
                  Show detected blanks ({blanks.length})
                </label>
                <button
                  className="px-2 text-xs text-red-600 hover:underline"
                  onClick={() => {
                    if (!window.confirm(`Remove design “${variant.label}”?`)) return;
                    setEv({ ...ev, variants: ev.variants.filter((_, i) => i !== vIdx) });
                    setVIdx(0);
                    setFIdx(null);
                  }}
                >
                  Remove design
                </button>
              </div>

              <div
                ref={wrapRef}
                className="relative select-none overflow-hidden rounded-lg shadow"
                onPointerMove={onMove}
                onPointerUp={endDrag}
                onPointerDown={() => setFIdx(null)}
              >
                <canvas ref={canvasRef} className="block w-full" />
                {showBlanks &&
                  blanks.map((b, i) => (
                    <button
                      key={i}
                      title={field ? "Snap selected field to this line" : "Create a field on this line"}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        snapTo(b);
                      }}
                      className="absolute rounded-sm bg-emerald-400/30 hover:bg-emerald-500/60"
                      style={{ left: b.x1 * scale, top: (b.y - 6) * scale, width: (b.x2 - b.x1) * scale, height: Math.max(6, 12 * scale) }}
                    />
                  ))}
                {variant.fields.map((f, i) => {
                  const top = (f.y - f.fontSize) * scale;
                  const h = f.fontSize * 1.25 * scale;
                  const active = i === fIdx;
                  return (
                    <div
                      key={i}
                      onPointerDown={(e) => startDrag(e, i, "move")}
                      className={`absolute cursor-move border ${active ? "border-gold-500 bg-gold-400/10" : "border-dashed border-sky-500/70 hover:bg-sky-400/10"}`}
                      style={{ left: f.x * scale, top, width: f.width * scale, height: h }}
                    >
                      <span className="pointer-events-none absolute -top-5 left-0 whitespace-nowrap rounded bg-navy-800 px-1.5 text-[10px] font-semibold text-white">
                        {labelOf(f.key)}
                      </span>
                      {/* baseline marker: text sits on this line */}
                      <span className="pointer-events-none absolute inset-x-0 border-t border-red-500/60" style={{ top: f.fontSize * scale }} />
                      {active && (
                        <>
                          <span onPointerDown={(e) => startDrag(e, i, "resize-l")} className="absolute -left-1.5 top-0 h-full w-3 cursor-ew-resize bg-gold-500/70" />
                          <span onPointerDown={(e) => startDrag(e, i, "resize-r")} className="absolute -right-1.5 top-0 h-full w-3 cursor-ew-resize bg-gold-500/70" />
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-slate-500">
                Drag boxes to move, drag the gold edges to resize, arrow keys nudge (Shift = 10px), Delete removes. The red line
                is the text baseline. Green bars are blank lines found on the image — click one to place or snap a field.
              </p>
            </>
          )}
        </section>

        {/* ------------ right: field props + export ------------ */}
        <aside className="space-y-4">
          <section className="card p-4">
            <h2 className="label">Selected field</h2>
            {!field ? (
              <p className="text-sm text-slate-500">Click a box on the certificate to edit it.</p>
            ) : (
              <div className="space-y-3 text-sm">
                <div>
                  <span className="mb-1 block text-xs text-slate-600">Shows column</span>
                  <select className="input" value={field.key} onChange={(e) => patchField({ key: e.target.value })}>
                    {ev.columns.map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <span className="mb-1 block text-xs text-slate-600">Font</span>
                  <select
                    className="input"
                    value={field.fontFamily}
                    onChange={(e) => {
                      const meta = FONTS.find((f) => f.family === e.target.value);
                      const weight = meta && !meta.weights.includes(field.fontWeight) ? meta.weights[meta.weights.length - 1] : field.fontWeight;
                      patchField({ fontFamily: e.target.value, fontWeight: weight, italic: meta?.italic ? field.italic : false });
                    }}
                  >
                    {FONTS.map((f) => (
                      <option key={f.family} value={f.family} style={{ fontFamily: f.family }}>
                        {f.family}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label>
                    <span className="mb-1 block text-xs text-slate-600">Size (px)</span>
                    <input className="input" type="number" min={8} value={field.fontSize} onChange={(e) => patchField({ fontSize: Math.max(8, Number(e.target.value)) })} />
                  </label>
                  <label>
                    <span className="mb-1 block text-xs text-slate-600">Weight</span>
                    <select className="input" value={field.fontWeight} onChange={(e) => patchField({ fontWeight: Number(e.target.value) })}>
                      {(fontMeta?.weights ?? [400, 700]).map((w) => (
                        <option key={w} value={w}>
                          {w === 400 ? "Regular" : w === 500 ? "Medium" : w === 600 ? "Semibold" : w === 700 ? "Bold" : w}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="mb-1 block text-xs text-slate-600">Colour</span>
                    <div className="flex gap-1">
                      <input type="color" className="h-8 w-9 shrink-0 cursor-pointer rounded border border-slate-300" value={field.color} onChange={(e) => patchField({ color: e.target.value })} />
                      <input className="input font-mono text-xs" value={field.color} onChange={(e) => patchField({ color: e.target.value })} />
                    </div>
                  </label>
                  <label>
                    <span className="mb-1 block text-xs text-slate-600">Letter spacing</span>
                    <input className="input" type="number" step={0.5} value={field.letterSpacing ?? 0} onChange={(e) => patchField({ letterSpacing: Number(e.target.value) || undefined })} />
                  </label>
                </div>
                <div>
                  <span className="mb-1 block text-xs text-slate-600">Align</span>
                  <div className="grid grid-cols-3 gap-1">
                    {(["left", "center", "right"] as const).map((a) => (
                      <button key={a} onClick={() => patchField({ align: a })} className={`rounded py-1 text-xs capitalize ring-1 ${field.align === a ? "bg-navy-800 text-white ring-navy-800" : "ring-slate-300"}`}>
                        {a}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="mb-1 block text-xs text-slate-600">Letter case</span>
                  <select className="input" value={field.transform ?? "none"} onChange={(e) => patchField({ transform: e.target.value as FieldLayout["transform"] })}>
                    <option value="none">As typed</option>
                    <option value="title">Title Case (fixes ALL CAPS names)</option>
                    <option value="upper">UPPERCASE</option>
                  </select>
                </div>
                {fontMeta?.italic && (
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={!!field.italic} onChange={(e) => patchField({ italic: e.target.checked })} /> Italic
                  </label>
                )}
                <div className="grid grid-cols-3 gap-1 text-xs">
                  {(["x", "y", "width"] as const).map((k) => (
                    <label key={k}>
                      <span className="mb-0.5 block text-slate-500">{k}</span>
                      <input className="input px-1.5 py-1 text-xs" type="number" value={field[k]} onChange={(e) => patchField({ [k]: Number(e.target.value) })} />
                    </label>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    className="btn-ghost flex-1 py-1.5"
                    onClick={() => {
                      patchVariant({ fields: [...variant!.fields, { ...field, y: field.y + field.fontSize * 2 }] });
                      setFIdx(variant!.fields.length);
                    }}
                  >
                    Duplicate
                  </button>
                  <button
                    className="btn-ghost flex-1 py-1.5 text-red-600"
                    onClick={() => {
                      patchVariant({ fields: variant!.fields.filter((_, i) => i !== fIdx) });
                      setFIdx(null);
                    }}
                  >
                    Delete
                  </button>
                </div>
                {ev.variants.length > 1 && (
                  <button
                    className="w-full text-xs text-navy-600 hover:underline"
                    onClick={() =>
                      setEv((e) => ({
                        ...e,
                        variants: e.variants.map((v) => ({
                          ...v,
                          fields: v.fields.map((f) =>
                            f.key === field.key
                              ? { ...f, fontFamily: field.fontFamily, fontSize: field.fontSize, fontWeight: field.fontWeight, italic: field.italic, color: field.color, transform: field.transform, letterSpacing: field.letterSpacing }
                              : f,
                          ),
                        })),
                      }))
                    }
                  >
                    Copy this style to “{labelOf(field.key)}” on all designs
                  </button>
                )}
              </div>
            )}
          </section>

          <section className="card space-y-2 p-4">
            <h2 className="label">Email</h2>
            <input className="input" value={ev.email.subject} onChange={(e) => setEv({ ...ev, email: { ...ev.email, subject: e.target.value } })} />
            <textarea className="input h-36 font-mono text-xs" value={ev.email.body} onChange={(e) => setEv({ ...ev, email: { ...ev.email, body: e.target.value } })} />
            <p className="text-xs text-slate-500">Use {"{Name}"}, {"{Event}"}, {"{Type}"} or any column label in braces.</p>
          </section>

          <section className="card space-y-3 p-4">
            <h2 className="label">Save</h2>
            {problems.length > 0 && (
              <ul className="list-disc space-y-0.5 pl-4 text-xs text-amber-700">
                {problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            )}
            <button className="btn-gold w-full" disabled={problems.length > 0} onClick={exportZip}>
              Download template folder (.zip)
            </button>
            <button className="btn-ghost w-full" disabled={!ev.variants.length} onClick={copyJson}>
              Copy event.json
            </button>
            <p className="text-xs text-slate-500">
              Unzip into <code>public/templates/</code>, commit and push to GitHub. Vercel redeploys in about a minute and the event
              appears on the home page.
            </p>
          </section>
        </aside>
      </div>
    </main>
  );
}
