import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";
import type { Design } from "./design";

/**
 * Persistence for designs and uploaded images.
 *  - DATABASE_URL set (Supabase Postgres, transaction pooler) → tables cg_designs / cg_assets, created on first use.
 *  - otherwise → JSON/binary files under .data/ (local development only; Vercel's filesystem is read-only).
 */

export class ConflictError extends Error {}
export class NotFoundError extends Error {}

export interface AssetInfo {
  key: string;
  name: string;
  size: number;
  url: string;
}

const assetUrl = (key: string) => `/api/assets/${key}`;

// ------------------------------------------------------------------ Postgres

let sql: postgres.Sql | null = null;
let schemaReady: Promise<unknown> | null = null;

function pg(): postgres.Sql | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  // prepare:false is required behind Supabase's transaction pooler (PgBouncer).
  sql ??= postgres(url, { prepare: false, max: 3, idle_timeout: 20, ssl: url.includes("localhost") ? false : "require" });
  schemaReady ??= (async () => {
    await sql!`create table if not exists cg_designs (
      id text primary key,
      name text not null,
      event text not null default '',
      data jsonb not null,
      updated_at timestamptz not null default now(),
      created_at timestamptz not null default now())`;
    await sql!`create table if not exists cg_assets (
      key text primary key,
      name text not null,
      content_type text not null,
      size integer not null,
      bytes bytea not null,
      created_at timestamptz not null default now())`;
    // No policies: blocks Supabase's public REST API; this server connects as the table owner.
    await sql!`alter table cg_designs enable row level security`;
    await sql!`alter table cg_assets enable row level security`;
  })().catch((e) => {
    schemaReady = null;
    throw e;
  });
  return sql;
}
async function db() {
  const s = pg();
  if (s) await schemaReady;
  return s;
}

// ------------------------------------------------------------------ local files

const DATA = path.join(process.cwd(), ".data");
const localDir = async (sub: string) => {
  if (process.env.VERCEL) throw new Error("Storage is not configured: set DATABASE_URL (Supabase) in the Vercel project settings.");
  const dir = path.join(DATA, sub);
  await fs.mkdir(dir, { recursive: true });
  return dir;
};
const safeKey = (k: string) => {
  if (!/^[a-z0-9-]+(\.[a-z0-9]+)?$/i.test(k)) throw new NotFoundError("Bad key");
  return k;
};

// ------------------------------------------------------------------ designs

export async function listDesigns(): Promise<Design[]> {
  const s = await db();
  if (s) {
    const rows = await s<{ data: Design; updated_at: Date }[]>`select data, updated_at from cg_designs order by event, name`;
    return rows.map((r) => ({ ...r.data, updatedAt: r.updated_at.toISOString() }));
  }
  const dir = await localDir("designs");
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".json"));
  const all = await Promise.all(files.map(async (f) => JSON.parse(await fs.readFile(path.join(dir, f), "utf8")) as Design));
  return all.sort((a, b) => a.event.localeCompare(b.event) || a.name.localeCompare(b.name));
}

export async function getDesign(id: string): Promise<Design> {
  const s = await db();
  if (s) {
    const [r] = await s<{ data: Design; updated_at: Date }[]>`select data, updated_at from cg_designs where id = ${id}`;
    if (!r) throw new NotFoundError("Design not found");
    return { ...r.data, updatedAt: r.updated_at.toISOString() };
  }
  try {
    return JSON.parse(await fs.readFile(path.join(await localDir("designs"), safeKey(id) + ".json"), "utf8"));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") throw new NotFoundError("Design not found");
    throw e;
  }
}

/** Insert or update. When `expectedUpdatedAt` is given and the stored copy is newer, throws ConflictError. */
export async function saveDesign(d: Design, expectedUpdatedAt?: string): Promise<Design> {
  const now = new Date();
  const { updatedAt: _ignored, ...data } = d;
  void _ignored;
  const s = await db();
  if (s) {
    return s.begin(async (tx) => {
      const [cur] = await tx<{ updated_at: Date }[]>`select updated_at from cg_designs where id = ${d.id} for update`;
      if (cur && expectedUpdatedAt && cur.updated_at.toISOString() !== expectedUpdatedAt) throw new ConflictError("Changed elsewhere");
      await tx`insert into cg_designs (id, name, event, data, updated_at)
        values (${d.id}, ${d.name}, ${d.event}, ${tx.json(data as never)}, ${now})
        on conflict (id) do update set name = excluded.name, event = excluded.event, data = excluded.data, updated_at = excluded.updated_at`;
      return { ...data, updatedAt: now.toISOString() } as Design;
    }) as Promise<Design>;
  }
  const file = path.join(await localDir("designs"), safeKey(d.id) + ".json");
  if (expectedUpdatedAt) {
    const cur = await fs.readFile(file, "utf8").then((t) => JSON.parse(t) as Design).catch(() => null);
    if (cur?.updatedAt && cur.updatedAt !== expectedUpdatedAt) throw new ConflictError("Changed elsewhere");
  }
  const saved = { ...data, updatedAt: now.toISOString() } as Design;
  await fs.writeFile(file, JSON.stringify(saved, null, 1));
  return saved;
}

export async function deleteDesign(id: string): Promise<void> {
  const s = await db();
  if (s) {
    await s`delete from cg_designs where id = ${id}`;
    return;
  }
  await fs.rm(path.join(await localDir("designs"), safeKey(id) + ".json"), { force: true });
}

// ------------------------------------------------------------------ assets (uploaded images)

export async function listAssets(): Promise<AssetInfo[]> {
  const s = await db();
  if (s) {
    const rows = await s<{ key: string; name: string; size: number }[]>`select key, name, size from cg_assets order by created_at desc`;
    return rows.map((r) => ({ ...r, url: assetUrl(r.key) }));
  }
  const dir = await localDir("assets");
  const metas = (await fs.readdir(dir)).filter((f) => f.endsWith(".meta.json"));
  const list = await Promise.all(metas.map(async (m) => JSON.parse(await fs.readFile(path.join(dir, m), "utf8"))));
  return list
    .sort((a, b) => b.created - a.created)
    .map((m) => ({ key: m.key, name: m.name, size: m.size, url: assetUrl(m.key) }));
}

export async function putAsset(name: string, contentType: string, bytes: Buffer): Promise<AssetInfo> {
  const ext = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif" }[contentType] ?? "bin";
  const key = `${crypto.randomUUID()}.${ext}`;
  const s = await db();
  if (s) {
    await s`insert into cg_assets (key, name, content_type, size, bytes) values (${key}, ${name}, ${contentType}, ${bytes.length}, ${bytes})`;
  } else {
    const dir = await localDir("assets");
    await fs.writeFile(path.join(dir, key), bytes);
    await fs.writeFile(path.join(dir, key + ".meta.json"), JSON.stringify({ key, name, contentType, size: bytes.length, created: Date.now() }));
  }
  return { key, name, size: bytes.length, url: assetUrl(key) };
}

export async function getAsset(key: string): Promise<{ contentType: string; bytes: Buffer }> {
  safeKey(key);
  const s = await db();
  if (s) {
    const [r] = await s<{ content_type: string; bytes: Buffer }[]>`select content_type, bytes from cg_assets where key = ${key}`;
    if (!r) throw new NotFoundError("Asset not found");
    return { contentType: r.content_type, bytes: r.bytes };
  }
  const dir = await localDir("assets");
  try {
    const meta = JSON.parse(await fs.readFile(path.join(dir, key + ".meta.json"), "utf8"));
    return { contentType: meta.contentType, bytes: await fs.readFile(path.join(dir, key)) };
  } catch {
    throw new NotFoundError("Asset not found");
  }
}

export async function deleteAsset(key: string): Promise<void> {
  safeKey(key);
  const s = await db();
  if (s) {
    await s`delete from cg_assets where key = ${key}`;
    return;
  }
  const dir = await localDir("assets");
  await fs.rm(path.join(dir, key), { force: true });
  await fs.rm(path.join(dir, key + ".meta.json"), { force: true });
}

export const storageMode = () => (process.env.DATABASE_URL ? "supabase" : "local");
