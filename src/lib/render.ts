"use client";

import { PDFDocument } from "pdf-lib";
import type { FieldLayout, TextTransform, Variant } from "./types";

const imageCache = new Map<string, Promise<HTMLImageElement>>();

export function loadImage(src: string): Promise<HTMLImageElement> {
  let p = imageCache.get(src);
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Could not load template image ${src}`));
      img.src = src;
    });
    imageCache.set(src, p);
    p.catch(() => imageCache.delete(src));
  }
  return p;
}

export function applyTransform(text: string, t: TextTransform | undefined): string {
  const s = text.trim().replace(/\s+/g, " ");
  if (t === "upper") return s.toUpperCase();
  if (t === "title") {
    // Capitalise after spaces, dots, hyphens and apostrophes so "R.MAHESWARI" -> "R.Maheswari".
    return s.toLowerCase().replace(/(^|[\s.\-'(])(\p{L})/gu, (_, sep, ch) => sep + ch.toUpperCase());
  }
  return s;
}

export const fontString = (f: Pick<FieldLayout, "italic" | "fontWeight" | "fontFamily">, size: number) =>
  `${f.italic ? "italic " : ""}${f.fontWeight} ${size}px "${f.fontFamily}"`;

/** Make sure every font a variant uses is downloaded before drawing — canvas won't wait. */
export async function ensureFonts(fields: FieldLayout[]) {
  await Promise.all(fields.map((f) => document.fonts.load(fontString(f, f.fontSize), "AaBb"))).catch(() => {});
}

export interface FieldResult {
  key: string;
  /** 1 = drawn at configured size; < 1 = shrunk to fit the box. */
  scale: number;
}

export function drawFields(
  ctx: CanvasRenderingContext2D,
  fields: FieldLayout[],
  values: Record<string, string>,
): FieldResult[] {
  const results: FieldResult[] = [];
  for (const f of fields) {
    const text = applyTransform(values[f.key] ?? "", f.transform);
    if (!text) continue;
    let size = f.fontSize;
    const min = f.fontSize * 0.35;
    ctx.fillStyle = f.color;
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
    const spacing = f.letterSpacing ?? 0;
    const measure = () => {
      ctx.font = fontString(f, size);
      ctx.letterSpacing = `${spacing * (size / f.fontSize)}px`;
      return ctx.measureText(text).width;
    };
    let w = measure();
    while (w > f.width && size > min) {
      size = Math.max(min, size * 0.96);
      w = measure();
    }
    const x = f.align === "center" ? f.x + (f.width - w) / 2 : f.align === "right" ? f.x + f.width - w : f.x;
    ctx.fillText(text, x, f.y);
    results.push({ key: f.key, scale: size / f.fontSize });
  }
  ctx.letterSpacing = "0px";
  return results;
}

export async function renderCertificate(
  variant: Variant,
  imageUrl: string,
  values: Record<string, string>,
): Promise<{ canvas: HTMLCanvasElement; fields: FieldResult[] }> {
  const [img] = await Promise.all([loadImage(imageUrl), ensureFonts(variant.fields)]);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  const sx = img.naturalWidth / variant.width;
  const sy = img.naturalHeight / variant.height;
  if (sx !== 1 || sy !== 1) ctx.scale(sx, sy);
  const fields = drawFields(ctx, variant.fields, values);
  return { canvas, fields };
}

/** A4-width PDF page (842pt long side) with the certificate as a single high-quality image. */
export async function canvasToPdf(canvas: HTMLCanvasElement, title: string): Promise<Uint8Array> {
  const blob = await new Promise<Blob>((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error("Canvas export failed"))), "image/jpeg", 0.93),
  );
  const pdf = await PDFDocument.create();
  pdf.setTitle(title);
  pdf.setCreator("RIT Certificate Generator");
  const jpg = await pdf.embedJpg(await blob.arrayBuffer());
  const landscape = canvas.width >= canvas.height;
  const pageW = landscape ? 842 : 842 * (canvas.width / canvas.height);
  const pageH = pageW * (canvas.height / canvas.width);
  const page = pdf.addPage([pageW, pageH]);
  page.drawImage(jpg, { x: 0, y: 0, width: pageW, height: pageH });
  return pdf.save();
}

export function safeFileName(name: string): string {
  const s = name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "").replace(/\s+/g, " ").trim().slice(0, 100);
  return s || "certificate";
}
