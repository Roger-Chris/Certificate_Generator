"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from "react";
import { type Design, type DesignElement, designFields, newId, sampleFor } from "@/lib/design";
import { gapOf, layoutRow, layoutRows, pinGap, rowNames } from "@/lib/rows";
import { type DropPayload, imageElement, naturalSize, uploadImage } from "./dnd";
import ImageLibrary, { type PickedImage } from "./ImageLibrary";
import Inspector from "./Inspector";
import SidePanel from "./SidePanel";
import Stage, { STAGE_PAD } from "./Stage";

type SaveState = "saved" | "dirty" | "saving" | "error" | "conflict";

const strip = (d: Design) => {
  const { updatedAt: _u, ...rest } = d;
  void _u;
  return JSON.stringify(rest);
};

const isTyping = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  return !!el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
};

export default function Editor({ id }: { id: string }) {
  const [design, setDesignState] = useState<Design | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(0.4);
  const [fitMode, setFitMode] = useState(true);
  const [showSamples, setShowSamples] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [picker, setPicker] = useState<null | "element" | "background">(null);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [, rerender] = useReducer((x: number) => x + 1, 0);

  const cur = useRef<Design | null>(null);
  const past = useRef<Design[]>([]);
  const future = useRef<Design[]>([]);
  const lastKey = useRef<{ key: string | null; t: number }>({ key: null, t: 0 });
  const gestureSnap = useRef<Design | null>(null);
  const gestureId = useRef<string | null>(null);
  const savedJson = useRef("");
  const updatedAt = useRef<string | undefined>(undefined);
  const clipboard = useRef<DesignElement | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  const setDesign = (d: Design) => {
    cur.current = d;
    setDesignState(d);
  };

  // ---------------------------------------------------------------- load
  useEffect(() => {
    fetch(`/api/designs/${id}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Could not load design");
        const { updatedAt: u, ...d } = data.design as Design;
        updatedAt.current = u;
        savedJson.current = strip(d as Design);
        setDesign(d as Design);
      })
      .catch((e) => setLoadError(e.message));
  }, [id]);

  useEffect(() => {
    if (design) document.title = `${design.name} · Editor`;
  }, [design?.name]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------- history
  const commit = useCallback((next: Design, key?: string) => {
    const now = Date.now();
    const prev = cur.current!;
    const coalesce = key && lastKey.current.key === key && now - lastKey.current.t < 800;
    if (!coalesce) {
      past.current.push(prev);
      if (past.current.length > 200) past.current.shift();
    }
    lastKey.current = { key: key ?? null, t: now };
    future.current = [];
    setDesign(next);
  }, []);

  const undo = () => {
    const prev = past.current.pop();
    if (!prev) return;
    future.current.push(cur.current!);
    lastKey.current = { key: null, t: 0 };
    setEditingId(null);
    setDesign(prev);
  };
  const redo = () => {
    const next = future.current.pop();
    if (!next) return;
    past.current.push(cur.current!);
    lastKey.current = { key: null, t: 0 };
    setDesign(next);
  };

  const patchEl = (elId: string, patch: Partial<DesignElement>, key?: string) => {
    let d = cur.current!;
    const prev = d.elements.find((e) => e.id === elId);
    // Showing/hiding, resizing or moving between rows re-centres the affected auto-spacing rows.
    const rows = [prev?.row, "row" in patch ? patch.row : undefined].filter(Boolean) as string[];
    const relayout = rows.length > 0 && ["hidden", "w", "h", "row"].some((k) => k in patch);
    if (relayout) for (const r of rows) d = pinGap(d, r);
    let next: Design = { ...d, elements: d.elements.map((e) => (e.id === elId ? ({ ...e, ...patch } as DesignElement) : e)) };
    if (relayout) next = layoutRows(next, rows);
    commit(next, key ? `${elId}:${key}` : undefined);
  };
  const setRowGap = (row: string, gap: number) => {
    const d = cur.current!;
    commit(layoutRow({ ...d, rowGaps: { ...d.rowGaps, [row]: gap } }, row), `gap:${row}`);
  };
  const patchDesign = (patch: Partial<Design>, key?: string) => commit({ ...cur.current!, ...patch }, key ? `design:${key}` : undefined);

  const live = (elId: string, patch: Partial<DesignElement>) => {
    const d = cur.current!;
    setDesign({ ...d, elements: d.elements.map((e) => (e.id === elId ? ({ ...e, ...patch } as DesignElement) : e)) });
  };
  const gestureStart = (elId: string) => {
    gestureSnap.current = cur.current;
    gestureId.current = elId;
  };
  const gestureEnd = () => {
    const snap = gestureSnap.current;
    gestureSnap.current = null;
    // A row member that was dragged or resized snaps back into its row (dragging sideways reorders the row).
    const moved = cur.current!.elements.find((e) => e.id === gestureId.current);
    if (snap && moved?.row) {
      const d = cur.current!;
      const withGap = d.rowGaps?.[moved.row] === undefined ? { ...d, rowGaps: { ...d.rowGaps, [moved.row]: gapOf(snap, moved.row) } } : d;
      setDesign(layoutRow(withGap, moved.row));
    }
    gestureId.current = null;
    if (snap && snap !== cur.current && strip(snap) !== strip(cur.current!)) {
      past.current.push(snap);
      future.current = [];
      lastKey.current = { key: null, t: 0 };
      rerender();
    }
  };

  // ---------------------------------------------------------------- element actions
  const addElement = (el: DesignElement) => {
    let d = cur.current!;
    if (el.row) d = pinGap(d, el.row);
    let next: Design = { ...d, elements: [...d.elements, el] };
    if (el.row) next = layoutRow(next, el.row);
    commit(next);
    setSelectedId(el.id);
  };
  const removeSelected = () => {
    if (!selectedId) return;
    const el = cur.current!.elements.find((e) => e.id === selectedId);
    let d = cur.current!;
    if (el?.row) d = pinGap(d, el.row);
    let next: Design = { ...d, elements: d.elements.filter((e) => e.id !== selectedId) };
    if (el?.row) next = layoutRow(next, el.row);
    commit(next);
    setSelectedId(null);
  };

  // ---------------------------------------------------------------- drag & drop onto the page
  const [dropError, setDropError] = useState<string | null>(null);
  const placeAt = (el: DesignElement, at: { x: number; y: number }) => {
    const d = cur.current!;
    const x = Math.round(Math.max(0, Math.min(d.width - el.w, at.x - el.w / 2)));
    const y = Math.round(Math.max(0, Math.min(d.height - el.h, at.y - el.h / 2)));
    addElement({ ...el, id: newId(), x, y, row: undefined } as DesignElement);
  };
  const onDrop = async (payload: DropPayload | null, files: File[], at: { x: number; y: number }) => {
    const d = cur.current!;
    if (payload?.kind === "element") return placeAt(payload.el, at);
    if (payload?.kind === "image") {
      const size = payload.w && payload.h ? { w: payload.w, h: payload.h } : await naturalSize(payload.src);
      return placeAt(imageElement({ src: payload.src, name: payload.name, ...size }, d.width, d.height), at);
    }
    setDropError(null);
    for (const [i, f] of files.entries()) {
      try {
        const asset = await uploadImage(f);
        const size = await naturalSize(asset.url);
        placeAt(imageElement({ src: asset.url, name: asset.name, ...size }, d.width, d.height), { x: at.x + i * 40, y: at.y + i * 40 });
      } catch (e) {
        setDropError(`${f.name}: ${e instanceof Error ? e.message : "upload failed"}`);
      }
    }
  };
  const duplicate = (src?: DesignElement) => {
    const el = src ?? cur.current!.elements.find((e) => e.id === selectedId);
    if (!el) return;
    const copy = { ...structuredClone(el), id: newId(), x: el.x + 30, y: el.y + 30, locked: undefined } as DesignElement;
    addElement(copy);
  };
  const arrange = (elId: string, a: "front" | "forward" | "backward" | "back" | "up" | "down") => {
    const list = [...cur.current!.elements];
    const i = list.findIndex((e) => e.id === elId);
    if (i < 0) return;
    const [el] = list.splice(i, 1);
    const to = a === "front" ? list.length : a === "back" ? 0 : a === "forward" || a === "up" ? Math.min(list.length, i + 1) : Math.max(0, i - 1);
    list.splice(to, 0, el);
    commit({ ...cur.current!, elements: list });
  };
  const commitText = (elId: string, html: string) => {
    setEditingId(null);
    const el = cur.current!.elements.find((e) => e.id === elId);
    if (el?.type === "text" && el.html !== html) patchEl(elId, { html } as Partial<DesignElement>);
  };
  const setBackground = (img: PickedImage) => {
    const d = cur.current!;
    const sameShape = Math.abs(img.w / img.h - d.width / d.height) < 0.02;
    if (!sameShape && !window.confirm(`This background is ${img.w}×${img.h}; the design is ${d.width}×${d.height}. It will be stretched to fill the page. Continue?`)) return;
    patchDesign({ backgroundImage: img.src });
  };
  const pickImage = (img: PickedImage, kind: "image" | "background") => {
    if (picker === "background" || kind === "background") setBackground(img);
    else if (selectedId) {
      const el = cur.current!.elements.find((e) => e.id === selectedId);
      if (el?.type === "image") patchEl(el.id, { src: img.src, h: Math.round((el.w * img.h) / img.w), name: img.name } as Partial<DesignElement>);
    }
    setPicker(null);
  };

  // ---------------------------------------------------------------- saving (auto)
  const saving = useRef(false);
  const save = useCallback(async (force = false) => {
    const d = cur.current;
    if (!d || saving.current) return;
    const json = strip(d);
    if (json === savedJson.current && !force) return;
    saving.current = true;
    setSaveState("saving");
    try {
      const res = await fetch(`/api/designs/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ design: d, expectedUpdatedAt: force ? undefined : updatedAt.current }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409) {
        setSaveState("conflict");
        setSaveError(data.error);
        return;
      }
      if (!res.ok) throw new Error(data.error ?? `Save failed (${res.status})`);
      updatedAt.current = data.design.updatedAt;
      savedJson.current = json;
      setSaveError(null);
      setSaveState(strip(cur.current!) === json ? "saved" : "dirty");
    } catch (e) {
      setSaveState("error");
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      saving.current = false;
    }
  }, [id]);

  useEffect(() => {
    if (!design) return;
    if (strip(design) === savedJson.current) {
      if (saveState === "dirty") setSaveState("saved");
      return;
    }
    if (saveState === "conflict") return;
    if (saveState !== "saving") setSaveState("dirty");
    const t = setTimeout(() => {
      if (!gestureSnap.current && !editingId) save();
    }, 1500);
    return () => clearTimeout(t);
  }, [design, editingId, save]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (cur.current && strip(cur.current) !== savedJson.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  // ---------------------------------------------------------------- zoom
  const fitZoom = useCallback(() => {
    const s = scroller.current;
    const d = cur.current;
    if (!s || !d) return;
    const z = Math.min((s.clientWidth - STAGE_PAD * 2) / d.width, (s.clientHeight - STAGE_PAD * 2) / d.height);
    setZoom(Math.max(0.05, Math.min(2, z)));
  }, []);
  useLayoutEffect(() => {
    if (!fitMode) return;
    fitZoom();
    const s = scroller.current;
    if (!s) return;
    const ro = new ResizeObserver(fitZoom);
    ro.observe(s);
    return () => ro.disconnect();
  }, [fitMode, fitZoom, design?.width, design?.height, !!design]); // eslint-disable-line react-hooks/exhaustive-deps
  const zoomBy = (f: number) => {
    setFitMode(false);
    setZoom((z) => Math.max(0.05, Math.min(3, Math.round(z * f * 100) / 100)));
  };

  // ---------------------------------------------------------------- keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        (document.activeElement as HTMLElement | null)?.blur();
        save();
        return;
      }
      if (isTyping(e.target)) return;
      const d = cur.current;
      if (!d) return;
      const sel = d.elements.find((x) => x.id === selectedId);
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      } else if (mod && e.key.toLowerCase() === "d" && sel) {
        e.preventDefault();
        duplicate(sel);
      } else if (mod && e.key.toLowerCase() === "c" && sel) {
        clipboard.current = structuredClone(sel);
      } else if (mod && e.key.toLowerCase() === "v" && clipboard.current) {
        e.preventDefault();
        duplicate(clipboard.current);
      } else if ((e.key === "Delete" || e.key === "Backspace") && sel) {
        e.preventDefault();
        removeSelected();
      } else if (e.key === "Escape") {
        setSelectedId(null);
      } else if (e.key === "Enter" && sel?.type === "text" && !sel.locked) {
        e.preventDefault();
        setEditingId(sel.id);
      } else if (sel && !sel.locked && e.key.startsWith("Arrow")) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        patchEl(sel.id, { x: sel.x + dx, y: sel.y + dy }, "nudge");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const fields = useMemo(() => (design ? designFields(design) : []), [design]);
  const samples = useMemo(() => (design ? Object.fromEntries(fields.map((f) => [f, sampleFor(design, f)])) : {}), [design, fields]);

  if (loadError)
    return (
      <div className="grid min-h-screen place-items-center p-6 text-center">
        <div>
          <p className="mb-3 text-red-600">{loadError}</p>
          <Link href="/" className="btn-primary">
            Back to designs
          </Link>
        </div>
      </div>
    );
  if (!design) return <div className="grid min-h-screen place-items-center text-slate-500">Loading design…</div>;

  const selected = design.elements.find((e) => e.id === selectedId) ?? null;

  // Rich-text commands act on the current text selection inside the element being edited.
  const exec = (cmd: string, value?: string) => {
    document.execCommand("styleWithCSS", false, "true");
    document.execCommand(cmd, false, value);
  };
  const keepFocus = (e: React.MouseEvent) => e.preventDefault();

  const saveLabel = { saved: "All changes saved", dirty: "Unsaved changes…", saving: "Saving…", error: "Save failed", conflict: "Changed elsewhere" }[saveState];

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-100">
      {/* ------------------------------------------------ top bar */}
      <header className="flex h-14 shrink-0 items-center gap-3 bg-navy-800 px-3 text-white">
        <Link href="/" className="grid h-8 w-8 place-items-center rounded-md bg-gold-500 text-sm font-bold" title="Back to all designs">
          RIT
        </Link>
        <input
          className="w-72 rounded bg-transparent px-2 py-1 text-sm font-medium outline-none ring-1 ring-transparent hover:ring-white/30 focus:bg-white/10 focus:ring-white/50"
          value={design.name}
          onChange={(e) => patchDesign({ name: e.target.value }, "name")}
          aria-label="Design name"
        />
        <span className={`text-xs ${saveState === "error" || saveState === "conflict" ? "text-red-300" : "text-navy-100"}`}>{saveLabel}</span>
        <div className="ml-2 flex items-center gap-1">
          <button className={`rounded px-2 py-1 text-xs hover:bg-white/10 ${leftOpen ? "bg-white/15" : ""}`} onClick={() => setLeftOpen((v) => !v)} title="Show/hide the Add · Images · Layers panel">
            ◧ Panel
          </button>
          <button className={`rounded px-2 py-1 text-xs hover:bg-white/10 ${rightOpen ? "bg-white/15" : ""}`} onClick={() => setRightOpen((v) => !v)} title="Show/hide the properties panel">
            Properties ◨
          </button>
          <button className="rounded px-2 py-1 text-sm hover:bg-white/10 disabled:opacity-30" disabled={!past.current.length} onClick={undo} title="Undo (Ctrl+Z)">
            ↶
          </button>
          <button className="rounded px-2 py-1 text-sm hover:bg-white/10 disabled:opacity-30" disabled={!future.current.length} onClick={redo} title="Redo (Ctrl+Shift+Z)">
            ↷
          </button>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-navy-100" title="Show sample names instead of {Name} placeholders">
            <input type="checkbox" checked={showSamples} onChange={(e) => setShowSamples(e.target.checked)} /> Preview with sample data
          </label>
          <div className="flex items-center rounded bg-white/10 text-xs">
            <button className="px-2 py-1 hover:bg-white/10" onClick={() => zoomBy(1 / 1.2)} title="Zoom out">
              −
            </button>
            <button className="w-14 py-1 hover:bg-white/10" onClick={() => setFitMode(true)} title="Fit to screen">
              {Math.round(zoom * 100)}%
            </button>
            <button className="px-2 py-1 hover:bg-white/10" onClick={() => zoomBy(1.2)} title="Zoom in">
              +
            </button>
          </div>
          <button className="rounded bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20" onClick={() => save(saveState === "conflict")}>
            Save
          </button>
          <Link
            href={`/generate/${design.id}`}
            className="btn-gold py-1.5"
            onClick={async (e) => {
              if (strip(design) !== savedJson.current) {
                e.preventDefault();
                await save();
                window.location.href = `/generate/${design.id}`;
              }
            }}
          >
            Create certificates →
          </Link>
        </div>
      </header>

      {dropError && (
        <div className="flex items-center justify-between bg-red-50 px-4 py-2 text-sm text-red-800">
          {dropError}
          <button onClick={() => setDropError(null)}>✕</button>
        </div>
      )}
      {(saveState === "conflict" || saveState === "error") && (
        <div className="flex items-center gap-3 bg-red-50 px-4 py-2 text-sm text-red-800">
          <span>{saveError}</span>
          {saveState === "conflict" && (
            <>
              <button className="btn-ghost py-1" onClick={() => save(true)}>
                Keep my version
              </button>
              <button className="btn-ghost py-1" onClick={() => window.location.reload()}>
                Load their version
              </button>
            </>
          )}
          {saveState === "error" && (
            <button className="btn-ghost py-1" onClick={() => save()}>
              Try again
            </button>
          )}
        </div>
      )}

      {/* ------------------------------------------------ text formatting bar (while typing) */}
      {editingId && (
        <div className="flex h-11 shrink-0 items-center gap-1 border-b border-slate-200 bg-white px-3 text-sm" onMouseDown={keepFocus}>
          <span className="mr-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Selected text:</span>
          <button className="w-8 rounded py-1 font-bold hover:bg-slate-100" onClick={() => exec("bold")} title="Bold (Ctrl+B)">
            B
          </button>
          <button className="w-8 rounded py-1 italic hover:bg-slate-100" onClick={() => exec("italic")} title="Italic (Ctrl+I)">
            I
          </button>
          <button className="w-8 rounded py-1 underline hover:bg-slate-100" onClick={() => exec("underline")} title="Underline (Ctrl+U)">
            U
          </button>
          <button className="w-8 rounded py-1 hover:bg-slate-100" onClick={() => exec("superscript")} title="Superscript (1st, 2nd…)">
            x²
          </button>
          <label className="ml-1 flex items-center gap-1 rounded px-1.5 py-1 hover:bg-slate-100" title="Text colour">
            A
            <input type="color" className="h-5 w-6 cursor-pointer" onChange={(e) => exec("foreColor", e.target.value)} />
          </label>
          <button className="rounded px-2 py-1 hover:bg-slate-100" onClick={() => exec("removeFormat")} title="Clear formatting">
            Clear
          </button>
          <span className="mx-2 h-5 w-px bg-slate-200" />
          <span className="text-xs text-slate-500" title="Aligns only the line(s) the cursor is on">This line:</span>
          {(
            [
              ["justifyLeft", "Left", "M3 5h14M3 9h9M3 13h14M3 17h9"],
              ["justifyCenter", "Centre", "M3 5h14M6 9h8M3 13h14M6 17h8"],
              ["justifyRight", "Right", "M3 5h14M8 9h9M3 13h14M8 17h9"],
              ["justifyFull", "Justify", "M3 5h14M3 9h14M3 13h14M3 17h14"],
            ] as const
          ).map(([cmd, label, path]) => (
            <button key={cmd} className="grid h-7 w-8 place-items-center rounded hover:bg-slate-100" onClick={() => exec(cmd)} title={`${label}-align this line`}>
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d={path} />
              </svg>
            </button>
          ))}
          <span className="mx-2 h-5 w-px bg-slate-200" />
          <span className="text-xs text-slate-500">Insert field:</span>
          {["Name", "Department", "Position", "Title", "Date"].map((f) => (
            <button key={f} className="rounded-full border border-gold-400 px-2 py-0.5 text-xs text-gold-600 hover:bg-gold-100" onClick={() => exec("insertText", `{${f}}`)}>
              {`{${f}}`}
            </button>
          ))}
          <button
            className="rounded-full border border-dashed border-slate-400 px-2 py-0.5 text-xs text-slate-600"
            onClick={() => {
              const n = window.prompt("Field name (matches the Excel column heading)")?.replace(/[{}<>]/g, "").trim();
              if (n) exec("insertText", `{${n}}`);
            }}
          >
            + Custom
          </button>
          <button className="btn-primary ml-auto py-1" onClick={() => (document.activeElement as HTMLElement | null)?.blur()}>
            Done
          </button>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {leftOpen && <SidePanel
          design={design}
          selectedId={selectedId}
          onAdd={addElement}
          onSelect={setSelectedId}
          onPatch={(elId, patch) => patchEl(elId, patch)}
          onReorder={(elId, dir) => arrange(elId, dir)}
          onBackground={setBackground}
        />}
        <Stage
          design={design}
          zoom={zoom}
          values={showSamples ? samples : null}
          selectedId={selectedId}
          editingId={editingId}
          onSelect={(sid) => {
            setSelectedId(sid);
            if (sid !== editingId) (document.activeElement as HTMLElement | null)?.blur();
          }}
          onStartEdit={(sid) => {
            setSelectedId(sid);
            setEditingId(sid);
          }}
          onCommitText={commitText}
          onLive={live}
          onGestureStart={gestureStart}
          onGestureEnd={gestureEnd}
          onDrop={onDrop}
          scrollerRef={scroller}
        />
        {rightOpen && <Inspector
          design={design}
          el={selected}
          fields={fields}
          patchEl={(patch, key) => selected && patchEl(selected.id, patch, key)}
          patchDesign={patchDesign}
          arrange={(a) => selected && arrange(selected.id, a)}
          duplicate={() => duplicate()}
          remove={removeSelected}
          startEdit={() => selected && setEditingId(selected.id)}
          openPicker={setPicker}
          rows={rowNames(design)}
          rowGap={selected?.row ? gapOf(design, selected.row) : 0}
          setRowGap={setRowGap}
          recentreRow={(r) => commit(layoutRow(pinGap(cur.current!, r), r))}
        />}
      </div>

      {picker && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setPicker(null)}>
          <div className="card max-h-[85vh] w-full max-w-lg overflow-y-auto p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold text-navy-800">{picker === "background" ? "Choose a background" : "Replace image"}</h2>
              <button onClick={() => setPicker(null)}>✕</button>
            </div>
            <ImageLibrary onPick={pickImage} showBackgrounds={picker === "background"} />
          </div>
        </div>
      )}
    </div>
  );
}
