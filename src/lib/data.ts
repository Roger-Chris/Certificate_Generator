import { normKey } from "./design";

/** Spreadsheet / table helpers for the "create certificates" page. */

export const EMAIL_KEY = "__email";
export const DESIGN_KEY = "__design";
export const IGNORE = "";

export type Row = Record<string, string> & { _id: string; _design: string };

export const newRow = (design: string, values: Record<string, string> = {}): Row =>
  ({ ...values, _id: crypto.randomUUID(), _design: design }) as Row;

/** Other spreadsheet headings people commonly use for each field. */
const ALIASES: Record<string, string[]> = {
  name: ["full name", "participant name", "participant", "student name", "staff name", "faculty name", "name of the participant", "candidate name"],
  department: ["dept", "from", "institution", "college", "organisation", "organization", "institute", "branch"],
  position: ["place", "prize", "rank", "secured", "result"],
  title: ["topic", "paper title", "patent title", "copyright title", "project title"],
  event: ["event name", "competition", "contest"],
  date: ["dated", "date of event"],
};
const EMAIL_NAMES = ["email", "e-mail", "mail", "email id", "mail id", "email address", "e mail"];
const DESIGN_NAMES = ["type", "certificate", "certificate type", "design", "category", "variant"];

/** Guess which field each spreadsheet heading belongs to. Exact matches win over partial ones. */
export function autoMap(headers: string[], fields: string[], multiDesign: boolean): string[] {
  const targets = [
    { key: EMAIL_KEY, names: EMAIL_NAMES },
    ...(multiDesign ? [{ key: DESIGN_KEY, names: DESIGN_NAMES }] : []),
    ...fields.map((f) => ({ key: f, names: [f, ...(ALIASES[normKey(f)] ?? [])] })),
  ];
  const used = new Set<string>();
  const pick = (h: string, exact: boolean) => {
    const n = normKey(h);
    for (const t of targets) {
      if (used.has(t.key)) continue;
      if (t.names.some((x) => (exact ? normKey(x) === n : normKey(x).length >= 4 && n.includes(normKey(x))))) return t.key;
    }
    return IGNORE;
  };
  const first = headers.map((h) => {
    const k = pick(h, true);
    if (k) used.add(k);
    return k;
  });
  return first.map((k, i) => {
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
  const headerIdx = cells.findIndex((r) => r.some(Boolean));
  if (headerIdx < 0) throw new Error("The sheet is empty");
  const headers = cells[headerIdx].map((h, i) => h || `Column ${i + 1}`);
  const rows = cells.slice(headerIdx + 1).filter((r) => r.some(Boolean));
  return { headers, rows };
}

export function matchDesign(value: string, designs: { id: string; name: string }[]): string | undefined {
  const n = normKey(value);
  if (!n) return undefined;
  const short = (s: string) => normKey(s.split("—").pop() ?? s);
  return (
    designs.find((d) => normKey(d.name) === n || short(d.name) === n)?.id ??
    designs.find((d) => short(d.name).includes(n) || n.includes(short(d.name)))?.id
  );
}

/** Row values with the "same for everyone" fallbacks applied. */
export function resolveValues(row: Row, fields: string[], common: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of fields) out[f] = (row[f] ?? "").trim() || (common[f] ?? "").trim();
  return out;
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
