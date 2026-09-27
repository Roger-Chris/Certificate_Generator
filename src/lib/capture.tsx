"use client";

import { domToCanvas } from "modern-screenshot";
import { PDFDocument } from "pdf-lib";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import CertificateView from "@/components/CertificateView";
import { type Design, fontsUsed } from "./design";

/** Renders designs off-screen at full size and turns them into images / PDFs. */

let host: HTMLDivElement | null = null;
let root: Root | null = null;

function getRoot() {
  if (!host) {
    host = document.createElement("div");
    host.setAttribute("aria-hidden", "true");
    // Off-screen but still laid out and painted (display:none would break measuring and capture).
    host.style.cssText = "position:fixed;left:-100000px;top:0;pointer-events:none;z-index:-1;";
    document.body.appendChild(host);
    root = createRoot(host);
  }
  return { host, root: root! };
}

export async function loadDesignFonts(d: Design) {
  await Promise.all(
    fontsUsed(d).map((f) => document.fonts.load(`${f.italic ? "italic " : ""}${f.weight} 40px "${f.family}"`, "AaBb123").catch(() => [])),
  );
}

const imageReady = (img: HTMLImageElement) =>
  img.complete && img.naturalWidth > 0
    ? Promise.resolve()
    : new Promise<void>((resolve) => {
        img.addEventListener("load", () => resolve(), { once: true });
        img.addEventListener("error", () => resolve(), { once: true });
      });

export async function renderToCanvas(design: Design, values: Record<string, string>): Promise<HTMLCanvasElement> {
  // Fonts first, so auto-fit measures with the real typeface during the render below.
  await loadDesignFonts(design);
  const { host, root } = getRoot();
  flushSync(() => root.render(<CertificateView design={design} values={values} />));
  const node = host.firstElementChild as HTMLElement;
  await Promise.all([...node.querySelectorAll("img")].map(imageReady));
  await new Promise((r) => requestAnimationFrame(() => r(null)));
  return domToCanvas(node, {
    width: design.width,
    height: design.height,
    scale: 1,
    backgroundColor: design.background,
  });
}

/** One page, A4 width (842pt on the long side), certificate as a high-quality JPEG. */
export async function canvasToPdf(canvas: HTMLCanvasElement, title: string): Promise<Uint8Array> {
  const blob = await new Promise<Blob>((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error("Canvas export failed"))), "image/jpeg", 0.92),
  );
  const pdf = await PDFDocument.create();
  pdf.setTitle(title);
  pdf.setCreator("RIT Certificate Generator");
  const jpg = await pdf.embedJpg(await blob.arrayBuffer());
  const landscape = canvas.width >= canvas.height;
  const pageW = landscape ? 842 : 842 * (canvas.width / canvas.height);
  const pageH = pageW * (canvas.height / canvas.width);
  pdf.addPage([pageW, pageH]).drawImage(jpg, { x: 0, y: 0, width: pageW, height: pageH });
  return pdf.save();
}

export async function renderPdf(design: Design, values: Record<string, string>, title: string) {
  return canvasToPdf(await renderToCanvas(design, values), title);
}

export function safeFileName(name: string): string {
  const s = name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "").replace(/\s+/g, " ").trim().slice(0, 100);
  return s || "certificate";
}
