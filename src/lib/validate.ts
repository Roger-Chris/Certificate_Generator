import { type Design, type DesignElement, DEFAULT_EMAIL } from "./design";

/** Server-side shape check for designs coming from the browser. Throws with a readable message. */

const num = (v: unknown, name: string, min = -1e5, max = 1e5): number => {
  if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max) throw new Error(`Invalid ${name}`);
  return v;
};
const str = (v: unknown, name: string, max = 500): string => {
  if (typeof v !== "string" || v.length > max) throw new Error(`Invalid ${name}`);
  return v;
};
const optStr = (v: unknown, name: string, max = 500) => (v === undefined || v === null ? undefined : str(v, name, max));

/** Only our own files: bundled starter art or uploaded assets. Keeps renders from pulling third-party URLs. */
const src = (v: unknown): string => {
  const s = str(v, "image source", 300);
  if (!/^\/(assets\/[\w\-/]+\.(png|jpe?g|webp|gif)|api\/assets\/[\w-]+\.(png|jpe?g|webp|gif))$/i.test(s)) throw new Error("Images must come from the image library");
  return s;
};

function element(e: unknown): DesignElement {
  if (!e || typeof e !== "object") throw new Error("Invalid element");
  const o = e as Record<string, unknown>;
  const base = {
    id: str(o.id, "element id", 40),
    name: optStr(o.name, "element name", 80),
    x: num(o.x, "x"),
    y: num(o.y, "y"),
    w: num(o.w, "width", 1),
    h: num(o.h, "height", 1),
    rotation: o.rotation === undefined ? undefined : num(o.rotation, "rotation", -360, 360),
    opacity: o.opacity === undefined ? undefined : num(o.opacity, "opacity", 0, 1),
    locked: o.locked === true || undefined,
    hidden: o.hidden === true || undefined,
    row: typeof o.row === "string" && o.row.trim() ? o.row.trim().slice(0, 40) : undefined,
  };
  if (o.type === "text") {
    return {
      ...base,
      type: "text",
      html: str(o.html, "text", 20_000),
      fontFamily: str(o.fontFamily, "font", 80),
      fontSize: num(o.fontSize, "font size", 1, 2000),
      fontWeight: num(o.fontWeight, "font weight", 100, 900),
      italic: o.italic === true || undefined,
      color: str(o.color, "colour", 40),
      gradient: Array.isArray(o.gradient) && o.gradient.length === 2 ? [str(o.gradient[0], "gradient", 40), str(o.gradient[1], "gradient", 40)] : null,
      align: (["left", "center", "right", "justify"] as const).find((a) => a === o.align) ?? "left",
      valign: (["top", "middle", "bottom"] as const).find((a) => a === o.valign) ?? "top",
      lineHeight: num(o.lineHeight, "line height", 0.5, 5),
      letterSpacing: o.letterSpacing === undefined ? undefined : num(o.letterSpacing, "letter spacing", -50, 200),
      uppercase: o.uppercase === true || undefined,
      autoFit: o.autoFit === true || undefined,
    };
  }
  if (o.type === "image") {
    return { ...base, type: "image", src: src(o.src), fit: (["contain", "cover", "fill"] as const).find((f) => f === o.fit) ?? "contain" };
  }
  if (o.type === "shape") {
    return {
      ...base,
      type: "shape",
      shape: o.shape === "ellipse" ? "ellipse" : "rect",
      fill: str(o.fill, "fill", 40),
      stroke: optStr(o.stroke, "stroke", 40),
      strokeWidth: o.strokeWidth === undefined ? undefined : num(o.strokeWidth, "stroke width", 0, 200),
      radius: o.radius === undefined ? undefined : num(o.radius, "radius", 0, 2000),
    };
  }
  throw new Error("Unknown element type");
}

export function validateDesign(v: unknown): Design {
  if (!v || typeof v !== "object") throw new Error("Missing design");
  if (JSON.stringify(v).length > 1_500_000) throw new Error("Design is too large");
  const o = v as Record<string, unknown>;
  if (!Array.isArray(o.elements) || o.elements.length > 400) throw new Error("Invalid elements");
  const fields: Design["fields"] = {};
  if (o.fields && typeof o.fields === "object") {
    for (const [k, f] of Object.entries(o.fields as Record<string, { case?: string; sample?: string }>).slice(0, 50)) {
      fields[k.slice(0, 40)] = {
        case: f?.case === "title" || f?.case === "upper" || f?.case === "none" ? f.case : undefined,
        sample: optStr(f?.sample, "sample", 200),
      };
    }
  }
  const rowGaps: Record<string, number> = {};
  if (o.rowGaps && typeof o.rowGaps === "object")
    for (const [k, g] of Object.entries(o.rowGaps as Record<string, unknown>).slice(0, 30)) rowGaps[k.slice(0, 40)] = num(g, "row gap", 0, 2000);
  const email = (o.email ?? {}) as Record<string, unknown>;
  return {
    id: typeof o.id === "string" ? o.id.slice(0, 40) : "",
    name: str(o.name, "name", 120).trim() || "Untitled design",
    event: (optStr(o.event, "event", 120) ?? "").trim(),
    width: num(o.width, "width", 100, 6000),
    height: num(o.height, "height", 100, 6000),
    background: str(o.background ?? "#ffffff", "background", 40),
    backgroundImage: o.backgroundImage ? src(o.backgroundImage) : null,
    elements: o.elements.map(element),
    rowGaps,
    fields,
    email: {
      subject: optStr(email.subject, "email subject", 300) ?? DEFAULT_EMAIL.subject,
      body: optStr(email.body, "email body", 10_000) ?? DEFAULT_EMAIL.body,
    },
  };
}
