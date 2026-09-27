import Link from "next/link";
import Header from "@/components/Header";
import { listEvents } from "@/lib/templates";

export const dynamic = "force-static";

export default function Home() {
  const events = listEvents();
  return (
    <>
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-navy-800">Events</h1>
            <p className="text-sm text-slate-500">Pick an event to generate certificates.</p>
          </div>
          <Link href="/editor" className="btn-ghost">
            + New event template
          </Link>
        </div>
        {events.length === 0 && (
          <p className="card p-6 text-slate-500">
            No templates yet. Create one in the template editor and add it to <code>public/templates/</code>.
          </p>
        )}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((ev) => {
            const v = ev.variants[0];
            return (
              <Link key={ev.slug} href={`/generate/${ev.slug}`} className="card group overflow-hidden hover:shadow-md">
                {v && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/templates/${ev.slug}/${v.image}`}
                    alt=""
                    loading="lazy"
                    className="aspect-[1.414] w-full object-cover transition group-hover:scale-[1.02]"
                  />
                )}
                <div className="border-t border-slate-100 p-4">
                  <h2 className="font-semibold text-navy-800">{ev.name}</h2>
                  {ev.description && <p className="mt-0.5 text-sm text-slate-500">{ev.description}</p>}
                  <p className="mt-2 text-xs text-slate-400">
                    {ev.variants.length} design{ev.variants.length === 1 ? "" : "s"} ·{" "}
                    {ev.variants.map((x) => x.label).join(", ")}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </main>
    </>
  );
}
