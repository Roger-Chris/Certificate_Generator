import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { EventTemplate } from "./types";

const TEMPLATES_DIR = path.join(process.cwd(), "public", "templates");

/** Reads every public/templates/<slug>/event.json. Pages using this are statically rendered at build time. */
export function listEvents(): EventTemplate[] {
  if (!fs.existsSync(TEMPLATES_DIR)) return [];
  const events: EventTemplate[] = [];
  for (const dir of fs.readdirSync(TEMPLATES_DIR, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    const file = path.join(TEMPLATES_DIR, dir.name, "event.json");
    if (!fs.existsSync(file)) continue;
    const ev = JSON.parse(fs.readFileSync(file, "utf8")) as EventTemplate;
    // The folder name is the source of truth for URLs and image paths.
    events.push({ ...ev, slug: dir.name });
  }
  return events.sort((a, b) => (b.order ?? 0) - (a.order ?? 0) || a.name.localeCompare(b.name));
}

export function getEvent(slug: string): EventTemplate | undefined {
  return listEvents().find((e) => e.slug === slug);
}
