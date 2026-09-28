"use client";

import { useEffect, useState } from "react";

type Mail = { configured: boolean; from: string | null; verified?: boolean; error?: string };

const Badge = ({ ok, children }: { ok: boolean | null; children: React.ReactNode }) => (
  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${ok === null ? "bg-slate-100 text-slate-600" : ok ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>{children}</span>
);

export default function SettingsClient() {
  const [mail, setMail] = useState<Mail | null>(null);
  const [checking, setChecking] = useState(false);
  const [storage, setStorage] = useState<{ mode: string; ok: boolean; error?: string } | null>(null);

  const verify = async () => {
    setChecking(true);
    const r = await fetch("/api/send?verify=1").then((x) => x.json()).catch(() => null);
    setMail(r ?? { configured: false, from: null, verified: false, error: "Could not reach the server" });
    setChecking(false);
  };

  useEffect(() => {
    document.title = "Settings · RIT Certificate Generator";
    verify();
    fetch("/api/designs")
      .then(async (r) => {
        const d = await r.json();
        setStorage(r.ok ? { mode: d.storage, ok: true } : { mode: "?", ok: false, error: d.error });
      })
      .catch(() => setStorage({ mode: "?", ok: false, error: "Could not reach the server" }));
  }, []);

  const mailOk = mail ? (mail.verified === true ? true : mail.configured ? (mail.verified === false ? false : null) : false) : null;

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-semibold text-navy-800">Settings</h1>

      <section className="card p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-navy-800">Gmail (sending certificates)</h2>
          <Badge ok={mailOk}>{!mail ? "Checking…" : mail.verified ? "Connected" : mail.configured ? "Not working" : "Not set up"}</Badge>
        </div>
        {mail && (
          <p className="mb-3 text-sm text-slate-600">
            Sender: <b>{mail.from || "—"}</b>
            {mail.error && <span className="mt-1 block text-red-700">{mail.error}</span>}
          </p>
        )}
        <button className="btn-ghost mb-5" disabled={checking} onClick={verify}>
          {checking ? "Checking…" : "Check connection again"}
        </button>

        <h3 className="mb-2 text-sm font-semibold text-slate-700">One-time setup (about 3 minutes)</h3>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-700">
          <li>
            In your own browser, sign in to Gmail as <b>rit.ecertificate@gmail.com</b>.
          </li>
          <li>
            Open{" "}
            <a className="text-navy-600 underline" href="https://myaccount.google.com/signinoptions/twosv" target="_blank" rel="noreferrer">
              Google Account → Security → 2-Step Verification
            </a>{" "}
            and turn it on (Google requires it for App Passwords).
          </li>
          <li>
            Open{" "}
            <a className="text-navy-600 underline" href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer">
              App passwords
            </a>
            , type the name <i>Certificate Generator</i> and click <b>Create</b>. Copy the 16-letter password it shows (spaces don&apos;t matter).
          </li>
          <li>
            Paste it into the project settings — never into chat or the code:
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li>
                <b>On this computer:</b> open <code>.env.local</code> in the project folder and set <code>GMAIL_APP_PASSWORD=</code>
                <i>your 16 letters</i>, then restart <code>npm run dev</code>.
              </li>
              <li>
                <b>On Vercel:</b> Project → Settings → Environment Variables → add <code>GMAIL_USER</code> = rit.ecertificate@gmail.com and{" "}
                <code>GMAIL_APP_PASSWORD</code>, then redeploy.
              </li>
            </ul>
          </li>
          <li>
            Come back here and click <b>Check connection again</b>, then send yourself a test from any design&apos;s “Create certificates” page.
          </li>
        </ol>
        <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Gmail allows about 500 emails a day from a normal account. For bigger batches, send over two days or use a Google
          Workspace account (2,000/day).
        </p>
      </section>

      <section className="card p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-navy-800">Design storage</h2>
          <Badge ok={storage ? storage.ok && storage.mode === "supabase" : null}>
            {!storage ? "Checking…" : !storage.ok ? "Error" : storage.mode === "supabase" ? "Supabase connected" : "This computer only"}
          </Badge>
        </div>
        {storage?.error && <p className="mb-2 text-sm text-red-700">{storage.error}</p>}
        <p className="text-sm text-slate-600">
          Designs and uploaded images are saved in Supabase when <code>DATABASE_URL</code> is set. Use the{" "}
          <b>Transaction pooler</b> connection string from Supabase → <b>Connect</b> (it ends in <code>:6543/postgres</code>), with your
          database password filled in. Tables are created automatically on first use.
        </p>
      </section>
    </main>
  );
}
