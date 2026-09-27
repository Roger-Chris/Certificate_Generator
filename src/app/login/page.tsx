"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

function LoginForm() {
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      const next = params.get("next");
      // Only follow same-site relative paths.
      window.location.href = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
      return;
    }
    const data = await res.json().catch(() => ({}));
    setError(data.error ?? "Sign in failed");
    setBusy(false);
  };

  return (
    <form onSubmit={submit} className="card w-full max-w-sm p-8">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-lg bg-navy-800 font-bold text-gold-400">RIT</div>
        <h1 className="text-xl font-semibold text-navy-800">Certificate Generator</h1>
        <p className="mt-1 text-sm text-slate-500">Rajalakshmi Institute of Technology</p>
      </div>
      <label className="label" htmlFor="pw">
        Admin password
      </label>
      <input
        id="pw"
        type="password"
        autoFocus
        className="input"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <button className="btn-primary mt-5 w-full" disabled={busy || !password}>
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-navy-900 p-4">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
