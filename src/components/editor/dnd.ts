import type { DesignElement, ImageElement } from "@/lib/design";
import { newId } from "@/lib/design";

/** Drag-and-drop from the side panel onto the page. */
export const DND_MIME = "application/x-certificate-item";

export type DropPayload =
  | { kind: "element"; el: DesignElement }
  | { kind: "image"; src: string; name: string; w?: number; h?: number };

export function setDragPayload(e: React.DragEvent, payload: DropPayload) {
  e.dataTransfer.setData(DND_MIME, JSON.stringify(payload));
  e.dataTransfer.effectAllowed = "copy";
}

/** An image element at a sensible size: natural size, but no bigger than 40% of the page. */
export function imageElement(img: { src: string; name: string; w: number; h: number }, pageW: number, pageH: number): ImageElement {
  const s = Math.min(1, (pageW * 0.4) / img.w, (pageH * 0.4) / img.h);
  const w = Math.round(img.w * s);
  const h = Math.round(img.h * s);
  return { type: "image", id: newId(), name: img.name, src: img.src, x: Math.round((pageW - w) / 2), y: Math.round((pageH - h) / 2), w, h, fit: "contain" };
}

export const naturalSize = (src: string) =>
  new Promise<{ w: number; h: number }>((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve({ w: 400, h: 300 });
    img.src = src;
  });

export async function uploadImage(file: File): Promise<{ key: string; name: string; url: string }> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/assets", { method: "POST", body: fd });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Upload failed");
  return data.asset;
}
