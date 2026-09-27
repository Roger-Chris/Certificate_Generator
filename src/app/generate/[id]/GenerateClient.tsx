"use client";

import JSZip from "jszip";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Thumb from "@/components/Thumb";
import { renderPdf, safeFileName } from "@/lib/capture";
import {
  autoMap,
  DESIGN_KEY,
  downloadBlob,
  EMAIL_KEY,
  IGNORE,
  isEmail,
  matchDesign,
  newRow,
  readSpreadsheet,
  resolveValues,
  type Row,
  toCsv,
} from "@/lib/data";
import { applyCase, caseFor, type Design, designFields, fillText, normKey, sampleFor } from "@/lib/design";

type SendState = { state: "sending" | "sent" | "failed" | "skipped"; error?: string };
type Import = { fileName: string; headers: string[]; rows: string[][]; mapping: string[] };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const SEND_GAP_MS = 1200; // stay well under Gmail's burst limits

export default function GenerateClient({ id }: { id: string }) {
  const [all, setAll] = useState<Design[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/designs")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "Could not load designs");
        setAll(d.designs);
      })
      .catch((e) => setLoadError(e.message));
  }, []);

  if (loadError) return <p className="p-8 text-red-600">{loadError}</p>;
  if (!all) return <p className="p-8 text-slate-500">Loading…</p>;
  const main = all.find((d) => d.id === id);
  if (!main)
    return (
      <p className="p-8">
        Design not found. <Link href="/" className="underline">Back to designs</Link>
      </p>
    );
  // Designs from the same event can be mixed in one batch (Winner / Participation …).
  const family = main.event ? all.filter((d) => d.event === main.event) : [main];
  return <Generator main={main} family={family} />;
}

function Generator({ main, family }: { main: Design; family: Design[] }) {
  const storageKey = `cg-rows:${main.id}`;
  const multi = family.length > 1;
  const byId = useMemo(() => new Map(family.map((d) => [d.id, d])), [family]);

  const [defaultDesign, setDefaultDesign] = useState(main.id);
  const [rows, setRows] = useState<Row[]>(() => [newRow(main.id)]);
  const [common, setCommon] = useState<Record<string, string>>({});
  const [subject, setSubject] = useState(main.email.subject);
  const [body, setBody] = useState(main.email.body);
  const [selected, setSelected] = useState(0);
  const [importing, setImporting] = useState<Import | null>(null);
  const [progress, setProgress] = useState<{ label: string; done: number; total: number } | null>(null);
  const [status, setStatus] = useState<Record<string, SendState>>({});
  const [mail, setMail] = useState<{ configured: boolean; from: string | null } | null>(null);
  const [testTo, setTestTo] = useState("");
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const cancelRef = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const designOf = useCallback((r: Row) => byId.get(r._design) ?? main, [byId, main]);

  useEffect(() => {
    document.title = `${main.name} · Create certificates`;
    try {
      const d = JSON.parse(localStorage.getItem(storageKey) ?? "null");
      if (d?.rows?.length) setRows(d.rows.map((r: Row) => (byId.has(r._design) ? r : { ...r, _design: main.id })));
      if (d?.common) setCommon(d.common);
    } catch {}
    setLoaded(true);
    fetch("/api/send")
      .then((r) => r.json())
      .then(setMail)
      .catch(() => setMail({ configured: false, from: null }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ rows, common }));
    } catch {}
  }, [loaded, storageKey, rows, common]);

  // Fields used by any design in this batch, in first-seen order.
  const fields = useMemo(() => {
    const seen = new Map<string, string>();
    const used = new Set([defaultDesign, ...rows.map((r) => r._design)]);
    for (const d of family) if (used.has(d.id)) for (const f of designFields(d)) if (!seen.has(normKey(f))) seen.set(normKey(f), f);
    return [...seen.values()];
  }, [family, rows, defaultDesign]);
  const nameField = fields.find((f) => normKey(f) === "name") ?? fields[0];

  const issues = useMemo(
    () =>
      rows.map((r) => {
        const vals = resolveValues(r, fields, common);
        const missing = designFields(designOf(r)).filter((f) => !vals[fields.find((x) => normKey(x) === normKey(f)) ?? f]);
        const out: string[] = [];
        if (missing.length) out.push(`Missing ${missing.join(", ")}`);
        if (r[EMAIL_KEY] && !isEmail(r[EMAIL_KEY])) out.push("Invalid email");
        return out;
      }),
    [rows, fields, common, designOf],
  );
  const filledRows = rows.filter((r) => fields.some((f) => (r[f] ?? "").trim()));
  const emailRows = filledRows.filter((r) => isEmail(r[EMAIL_KEY] ?? ""));

  const sel = rows[Math.min(selected, rows.length - 1)];
  const selValues = useMemo(() => {
    if (!sel) return {};
    const v = resolveValues(sel, fields, common);
    const d = designOf(sel);
    const empty = !fields.some((f) => (sel[f] ?? "").trim());
    // An empty row previews with sample text; otherwise missing fields show as {Field}.
    for (const f of fields) if (!v[f]) v[f] = empty ? sampleFor(d, f) : `{${f}}`;
    return v;
  }, [sel, fields, common, designOf]);

  // ---- table editing ----
  const update = (i: number, key: string, value: string) => setRows((rs) => rs.map((r, j) => (j === i ? ({ ...r, [key]: value } as Row) : r)));
  const editableKeys = [...(multi ? [DESIGN_KEY] : []), ...fields, EMAIL_KEY];

  /** Pasting a block copied from Excel spreads it across rows/columns from the focused cell. */
  const onPaste = (e: React.ClipboardEvent, rowIdx: number, key: string) => {
    const text = e.clipboardData.getData("text/plain");
    if (!/[\t\n]/.test(text.trim())) return;
    e.preventDefault();
    const lines = text.replace(/\r/g, "").replace(/\n$/, "").split("\n").map((l) => l.split("\t"));
    const startCol = editableKeys.indexOf(key);
    setRows((rs) => {
      const next = [...rs];
      lines.forEach((cells, li) => {
        const idx = rowIdx + li;
        if (!next[idx]) next[idx] = newRow(defaultDesign);
        const r = { ...next[idx] } as Row;
        cells.forEach((cell, ci) => {
          const k = editableKeys[startCol + ci];
          if (!k) return;
          if (k === DESIGN_KEY) r._design = matchDesign(cell, family) ?? r._design;
          else r[k] = cell.trim();
        });
        next[idx] = r;
      });
      return next;
    });
  };

  const chooseDesign = (did: string) => {
    setDefaultDesign(did);
    setRows((rs) => rs.map((r) => ({ ...r, _design: did })));
  };

  // ---- Excel import ----
  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const { headers, rows: data } = await readSpreadsheet(file);
      setImporting({ fileName: file.name, headers, rows: data, mapping: autoMap(headers, fields, multi) });
    } catch (e) {
      setNotice({ kind: "err", text: `Could not read ${file.name}: ${e instanceof Error ? e.message : e}` });
    }
    if (fileInput.current) fileInput.current.value = "";
  };
  const applyImport = (mode: "replace" | "append") => {
    if (!importing) return;
    const imported = importing.rows.map((cells) => {
      const vals: Record<string, string> = {};
      let design = defaultDesign;
      importing.mapping.forEach((k, i) => {
        if (k === IGNORE) return;
        if (k === DESIGN_KEY) design = matchDesign(cells[i] ?? "", family) ?? design;
        else vals[k] = cells[i] ?? "";
      });
      return newRow(design, vals);
    });
    const onlyBlank = rows.every((r) => !editableKeys.some((k) => k !== DESIGN_KEY && (r[k] ?? "").trim()));
    setRows(mode === "replace" || onlyBlank ? imported : [...rows, ...imported]);
    setStatus({});
    setSelected(0);
    setImporting(null);
    setNotice({ kind: "ok", text: `Imported ${imported.length} rows from ${importing.fileName}` });
  };
  const downloadSample = async () => {
    const XLSX = await import("xlsx");
    const headers = [...fields, "Email", ...(multi ? ["Certificate type"] : [])];
    const example = [...fields.map((f) => sampleFor(main, f)), "someone@example.com", ...(multi ? [main.name] : [])];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([headers, example]), "Certificates");
    XLSX.writeFile(wb, `${safeFileName(main.event || main.name)} - names.xlsx`);
  };

  // ---- PDF building ----
  const buildPdf = async (row: Row) => {
    const d = designOf(row);
    const values = resolveValues(row, fields, common);
    const pdf = await renderPdf(d, values, `${d.name} — ${values[nameField] ?? ""}`);
    const printed = applyCase(values[nameField] ?? "", caseFor(d, nameField ?? "Name"));
    const fileName = `${safeFileName(printed || "certificate")}${multi ? ` - ${safeFileName(d.name.split("—").pop()!.trim())}` : ""}.pdf`;
    return { pdf, values, design: d, fileName };
  };

  const downloadZip = async () => {
    const targets = filledRows;
    if (!targets.length) return;
    cancelRef.current = false;
    const zip = new JSZip();
    const names = new Map<string, number>();
    try {
      for (let i = 0; i < targets.length; i++) {
        if (cancelRef.current) break;
        setProgress({ label: "Creating PDFs", done: i, total: targets.length });
        const { pdf, fileName } = await buildPdf(targets[i]);
        const n = (names.get(fileName) ?? 0) + 1;
        names.set(fileName, n);
        zip.file(n === 1 ? fileName : fileName.replace(/\.pdf$/, ` (${n}).pdf`), pdf);
      }
      if (!cancelRef.current) {
        setProgress({ label: "Zipping", done: targets.length, total: targets.length });
        downloadBlob(await zip.generateAsync({ type: "blob" }), `${safeFileName(main.event || main.name)} certificates.zip`);
        setNotice({ kind: "ok", text: `Downloaded ${targets.length} certificates.` });
      }
    } catch (e) {
      setNotice({ kind: "err", text: `Could not create PDFs: ${e instanceof Error ? e.message : e}` });
    } finally {
      setProgress(null);
    }
  };

  const downloadOne = async () => {
    if (!sel) return;
    setProgress({ label: "Creating PDF", done: 0, total: 1 });
    try {
      const { pdf, fileName } = await buildPdf(sel);
      downloadBlob(new Blob([pdf as BlobPart], { type: "application/pdf" }), fileName);
    } catch (e) {
      setNotice({ kind: "err", text: `Could not create the PDF: ${e instanceof Error ? e.message : e}` });
    } finally {
      setProgress(null);
    }
  };

  // ---- email ----
  const emailValues = (values: Record<string, string>, d: Design) => ({
    ...Object.fromEntries(Object.entries(values).map(([k, v]) => [k, applyCase(v, caseFor(d, k))])),
    Event: d.event || d.name,
    Type: d.name.split("—").pop()!.trim(),
  });

  const sendOne = async (row: Row, to: string, test = false) => {
    const { pdf, values, design: d, fileName } = await buildPdf(row);
    const ev = emailValues(values, d);
    const fd = new FormData();
    fd.append("to", to);
    fd.append("subject", (test ? "[TEST] " : "") + fillText(subject, ev));
    fd.append("body", fillText(body, ev));
    fd.append("file", new File([pdf as BlobPart], fileName, { type: "application/pdf" }));
    const res = await fetch("/api/send", { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error ?? `Send failed (HTTP ${res.status})`) as Error & { fatal?: boolean };
      err.fatal = res.status === 401 || res.status === 502 || (res.status === 500 && /not configured/i.test(data.error ?? ""));
      throw err;
    }
  };

  const sendTest = async () => {
    if (!sel || !isEmail(testTo)) return;
    setProgress({ label: "Sending test email", done: 0, total: 1 });
    try {
      await sendOne(sel, testTo.trim(), true);
      setNotice({ kind: "ok", text: `Test email sent to ${testTo.trim()}. Check the inbox (and spam).` });
    } catch (e) {
      setNotice({ kind: "err", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setProgress(null);
    }
  };

  const sendMany = async (targets: Row[]) => {
    if (!targets.length) return;
    if (!window.confirm(`Email ${targets.length} certificate${targets.length === 1 ? "" : "s"} from ${mail?.from ?? "the configured Gmail"}?`)) return;
    cancelRef.current = false;
    let sent = 0;
    let failed = 0;
    for (let i = 0; i < targets.length; i++) {
      if (cancelRef.current) break;
      const row = targets[i];
      setProgress({ label: "Sending emails", done: i, total: targets.length });
      const to = (row[EMAIL_KEY] ?? "").trim();
      if (!isEmail(to)) {
        setStatus((s) => ({ ...s, [row._id]: { state: "skipped", error: "No valid email" } }));
        continue;
      }
      setStatus((s) => ({ ...s, [row._id]: { state: "sending" } }));
      try {
        await sendOne(row, to);
        sent++;
        setStatus((s) => ({ ...s, [row._id]: { state: "sent" } }));
      } catch (e) {
        failed++;
        const msg = e instanceof Error ? e.message : String(e);
        setStatus((s) => ({ ...s, [row._id]: { state: "failed", error: msg } }));
        if ((e as { fatal?: boolean }).fatal) {
          setNotice({ kind: "err", text: `Stopped: ${msg}` });
          break;
        }
      }
      if (i < targets.length - 1) await sleep(SEND_GAP_MS);
    }
    setProgress(null);
    setNotice((n) => (n?.kind === "err" ? n : { kind: failed ? "err" : "ok", text: `Sent ${sent}${failed ? `, failed ${failed}` : ""}.` }));
  };

  const saveEmailDefault = async () => {
    const res = await fetch(`/api/designs/${main.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ design: { ...main, email: { subject, body } } }),
    });
    setNotice(res.ok ? { kind: "ok", text: "Saved as this design's default email." } : { kind: "err", text: "Could not save the email text." });
  };

  const unsent = emailRows.filter((r) => status[r._id]?.state !== "sent");
  const failedRows = rows.filter((r) => status[r._id]?.state === "failed");

  const downloadReport = () => {
    const csv = toCsv([
      ["Name", "Email", "Certificate", "Status", "Error"],
      ...filledRows.map((r) => {
        const st = status[r._id];
        return [r[nameField] ?? "", r[EMAIL_KEY] ?? "", designOf(r).name, st?.state ?? "not sent", st?.error ?? ""];
      }),
    ]);
    downloadBlob(new Blob([csv], { type: "text/csv" }), `${safeFileName(main.event || main.name)} - email report.csv`);
  };

  const busy = progress !== null;
  const previewDesign = sel ? designOf(sel) : main;

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <div className="mr-auto">
          <h1 className="text-2xl font-semibold text-navy-800">{main.event || main.name}</h1>
          <p className="text-sm text-slate-500">Add people, check the preview, then download or email the certificates.</p>
        </div>
        <Link href={`/editor/${main.id}`} className="btn-ghost">
          Edit design
        </Link>
      </div>

      {notice && (
        <div className={`mb-4 flex items-start justify-between gap-4 rounded-lg px-4 py-3 text-sm ${notice.kind === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>
          <span>{notice.text}</span>
          <button onClick={() => setNotice(null)} className="font-semibold opacity-60 hover:opacity-100">
            ✕
          </button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <div className="space-y-6">
          {multi && (
            <section className="card p-4">
              <h2 className="label">1 · Certificate design</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {family.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => chooseDesign(d.id)}
                    className={`overflow-hidden rounded-lg border-2 text-left transition ${defaultDesign === d.id ? "border-gold-500 ring-2 ring-gold-100" : "border-transparent hover:border-slate-300"}`}
                  >
                    <Thumb design={d} />
                    <span className="block truncate px-2 py-1.5 text-xs font-medium text-slate-700" title={d.name}>
                      {d.name.split("—").pop()!.trim()}
                    </span>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-500">Applies to every row. You can still change it per row, or use a “Certificate type” column in Excel.</p>
            </section>
          )}

          {fields.length > 1 && (
            <section className="card p-4">
              <h2 className="label">{multi ? "2" : "1"} · Same for everyone (used when a cell is blank)</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {fields
                  .filter((f) => f !== nameField)
                  .map((f) => (
                    <div key={f}>
                      <label className="mb-1 block text-xs text-slate-600">{f}</label>
                      <input className="input" value={common[f] ?? ""} placeholder="Leave blank to fill per person" onChange={(e) => setCommon((x) => ({ ...x, [f]: e.target.value }))} />
                    </div>
                  ))}
              </div>
            </section>
          )}

          <section className="card p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h2 className="label mb-0 mr-auto">People ({filledRows.length})</h2>
              <button className="btn-ghost py-1.5" onClick={downloadSample}>
                Sample Excel
              </button>
              <button className="btn-primary py-1.5" onClick={() => fileInput.current?.click()}>
                Upload Excel / CSV
              </button>
              <input ref={fileInput} type="file" accept=".xlsx,.xls,.csv,.ods" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            </div>

            {importing && (
              <div className="mb-4 rounded-lg border border-gold-400 bg-gold-100/40 p-3">
                <p className="mb-2 text-sm font-medium text-slate-800">
                  {importing.fileName} — {importing.rows.length} rows. Check which column is which:
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {importing.headers.map((h, i) => (
                    <label key={i} className="flex items-center gap-2 text-sm">
                      <span className="w-2/5 truncate text-slate-600" title={h}>
                        {h}
                      </span>
                      <select className="input" value={importing.mapping[i]} onChange={(e) => setImporting({ ...importing, mapping: importing.mapping.map((m, j) => (j === i ? e.target.value : m)) })}>
                        <option value={IGNORE}>— ignore —</option>
                        {fields.map((f) => (
                          <option key={f} value={f}>
                            {f}
                          </option>
                        ))}
                        <option value={EMAIL_KEY}>Email</option>
                        {multi && <option value={DESIGN_KEY}>Certificate type</option>}
                      </select>
                    </label>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button className="btn-gold py-1.5" onClick={() => applyImport("replace")}>
                    Replace table
                  </button>
                  <button className="btn-ghost py-1.5" onClick={() => applyImport("append")}>
                    Add to table
                  </button>
                  <button className="btn-ghost py-1.5" onClick={() => setImporting(null)}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <p className="mb-2 text-xs text-slate-500">Type names below, or copy cells from Excel and paste into the first box — rows are added automatically.</p>
            <div className="max-h-[480px] overflow-auto rounded-lg border border-slate-200">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="sticky top-0 z-10 bg-slate-50 text-left text-xs text-slate-500">
                  <tr>
                    <th className="w-8 px-2 py-2">#</th>
                    {multi && <th className="px-1 py-2">Design</th>}
                    {fields.map((f) => (
                      <th key={f} className="px-1 py-2">
                        {f}
                      </th>
                    ))}
                    <th className="px-1 py-2">Email</th>
                    <th className="w-16 px-1 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const st = status[r._id];
                    const iss = issues[i];
                    const blank = !fields.some((f) => (r[f] ?? "").trim());
                    return (
                      <tr key={r._id} onFocus={() => setSelected(i)} onClick={() => setSelected(i)} className={`border-t border-slate-100 ${i === selected ? "bg-navy-50" : ""}`}>
                        <td className="px-2 text-xs text-slate-400">{i + 1}</td>
                        {multi && (
                          <td className="px-1 py-1">
                            <select className="input py-1" value={r._design} onChange={(e) => update(i, "_design", e.target.value)}>
                              {family.map((d) => (
                                <option key={d.id} value={d.id}>
                                  {d.name.split("—").pop()!.trim()}
                                </option>
                              ))}
                            </select>
                          </td>
                        )}
                        {fields.map((f) => (
                          <td key={f} className="px-1 py-1">
                            <input className="input py-1" value={r[f] ?? ""} placeholder={common[f] || ""} onChange={(e) => update(i, f, e.target.value)} onPaste={(e) => onPaste(e, i, f)} />
                          </td>
                        ))}
                        <td className="px-1 py-1">
                          <input
                            className={`input py-1 ${r[EMAIL_KEY] && !isEmail(r[EMAIL_KEY]) ? "border-red-400" : ""}`}
                            value={r[EMAIL_KEY] ?? ""}
                            type="email"
                            onChange={(e) => update(i, EMAIL_KEY, e.target.value)}
                            onPaste={(e) => onPaste(e, i, EMAIL_KEY)}
                          />
                        </td>
                        <td className="whitespace-nowrap px-1 text-right">
                          {st ? (
                            <span
                              title={st.error}
                              className={`mr-1 rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                                { sent: "bg-emerald-100 text-emerald-700", failed: "bg-red-100 text-red-700", sending: "bg-amber-100 text-amber-700", skipped: "bg-slate-100 text-slate-600" }[st.state]
                              }`}
                            >
                              {st.state}
                            </span>
                          ) : (
                            !blank &&
                            iss.length > 0 && (
                              <span title={iss.join("\n")} className="mr-1 cursor-help text-amber-600">
                                ⚠
                              </span>
                            )
                          )}
                          <button
                            aria-label="Remove row"
                            className="px-1 text-slate-400 hover:text-red-600"
                            onClick={(e) => {
                              e.stopPropagation();
                              setRows((rs) => (rs.length > 1 ? rs.filter((x) => x._id !== r._id) : [newRow(defaultDesign)]));
                            }}
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <button className="btn-ghost py-1.5" onClick={() => setRows((rs) => [...rs, newRow(defaultDesign)])}>
                + Add row
              </button>
              <button
                className="btn-ghost py-1.5"
                onClick={() => {
                  if (window.confirm("Clear all rows?")) {
                    setRows([newRow(defaultDesign)]);
                    setStatus({});
                    setSelected(0);
                  }
                }}
              >
                Clear
              </button>
            </div>
          </section>
        </div>

        <div className="space-y-6 lg:sticky lg:top-4 lg:self-start">
          <section className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2">
              <h2 className="label mb-0">Preview · row {Math.min(selected, rows.length - 1) + 1}</h2>
              <div className="flex gap-1">
                <button className="btn-ghost px-2 py-1" disabled={selected <= 0} onClick={() => setSelected((s) => s - 1)}>
                  ‹
                </button>
                <button className="btn-ghost px-2 py-1" disabled={selected >= rows.length - 1} onClick={() => setSelected((s) => s + 1)}>
                  ›
                </button>
              </div>
            </div>
            <Thumb design={previewDesign} values={selValues} />
            <p className="border-t border-slate-100 px-4 py-1.5 text-[11px] text-slate-500">
              This is exactly what the PDF will look like. Long names shrink automatically to fit.
            </p>
          </section>

          {progress && (
            <div className="card p-4">
              <div className="mb-2 flex justify-between text-sm">
                <span className="font-medium">{progress.label}…</span>
                <span className="text-slate-500">
                  {progress.done} / {progress.total}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded bg-slate-100">
                <div className="h-full bg-gold-500 transition-all" style={{ width: `${(progress.done / Math.max(1, progress.total)) * 100}%` }} />
              </div>
              <button className="mt-3 text-sm text-red-600 hover:underline" onClick={() => (cancelRef.current = true)}>
                Stop
              </button>
              <p className="mt-1 text-xs text-slate-500">Keep this tab open until it finishes.</p>
            </div>
          )}

          <section className="card p-4">
            <h2 className="label">Download</h2>
            <div className="flex flex-wrap gap-2">
              <button className="btn-primary" disabled={busy || !filledRows.length} onClick={downloadZip}>
                Download ZIP ({filledRows.length} PDF{filledRows.length === 1 ? "" : "s"})
              </button>
              <button className="btn-ghost" disabled={busy || !sel} onClick={downloadOne}>
                This one as PDF
              </button>
            </div>
          </section>

          <section className="card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="label mb-0">Email certificates</h2>
              {mail && <span className={`text-xs ${mail.configured ? "text-emerald-700" : "text-red-600"}`}>{mail.configured ? `Sending as ${mail.from}` : "Gmail not configured"}</span>}
            </div>
            <label className="mb-1 block text-xs text-slate-600">Subject</label>
            <input className="input mb-3" value={subject} onChange={(e) => setSubject(e.target.value)} />
            <label className="mb-1 block text-xs text-slate-600">Message</label>
            <textarea className="input mb-1 h-40 font-mono text-[13px]" value={body} onChange={(e) => setBody(e.target.value)} />
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-slate-500">
                Placeholders: {["Event", "Type", ...fields].map((f) => `{${f}}`).join(", ")}. The PDF is attached.
              </p>
              <button className="text-xs text-navy-600 hover:underline" onClick={saveEmailDefault}>
                Save as default
              </button>
            </div>

            <div className="mb-4 flex gap-2">
              <input className="input" type="email" placeholder="Send a test of the previewed row to…" value={testTo} onChange={(e) => setTestTo(e.target.value)} />
              <button className="btn-ghost shrink-0" disabled={busy || !mail?.configured || !isEmail(testTo)} onClick={sendTest}>
                Send test
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              <button className="btn-gold" disabled={busy || !mail?.configured || !unsent.length} onClick={() => sendMany(unsent)}>
                Email {unsent.length} {unsent.length === 1 ? "person" : "people"}
              </button>
              {failedRows.length > 0 && (
                <button className="btn-ghost" disabled={busy} onClick={() => sendMany(failedRows)}>
                  Retry {failedRows.length} failed
                </button>
              )}
              {Object.keys(status).length > 0 && (
                <button className="btn-ghost" onClick={downloadReport}>
                  Download report
                </button>
              )}
            </div>
            {filledRows.length > emailRows.length && (
              <p className="mt-2 text-xs text-slate-500">{filledRows.length - emailRows.length} row(s) have no valid email and will be skipped.</p>
            )}
            <p className="mt-2 text-xs text-slate-500">Gmail allows about 500 emails per day from one account. Rows already marked “sent” are not sent again.</p>
          </section>
        </div>
      </div>
    </main>
  );
}
