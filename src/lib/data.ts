import type { Column, EventTemplate, Row, Variant } from "./types";

export const EMAIL_KEY = "email";
export const VARIANT_KEY = "_variant";
export const IGNORE = "";

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export const newRow = (variant: string, values: Record<string, string> = {}): Row =>
  ({ ...values, _id: crypto.randomUUID(), _variant: variant }) as Row;

/** Guess which event column each spreadsheet header belongs to. */
export function autoMap(headers: string[], ev: EventTemplate): string[] {
  const used = new Set<string>();
  const targets: { key: string; names: string[] }[] = [
    { key: EMAIL_KEY, names: ["email", "e-mail", "mail", "email id", "mail id", "email address"] },
    { key: VARIANT_KEY, names: ["type", "certificate", "certificate type", "variant", "category", "design"] },
    ...ev.columns.map((c) => ({ key: c.key, names: [c.key, c.label, ...(c.aliases ?? [])] })),
  ];
  const pick = (h: string, exact: boolean) => {
    const n = norm(h);
    for (const t of targets) {
      if (used.has(t.key)) continue;
      if (t.names.some((x) => (exact ? norm(x) === n : n.includes(norm(x)) && norm(x).length >= 4))) return t.key;
    }
    return IGNORE;
  };
  // Exact matches first so "Name" doesn't get stolen by a fuzzy "Event name" match.
  const result = headers.map((h) => {
    const k = pick(h, true);
    if (k) used.add(k);
    return k;
  });
  return result.map((k, i) => {
    if (k) return k;
    const f = pick(headers[i], false);
    if (f) used.add(f);
    return f;
  });
}

/** First sheet of an .xlsx/.xls/.csv as a header row + string cells. SheetJS is loaded on demand. */
export async function readSpreadsheet(file: File): Promise<{ headers: string[]; rows: string[][] }> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) throw new Error("The file has no sheets");
  const all = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: "", blankrows: false });
  const cells = all.map((r) => r.map((c) => String(c ?? "").trim()));
  const headerIdx = cells.findIndex((r) => r.filter(Boolean).length >= 1);
  if (headerIdx < 0) throw new Error("The sheet is empty");
  const headers = cells[headerIdx].map((h, i) => h || `Column ${i + 1}`);
  const rows = cells.slice(headerIdx + 1).filter((r) => r.some(Boolean));
  return { headers, rows };
}

export function matchVariant(value: string, variants: Variant[]): string | undefined {
  const n = norm(value);
  if (!n) return undefined;
  return (
    variants.find((v) => norm(v.id) === n || norm(v.label) === n)?.id ??
    variants.find((v) => norm(v.label).includes(n) || n.includes(norm(v.label)))?.id
  );
}

/** Row values with "same for everyone" fallbacks applied. */
export function resolveValues(row: Row, columns: Column[], common: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const c of columns) out[c.key] = (row[c.key] ?? "").trim() || (common[c.key] ?? "").trim();
  out[EMAIL_KEY] = (row[EMAIL_KEY] ?? "").trim();
  return out;
}

/** Replace {Name}, {Event}, {Type} and any {Column label/key} placeholders. Unknown ones are left as-is. */
export function fillPlaceholders(
  text: string,
  values: Record<string, string>,
  ev: EventTemplate,
  variant: Variant,
): string {
  const lookup = new Map<string, string>([
    ["event", ev.name],
    ["type", variant.label],
    ["certificate", variant.label],
    ["email", values[EMAIL_KEY] ?? ""],
  ]);
  for (const c of ev.columns) {
    lookup.set(norm(c.key), values[c.key] ?? "");
    lookup.set(norm(c.label), values[c.key] ?? "");
  }
  return text.replace(/\{([^{}]+)\}/g, (m, name: string) => lookup.get(norm(name)) ?? m);
}

export const isEmail = (s: string) => /^[^\s@<>,;"]+@[^\s@<>,;"]+\.[^\s@<>,;"]+$/.test(s.trim());

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function toCsv(rows: string[][]): string {
  return rows.map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(",")).join("\n");
}
