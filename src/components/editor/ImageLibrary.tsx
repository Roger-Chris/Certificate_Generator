"use client";

import { useEffect, useRef, useState } from "react";
import { BACKGROUNDS, BRAND_ASSETS } from "@/lib/brand";
import { naturalSize, setDragPayload, uploadImage } from "./dnd";

export interface PickedImage {
  src: string;
  w: number;
  h: number;
  name: string;
}

interface Upload {
  key: string;
  name: string;
  url: string;
}

/** Uploads + the RIT artwork library. Clicking an image calls onPick with its natural size. */
export default function ImageLibrary({ onPick, showBackgrounds = true }: { onPick: (img: PickedImage, kind: "image" | "background") => void; showBackgrounds?: boolean }) {
  const [uploads, setUploads] = useState<Upload[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/assets")
      .then((r) => r.json())
      .then((d) => setUploads(d.assets ?? []))
      .catch(() => setUploads([]));
  }, []);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    for (const f of Array.from(files)) {
      try {
        const asset = await uploadImage(f);
        setUploads((u) => [asset, ...(u ?? [])]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed");
      }
    }
    setBusy(false);
    if (input.current) input.current.value = "";
  };

  const remove = async (u: Upload) => {
    if (!window.confirm(`Delete “${u.name}” from your uploads? Designs using it will show a blank space.`)) return;
    await fetch(`/api/assets/${u.key}`, { method: "DELETE" });
    setUploads((list) => list?.filter((x) => x.key !== u.key) ?? null);
  };

  const pick = async (src: string, name: string, kind: "image" | "background", size?: { w: number; h: number }) => {
    const s = size ?? (await naturalSize(src));
    onPick({ src, name, ...s }, kind);
  };

  const groups = ["Logos", "Signatures", "Seals"];
  return (
    <div className="space-y-4">
      <div>
        <button className="btn-primary w-full" disabled={busy} onClick={() => input.current?.click()}>
          {busy ? "Uploading…" : "Upload image"}
        </button>
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple className="hidden" onChange={(e) => upload(e.target.files)} />
        <p className="mt-1 text-[11px] text-slate-500">
          PNG with a transparent background works best for logos and signatures. Click an image to add it, drag it onto the
          certificate, or drop files from your computer straight onto the page.
        </p>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </div>

      {uploads && uploads.length > 0 && (
        <section>
          <h3 className="label">Your uploads</h3>
          <div className="grid grid-cols-2 gap-2">
            {uploads.map((u) => (
              <div key={u.key} className="group relative">
                <button draggable onDragStart={(e) => setDragPayload(e, { kind: "image", src: u.url, name: u.name })} onClick={() => pick(u.url, u.name, "image")} className="checker grid h-20 w-full place-items-center rounded border border-slate-200 p-1 hover:border-gold-500" title={u.name}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={u.url} alt={u.name} className="max-h-full max-w-full object-contain" />
                </button>
                <button onClick={() => remove(u)} className="absolute right-1 top-1 hidden rounded bg-white/90 px-1 text-xs text-red-600 group-hover:block" aria-label="Delete upload">
                  ✕
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {groups.map((g) => (
        <section key={g}>
          <h3 className="label">{g}</h3>
          <div className="grid grid-cols-2 gap-2">
            {BRAND_ASSETS.filter((a) => a.group === g).map((a) => (
              <button key={a.src} draggable onDragStart={(e) => setDragPayload(e, { kind: "image", src: a.src, name: a.name, w: a.w, h: a.h })} onClick={() => pick(a.src, a.name, "image", { w: a.w, h: a.h })} className="checker grid h-20 place-items-center rounded border border-slate-200 p-1 hover:border-gold-500" title={a.name}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.src} alt={a.name} className="max-h-full max-w-full object-contain" />
              </button>
            ))}
          </div>
        </section>
      ))}

      {showBackgrounds && (
        <section>
          <h3 className="label">Backgrounds</h3>
          <p className="mb-2 text-[11px] text-slate-500">Sets the page background. Uploaded images can be used too.</p>
          <div className="grid grid-cols-2 gap-2">
            {BACKGROUNDS.map((b) => (
              <button key={b.src} onClick={() => pick(b.src, b.name, "background", { w: b.w, h: b.h })} className="overflow-hidden rounded border border-slate-200 hover:border-gold-500" title={b.name}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={b.src} alt={b.name} className="aspect-[1.414] w-full object-cover" />
              </button>
            ))}
            {uploads?.map((u) => (
              <button key={`bg-${u.key}`} onClick={() => pick(u.url, u.name, "background")} className="overflow-hidden rounded border border-dashed border-slate-300 hover:border-gold-500" title={`Use ${u.name} as background`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={u.url} alt={u.name} className="aspect-[1.414] w-full object-cover" />
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
