"use client";

import Link from "next/link";

export default function Header({ crumbs = [] }: { crumbs?: { href?: string; label: string }[] }) {
  const logout = async () => {
    await fetch("/api/login", { method: "DELETE" });
    window.location.href = "/login";
  };
  return (
    <header className="bg-navy-800 text-white">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-gold-500 text-sm font-bold">RIT</span>
          <span className="hidden sm:inline">Certificate Generator</span>
        </Link>
        {crumbs.map((c, i) => (
          <span key={i} className="flex min-w-0 items-center gap-3 text-sm text-navy-100">
            <span>/</span>
            {c.href ? (
              <Link href={c.href} className="truncate hover:text-white">
                {c.label}
              </Link>
            ) : (
              <span className="truncate text-white">{c.label}</span>
            )}
          </span>
        ))}
        <nav className="ml-auto flex items-center gap-4 text-sm">
          <Link href="/editor" className="text-navy-100 hover:text-white">
            Template editor
          </Link>
          <button onClick={logout} className="text-navy-100 hover:text-white">
            Sign out
          </button>
        </nav>
      </div>
    </header>
  );
}
