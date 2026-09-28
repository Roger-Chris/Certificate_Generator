/** Certificate design model. Everything is in design pixels (A4 landscape = 2000 × 1414). */

export interface ElementBase {
  id: string;
  name?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation?: number;
  opacity?: number;
  locked?: boolean;
  hidden?: boolean;
  /** Auto-spacing row (e.g. "logos"): members are centred on the page with equal gaps. */
  row?: string;
}

export type Align = "left" | "center" | "right" | "justify";

export interface TextElement extends ElementBase {
  type: "text";
  /** Rich text (b/i/u/sup/span…). `{Field}` tokens are filled per person. */
  html: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  italic?: boolean;
  color: string;
  /** Two-colour gradient fill, e.g. gold lettering. */
  gradient?: [string, string] | null;
  align: Align;
  valign?: "top" | "middle" | "bottom";
  lineHeight: number;
  letterSpacing?: number;
  uppercase?: boolean;
  /** Shrink the font when the filled-in text doesn't fit the box. */
  autoFit?: boolean;
}

export interface ImageElement extends ElementBase {
  type: "image";
  src: string;
  fit: "contain" | "cover" | "fill";
}

export interface ShapeElement extends ElementBase {
  type: "shape";
  shape: "rect" | "ellipse";
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  radius?: number;
}

export type DesignElement = TextElement | ImageElement | ShapeElement;

export type FieldCase = "none" | "title" | "upper";

export interface Design {
  id: string;
  name: string;
  /** Designs with the same event are offered together when generating (Winner / Participation …). */
  event: string;
  width: number;
  height: number;
  background: string;
  backgroundImage?: string | null;
  elements: DesignElement[];
  /** Gap in px between items of each auto-spacing row. */
  rowGaps?: Record<string, number>;
  /** Per-field options keyed by field name ("Name"). */
  fields?: Record<string, { case?: FieldCase; sample?: string }>;
  email: { subject: string; body: string };
  updatedAt?: string;
}

export const SIZES = [
  { label: "A4 landscape", width: 2000, height: 1414 },
  { label: "A4 portrait", width: 1414, height: 2000 },
  { label: "16:9 widescreen", width: 1920, height: 1080 },
  { label: "US Letter landscape", width: 2000, height: 1545 },
];

export const DEFAULT_EMAIL = {
  subject: "Your {Event} certificate",
  body:
    "Dear {Name},\n\nGreetings from Rajalakshmi Institute of Technology.\n\nPlease find attached your certificate for {Event}.\n\nThank you for being part of it.\n\nRegards,\nRajalakshmi Institute of Technology, Chennai",
};

/** A fill-in field token styled like the blank lines on printed certificates: bold with a coloured underline. */
export const fieldHtml = (name: string, line = "#c8912e") =>
  `<span style="font-weight: 700; text-decoration-line: underline; text-decoration-color: ${line}; text-decoration-thickness: 2px; text-underline-offset: 8px">{${name}}</span>`;

export const newId = () =>Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

// ---------------------------------------------------------------- fields / placeholders

const TOKEN = /\{([^{}<>\n]{1,40})\}/g;
export const normKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Field names used in the design's text, in order of first appearance, de-duplicated case-insensitively. */
export function designFields(d: Pick<Design, "elements">): string[] {
  const seen = new Map<string, string>();
  for (const el of d.elements) {
    if (el.type !== "text") continue;
    for (const m of el.html.matchAll(TOKEN)) {
      const name = decodeEntities(m[1].trim());
      if (name && !seen.has(normKey(name))) seen.set(normKey(name), name);
    }
  }
  return [...seen.values()];
}

const DEFAULT_SAMPLES: Record<string, string> = {
  name: "Dr. Lakshmi Narayanan",
  department: "Computer Science and Engineering",
  position: "First",
  title: "Smart Irrigation Controller Using IoT Sensors",
  event: "Origami Challenge",
  date: "29.04.2026",
};
export const sampleFor = (d: Design, field: string) =>
  d.fields?.[field]?.sample ?? DEFAULT_SAMPLES[normKey(field)] ?? field;

export const caseFor = (d: Design, field: string): FieldCase =>
  d.fields?.[field]?.case ?? (normKey(field) === "name" ? "title" : "none");

export function applyCase(text: string, c: FieldCase | undefined): string {
  const s = text.trim().replace(/\s+/g, " ");
  if (c === "upper") return s.toUpperCase();
  if (c === "title") return s.toLowerCase().replace(/(^|[\s.\-'(])(\p{L})/gu, (_, sep, ch) => sep + ch.toUpperCase());
  return s;
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
function decodeEntities(s: string) {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");
}

/**
 * Replace `{Field}` tokens with values (HTML-escaped). `values` keys are matched case-insensitively.
 * Unknown tokens are left visible so mistakes show up in the preview.
 */
export function fillHtml(html: string, d: Design, values: Record<string, string>): string {
  const byKey = new Map(Object.entries(values).map(([k, v]) => [normKey(k), v]));
  return html.replace(TOKEN, (m, raw: string) => {
    const name = decodeEntities(raw.trim());
    const v = byKey.get(normKey(name));
    return v === undefined ? m : escapeHtml(applyCase(v, caseFor(d, name)));
  });
}

export function fillText(text: string, values: Record<string, string>): string {
  const byKey = new Map(Object.entries(values).map(([k, v]) => [normKey(k), v]));
  return text.replace(TOKEN, (m, raw: string) => byKey.get(normKey(raw.trim())) ?? m);
}

// ---------------------------------------------------------------- rich-text sanitising

const ALLOWED_TAGS = new Set(["B", "STRONG", "I", "EM", "U", "S", "SUP", "SUB", "BR", "SPAN", "DIV", "P", "FONT"]);
const ALLOWED_STYLES = [
  "color",
  "font-weight",
  "font-style",
  "font-size",
  "font-family",
  "letter-spacing",
  "text-decoration",
  "text-decoration-line",
  "text-decoration-color",
  "text-decoration-thickness",
  "text-underline-offset",
  "background-color",
  "text-align",
];

/** Keep only simple formatting markup (runs in the browser; used on every render and when saving edits). */
export function sanitizeHtml(html: string): string {
  if (typeof DOMParser === "undefined") return html;
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const root = doc.body.firstElementChild as HTMLElement;
  const walk = (node: Element) => {
    for (const child of [...node.children]) {
      if (!ALLOWED_TAGS.has(child.tagName)) {
        // unwrap unknown elements but keep their text (script/style are dropped entirely)
        if (["SCRIPT", "STYLE", "IFRAME", "OBJECT", "IMG", "SVG"].includes(child.tagName)) child.remove();
        else {
          walk(child);
          child.replaceWith(...child.childNodes);
        }
        continue;
      }
      const el = child as HTMLElement;
      const color = el.tagName === "FONT" ? el.getAttribute("color") : null;
      const style = el.style;
      const kept = ALLOWED_STYLES.map((p) => [p, style.getPropertyValue(p)] as const).filter(([, v]) => v && !/url\(|expression/i.test(v));
      for (const attr of [...el.attributes]) el.removeAttribute(attr.name);
      for (const [p, v] of kept) el.style.setProperty(p, v);
      if (color) el.style.color = color;
      walk(el);
    }
  };
  walk(root);
  return root.innerHTML;
}

/** Families + weights a design needs, so they can be loaded before rendering to an image. */
export function fontsUsed(d: Design): { family: string; weight: number; italic: boolean }[] {
  const out = new Map<string, { family: string; weight: number; italic: boolean }>();
  const add = (family: string, weight: number, italic: boolean) => out.set(`${family}|${weight}|${italic}`, { family, weight, italic });
  for (const el of d.elements) {
    if (el.type !== "text") continue;
    add(el.fontFamily, el.fontWeight, !!el.italic);
    if (/<(b|strong)\b|font-weight/i.test(el.html)) add(el.fontFamily, 700, !!el.italic);
    if (/<(i|em)\b|font-style/i.test(el.html)) add(el.fontFamily, el.fontWeight, true);
    for (const m of el.html.matchAll(/font-family:\s*([^;"]+)/gi)) add(m[1].replace(/["']/g, "").split(",")[0].trim(), 400, false);
  }
  return [...out.values()];
}
