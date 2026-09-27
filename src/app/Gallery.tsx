"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Thumb from "@/components/Thumb";
import { type Design, SIZES } from "@/lib/design";
import { blankDesign, STARTERS } from "@/lib/starters";

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data as T;
}

export default function Gallery() {
  const router = useRouter();
  const [designs, setDesigns] = useState<Design[] | null>(null);
  const [storage, setStorage] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [query, setQuery] = useState("");

  const load = () =>
    api<{ designs: Design[]; storage: string }>("/api/designs")
      .then((d) => {
        setDesigns(d.designs);
        setStorage(d.storage);
      })
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const m = new Map<string, Design[]>();
    for (const d of designs ?? []) {
      if (q && !`${d.name} ${d.event}`.toLowerCase().includes(q)) continue;
      const k = d.event || "Other";
      m.set(k, [...(m.get(k) ?? []), d]);
    }
    return [...m.entries()];
  }, [designs, query]);

  const create = async (d: Design) => {
    setBusy(true);
    try {
      const { design } = await api<{ design: Design }>("/api/designs", { method: "POST", body: JSON.stringify(d) });
      router.push(`/editor/${design.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  const addStarters = async () => {
    setBusy(true);
    try {
      await api("/api/designs", { method: "POST", body: JSON.stringify({ starters: true }) });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setBusy(false);
  };

  const duplicate = (d: Design) => create({ ...d, name: `${d.name} (copy)` });
  const remove = async (d: Design) => {
    if (!window.confirm(`Delete “${d.name}”? This can't be undone.`)) return;
    try {
      await api(`/api/designs/${d.id}`, { method: "DELETE" });
      setDesigns((ds) => ds?.filter((x) => x.id !== d.id) ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div className="mr-auto">
          <h1 className="text-2xl font-semibold text-navy-800">Certificate designs</h1>
          <p className="text-sm text-slate-500">Edit a design like in Canva, then use it to create and email certificates.</p>
        </div>
        <input className="input w-56" placeholder="Search designs…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <button className="btn-gold" onClick={() => setNewOpen(true)}>
          + New design
        </button>
      </div>

      {storage === "local" && (
        <p className="mb-4 rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-800">
          Designs are being saved on this computer only (no DATABASE_URL set). Connect Supabase before going live.
        </p>
      )}
      {error && (
        <p className="mb-4 flex justify-between rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
          <button onClick={() => setError(null)}>✕</button>
        </p>
      )}

      {designs === null && !error && <p className="text-slate-500">Loading designs…</p>}

      {designs?.length === 0 && (
        <div className="card p-8 text-center">
          <p className="mb-1 font-medium text-navy-800">No designs yet</p>
          <p className="mb-4 text-sm text-slate-500">
            Start with the {STARTERS.length} RIT designs recreated from your Canva certificates, or start from scratch.
          </p>
          <div className="flex justify-center gap-2">
            <button className="btn-primary" disabled={busy} onClick={addStarters}>
              {busy ? "Adding…" : `Add the ${STARTERS.length} starter designs`}
            </button>
            <button className="btn-ghost" onClick={() => setNewOpen(true)}>
              Blank design
            </button>
          </div>
        </div>
      )}

      <div className="space-y-10">
        {groups.map(([event, list]) => (
          <section key={event}>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              {event} <span className="font-normal normal-case">· {list.length}</span>
            </h2>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((d) => (
                <article key={d.id} className="card group overflow-hidden">
                  <Link href={`/editor/${d.id}`} className="block border-b border-slate-100 bg-slate-50" title="Edit design">
                    <Thumb design={d} />
                  </Link>
                  <div className="p-3">
                    <h3 className="truncate font-medium text-navy-800" title={d.name}>
                      {d.name}
                    </h3>
                    <div className="mt-2 flex items-center gap-2">
                      <Link href={`/generate/${d.id}`} className="btn-gold px-3 py-1.5">
                        Create certificates
                      </Link>
                      <Link href={`/editor/${d.id}`} className="btn-ghost px-3 py-1.5">
                        Edit
                      </Link>
                      <details className="relative ml-auto">
                        <summary className="btn-ghost cursor-pointer list-none px-2.5 py-1.5" aria-label="More">
                          ⋯
                        </summary>
                        <div className="absolute right-0 z-20 mt-1 w-36 rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg">
                          <button className="block w-full px-3 py-1.5 text-left hover:bg-slate-50" onClick={() => duplicate(d)}>
                            Duplicate
                          </button>
                          <button className="block w-full px-3 py-1.5 text-left text-red-600 hover:bg-red-50" onClick={() => remove(d)}>
                            Delete
                          </button>
                        </div>
                      </details>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>

      {designs && designs.length > 0 && (
        <p className="mt-10 text-center text-xs text-slate-400">
          Missing a starter?{" "}
          <button className="underline" disabled={busy} onClick={addStarters}>
            Add all {STARTERS.length} starter designs again
          </button>
        </p>
      )}

      {newOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setNewOpen(false)}>
          <div className="card max-h-[85vh] w-full max-w-3xl overflow-auto p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-navy-800">New design</h2>
              <button onClick={() => setNewOpen(false)}>✕</button>
            </div>
            <p className="label">Blank</p>
            <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {SIZES.map((s) => (
                <button key={s.label} disabled={busy} onClick={() => create(blankDesign(s.width, s.height))} className="rounded-lg border border-slate-200 p-3 text-left hover:border-gold-500">
                  <div className="mb-2 rounded bg-slate-100" style={{ aspectRatio: `${s.width} / ${s.height}`, maxHeight: 90 }} />
                  <span className="text-sm font-medium">{s.label}</span>
                </button>
              ))}
            </div>
            <p className="label">Start from a starter design</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {STARTERS.map((s) => (
                <button key={s.name} disabled={busy} onClick={() => create({ ...structuredClone(s), name: s.name })} className="overflow-hidden rounded-lg border border-slate-200 text-left hover:border-gold-500">
                  <Thumb design={s} />
                  <span className="block truncate px-2 py-1.5 text-xs font-medium">{s.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
