"use client";

import JSZip from "jszip";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  autoMap,
  downloadBlob,
  EMAIL_KEY,
  fillPlaceholders,
  IGNORE,
  isEmail,
  matchVariant,
  newRow,
  readSpreadsheet,
  resolveValues,
  toCsv,
  VARIANT_KEY,
} from "@/lib/data";
import { applyTransform, canvasToPdf, renderCertificate, safeFileName } from "@/lib/render";
import type { EventTemplate, Row, Variant } from "@/lib/types";

type SendState = { state: "sending" | "sent" | "failed" | "skipped"; error?: string };
type Import = { fileName: string; headers: string[]; rows: string[][]; mapping: string[] };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const SEND_GAP_MS = 1200; // stay well under Gmail's burst limits

export default function GenerateClient({ ev }: { ev: EventTemplate }) {
  const base = `/templates/${ev.slug}/`;
  const storageKey = `cg-draft:${ev.slug}`;
  const multi = ev.variants.length > 1;

  const [defaultVariant, setDefaultVariant] = useState(ev.variants[0].id);
  const [rows, setRows] = useState<Row[]>(() => [newRow(ev.variants[0].id)]);
  const [common, setCommon] = useState<Record<string, string>>(() =>
    Object.fromEntries(ev.columns.map((c) => [c.key, c.default ?? ""])),
  );
  const [subject, setSubject] = useState(ev.email.subject);
  const [body, setBody] = useState(ev.email.body);
  const [selected, setSelected] = useState(0);
  const [preview, setPreview] = useState<{ url: string; warn: string[] } | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [importing, setImporting] = useState<Import | null>(null);
  const [progress, setProgress] = useState<{ label: string; done: number; total: number } | null>(null);
  const [status, setStatus] = useState<Record<string, SendState>>({});
  const [mail, setMail] = useState<{ configured: boolean; from: string | null } | null>(null);
  const [testTo, setTestTo] = useState("");
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const cancelRef = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const variantById = useMemo(() => new Map(ev.variants.map((v) => [v.id, v])), [ev.variants]);
  const variantOf = useCallback((r: Row): Variant => variantById.get(r._variant) ?? ev.variants[0], [variantById, ev.variants]);

  // ---- draft persistence (per browser, convenience only) ----
  useEffect(() => {
    try {
      const d = JSON.parse(localStorage.getItem(storageKey) ?? "null");
      if (d?.rows?.length) setRows(d.rows);
      if (d?.common) setCommon((c) => ({ ...c, ...d.common }));
      if (d?.defaultVariant && variantById.has(d.defaultVariant)) setDefaultVariant(d.defaultVariant);
      if (typeof d?.subject === "string") setSubject(d.subject);
      if (typeof d?.body === "string") setBody(d.body);
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
      localStorage.setItem(storageKey, JSON.stringify({ rows, common, defaultVariant, subject, body }));
    } catch {}
  }, [loaded, storageKey, rows, common, defaultVariant, subject, body]);

  // Columns drawn by any design currently in use.
  const usedKeys = useMemo(() => {
    const s = new Set<string>();
    for (const r of rows) for (const f of variantOf(r).fields) s.add(f.key);
    for (const f of variantById.get(defaultVariant)?.fields ?? []) s.add(f.key);
    return s;
  }, [rows, variantOf, variantById, defaultVariant]);
  const columns = ev.columns.filter((c) => usedKeys.has(c.key));

  const issues = useMemo(
    () =>
      rows.map((r) => {
        const vals = resolveValues(r, ev.columns, common);
        const missing = variantOf(r)
          .fields.filter((f) => !vals[f.key])
          .map((f) => ev.columns.find((c) => c.key === f.key)?.label ?? f.key);
        const out: string[] = [];
        if (missing.length) out.push(`Missing ${missing.join(", ")}`);
        if (vals[EMAIL_KEY] && !isEmail(vals[EMAIL_KEY])) out.push("Invalid email");
        return out;
      }),
    [rows, ev.columns, common, variantOf],
  );
  const filledRows = rows.filter((r) => ev.columns.some((c) => (r[c.key] ?? "").trim()));
  const emailRows = filledRows.filter((r) => isEmail(r[EMAIL_KEY] ?? ""));

  // ---- live preview ----
  const sel = rows[Math.min(selected, rows.length - 1)];
  const selKey = sel ? JSON.stringify([sel, common]) : "";
  useEffect(() => {
    if (!sel) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const v = variantOf(sel);
        const vals = resolveValues(sel, ev.columns, common);
        const sample = Object.fromEntries(
          Object.entries(vals).map(([k, x]) => [k, x || (k === "name" ? "Your Name Here" : "")]),
        );
        const { canvas, fields } = await renderCertificate(v, base + v.image, sample);
        if (cancelled) return;
        const warn = fields
          .filter((f) => f.scale < 0.75)
          .map((f) => `${ev.columns.find((c) => c.key === f.key)?.label ?? f.key} was shrunk to ${Math.round(f.scale * 100)}% to fit`);
        setPreview({ url: canvas.toDataURL("image/jpeg", 0.85), warn });
        setPreviewError(null);
      } catch (e) {
        if (!cancelled) setPreviewError(e instanceof Error ? e.message : String(e));
      }
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selKey]);

  // ---- table editing ----
  const update = (i: number, key: string, value: string) =>
    setRows((rs) => rs.map((r, j) => (j === i ? ({ ...r, [key]: value } as Row) : r)));
  const editableKeys = [...(multi ? [VARIANT_KEY] : []), ...columns.map((c) => c.key), EMAIL_KEY];

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
        if (!next[idx]) next[idx] = newRow(defaultVariant);
        const r = { ...next[idx] } as Row;
        cells.forEach((cell, ci) => {
          const k = editableKeys[startCol + ci];
          if (!k) return;
          if (k === VARIANT_KEY) r._variant = matchVariant(cell, ev.variants) ?? r._variant;
          else r[k] = cell.trim();
        });
        next[idx] = r;
      });
      return next;
    });
  };

  const chooseVariant = (id: string) => {
    setDefaultVariant(id);
    setRows((rs) => rs.map((r) => ({ ...r, _variant: id })));
  };

  // ---- Excel import ----
  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const { headers, rows: data } = await readSpreadsheet(file);
      setImporting({ fileName: file.name, headers, rows: data, mapping: autoMap(headers, ev) });
    } catch (e) {
      setNotice({ kind: "err", text: `Could not read ${file.name}: ${e instanceof Error ? e.message : e}` });
    }
    if (fileInput.current) fileInput.current.value = "";
  };
  const applyImport = (mode: "replace" | "append") => {
    if (!importing) return;
    const imported = importing.rows.map((cells) => {
      const vals: Record<string, string> = {};
      let variant = defaultVariant;
      importing.mapping.forEach((k, i) => {
        if (k === IGNORE) return;
        if (k === VARIANT_KEY) variant = matchVariant(cells[i] ?? "", ev.variants) ?? variant;
        else vals[k] = cells[i] ?? "";
      });
      return newRow(variant, vals);
    });
    const onlyBlank = rows.every((r) => !editableKeys.some((k) => k !== VARIANT_KEY && (r[k] ?? "").trim()));
    setRows(mode === "replace" || onlyBlank ? imported : [...rows, ...imported]);
    setStatus({});
    setSelected(0);
    setImporting(null);
    setNotice({ kind: "ok", text: `Imported ${imported.length} rows from ${importing.fileName}` });
  };
  const downloadSample = async () => {
    const XLSX = await import("xlsx");
    const headers = [...ev.columns.map((c) => c.label), "Email", ...(multi ? ["Certificate type"] : [])];
    const example = [...ev.columns.map((c) => (c.key === "name" ? "Dr. A. Example" : c.default ?? "")), "someone@example.com", ...(multi ? [ev.variants[0].label] : [])];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([headers, example]), "Certificates");
    XLSX.writeFile(wb, `${ev.slug}-names.xlsx`);
  };

  // ---- PDF building ----
  const buildPdf = async (row: Row) => {
    const v = variantOf(row);
    const values = resolveValues(row, ev.columns, common);
    const { canvas } = await renderCertificate(v, base + v.image, values);
    const pdf = await canvasToPdf(canvas, `${ev.name} — ${values.name ?? ""}`);
    // Name the file the way the name is printed (e.g. Title Case), not as typed.
    const printedName = applyTransform(values.name ?? "", v.fields.find((f) => f.key === "name")?.transform);
    const fileName = `${safeFileName(printedName || "certificate")}${multi ? ` - ${safeFileName(v.label)}` : ""}.pdf`;
    return { pdf, values, variant: v, fileName };
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
        const blob = await zip.generateAsync({ type: "blob" });
        downloadBlob(blob, `${safeFileName(ev.name)} certificates.zip`);
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
    const { pdf, fileName } = await buildPdf(sel);
    downloadBlob(new Blob([pdf as BlobPart], { type: "application/pdf" }), fileName);
  };

  // ---- email ----
  const sendOne = async (row: Row, to: string, test = false) => {
    const { pdf, values, variant, fileName } = await buildPdf(row);
    const fd = new FormData();
    fd.append("to", to);
    fd.append("subject", (test ? "[TEST] " : "") + fillPlaceholders(subject, values, ev, variant));
    fd.append("body", fillPlaceholders(body, values, ev, variant));
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

  const unsent = emailRows.filter((r) => status[r._id]?.state !== "sent");
  const failedRows = rows.filter((r) => status[r._id]?.state === "failed");

  const downloadReport = () => {
    const csv = toCsv([
      ["Name", "Email", "Certificate", "Status", "Error"],
      ...filledRows.map((r) => {
        const v = resolveValues(r, ev.columns, common);
        const st = status[r._id];
        return [v.name ?? "", v[EMAIL_KEY], variantOf(r).label, st?.state ?? "not sent", st?.error ?? ""];
      }),
    ]);
    downloadBlob(new Blob([csv], { type: "text/csv" }), `${ev.slug}-email-report.csv`);
  };

  const busy = progress !== null;

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-5">
        <h1 className="text-2xl font-semibold text-navy-800">{ev.name}</h1>
        {ev.description && <p className="text-sm text-slate-500">{ev.description}</p>}
      </div>

      {notice && (
        <div
          className={`mb-4 flex items-start justify-between gap-4 rounded-lg px-4 py-3 text-sm ${notice.kind === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}
        >
          <span>{notice.text}</span>
          <button onClick={() => setNotice(null)} className="font-semibold opacity-60 hover:opacity-100">
            ✕
          </button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        {/* ---------------- left: data ---------------- */}
        <div className="space-y-6">
          {multi && (
            <section className="card p-4">
              <h2 className="label">1 · Certificate design</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {ev.variants.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => chooseVariant(v.id)}
                    className={`overflow-hidden rounded-lg border-2 text-left transition ${defaultVariant === v.id ? "border-gold-500 ring-2 ring-gold-100" : "border-transparent hover:border-slate-300"}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={base + v.image} alt="" className="w-full" loading="lazy" />
                    <span className="block px-2 py-1.5 text-xs font-medium text-slate-700">{v.label}</span>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Choosing a design applies it to every row. You can still change it per row in the table, or use a
                “Certificate type” column in Excel.
              </p>
            </section>
          )}

          <section className="card p-4">
            <h2 className="label">{multi ? "2" : "1"} · Same for everyone (used when a cell is blank)</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {columns
                .filter((c) => c.key !== "name")
                .map((c) => (
                  <div key={c.key}>
                    <label className="mb-1 block text-xs text-slate-600">{c.label}</label>
                    <input
                      className="input"
                      value={common[c.key] ?? ""}
                      placeholder="Leave blank to fill per person"
                      onChange={(e) => setCommon((x) => ({ ...x, [c.key]: e.target.value }))}
                    />
                  </div>
                ))}
            </div>
          </section>

          <section className="card p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h2 className="label mb-0 mr-auto">
                {multi ? "3" : "2"} · People ({filledRows.length})
              </h2>
              <button className="btn-ghost py-1.5" onClick={downloadSample}>
                Sample Excel
              </button>
              <button className="btn-primary py-1.5" onClick={() => fileInput.current?.click()}>
                Upload Excel / CSV
              </button>
              <input
                ref={fileInput}
                type="file"
                accept=".xlsx,.xls,.csv,.ods"
                className="hidden"
                onChange={(e) => onFile(e.target.files?.[0])}
              />
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
                      <select
                        className="input"
                        value={importing.mapping[i]}
                        onChange={(e) =>
                          setImporting({ ...importing, mapping: importing.mapping.map((m, j) => (j === i ? e.target.value : m)) })
                        }
                      >
                        <option value={IGNORE}>— ignore —</option>
                        {ev.columns.map((c) => (
                          <option key={c.key} value={c.key}>
                            {c.label}
                          </option>
                        ))}
                        <option value={EMAIL_KEY}>Email</option>
                        {multi && <option value={VARIANT_KEY}>Certificate type</option>}
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

            <p className="mb-2 text-xs text-slate-500">
              Type names below, or copy cells from Excel and paste into the first box — rows are added automatically.
            </p>
            <div className="max-h-[480px] overflow-auto rounded-lg border border-slate-200">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="sticky top-0 z-10 bg-slate-50 text-left text-xs text-slate-500">
                  <tr>
                    <th className="w-8 px-2 py-2">#</th>
                    {multi && <th className="px-1 py-2">Design</th>}
                    {columns.map((c) => (
                      <th key={c.key} className="px-1 py-2">
                        {c.label}
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
                    const blank = !ev.columns.some((c) => (r[c.key] ?? "").trim());
                    return (
                      <tr
                        key={r._id}
                        onFocus={() => setSelected(i)}
                        onClick={() => setSelected(i)}
                        className={`border-t border-slate-100 ${i === selected ? "bg-navy-50" : ""}`}
                      >
                        <td className="px-2 text-xs text-slate-400">{i + 1}</td>
                        {multi && (
                          <td className="px-1 py-1">
                            <select className="input py-1" value={r._variant} onChange={(e) => update(i, "_variant", e.target.value)}>
                              {ev.variants.map((v) => (
                                <option key={v.id} value={v.id}>
                                  {v.label}
                                </option>
                              ))}
                            </select>
                          </td>
                        )}
                        {columns.map((c) => (
                          <td key={c.key} className="px-1 py-1">
                            <input
                              className="input py-1"
                              value={r[c.key] ?? ""}
                              placeholder={common[c.key] || ""}
                              onChange={(e) => update(i, c.key, e.target.value)}
                              onPaste={(e) => onPaste(e, i, c.key)}
                            />
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
                              setRows((rs) => (rs.length > 1 ? rs.filter((x) => x._id !== r._id) : [newRow(defaultVariant)]));
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
              <button className="btn-ghost py-1.5" onClick={() => setRows((rs) => [...rs, newRow(defaultVariant)])}>
                + Add row
              </button>
              <button
                className="btn-ghost py-1.5"
                onClick={() => {
                  if (window.confirm("Clear all rows?")) {
                    setRows([newRow(defaultVariant)]);
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

        {/* ---------------- right: preview + actions ---------------- */}
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
            {previewError ? (
              <p className="p-6 text-sm text-red-600">{previewError}</p>
            ) : preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview.url} alt="Certificate preview" className="w-full" />
            ) : (
              <div className="aspect-[1.414] animate-pulse bg-slate-100" />
            )}
            {preview?.warn.map((w) => (
              <p key={w} className="border-t border-amber-100 bg-amber-50 px-4 py-1.5 text-xs text-amber-800">
                ⚠ {w} — check it looks right.
              </p>
            ))}
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
              {mail && (
                <span className={`text-xs ${mail.configured ? "text-emerald-700" : "text-red-600"}`}>
                  {mail.configured ? `Sending as ${mail.from}` : "Gmail not configured"}
                </span>
              )}
            </div>
            <label className="mb-1 block text-xs text-slate-600">Subject</label>
            <input className="input mb-3" value={subject} onChange={(e) => setSubject(e.target.value)} />
            <label className="mb-1 block text-xs text-slate-600">Message</label>
            <textarea className="input mb-1 h-40 font-mono text-[13px]" value={body} onChange={(e) => setBody(e.target.value)} />
            <p className="mb-4 text-xs text-slate-500">
              Placeholders: {"{Name}"}, {"{Event}"}, {"{Type}"}
              {ev.columns
                .filter((c) => c.key !== "name")
                .map((c) => `, {${c.label}}`)
                .join("")}
              . The certificate PDF is attached.
            </p>

            <div className="mb-4 flex gap-2">
              <input
                className="input"
                type="email"
                placeholder="Send a test of the previewed row to…"
                value={testTo}
                onChange={(e) => setTestTo(e.target.value)}
              />
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
              <p className="mt-2 text-xs text-slate-500">
                {filledRows.length - emailRows.length} row(s) have no valid email and will be skipped.
              </p>
            )}
            <p className="mt-2 text-xs text-slate-500">
              Gmail allows about 500 emails per day from one account. Rows already marked “sent” are not sent again.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
