import { NextResponse } from "next/server";
import { listAssets, putAsset } from "@/lib/store";

export const runtime = "nodejs";

const MAX = 4 * 1024 * 1024; // Vercel request bodies are capped at 4.5 MB
const TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

export async function GET() {
  try {
    return NextResponse.json({ assets: await listAssets() });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}

/** Multipart upload with a single `file` field. */
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (!TYPES.has(file.type)) return NextResponse.json({ error: "Use a PNG, JPG, WEBP or GIF image" }, { status: 400 });
  if (file.size > MAX) return NextResponse.json({ error: "Image is larger than 4 MB" }, { status: 413 });
  try {
    const asset = await putAsset(file.name.slice(0, 120), file.type, Buffer.from(await file.arrayBuffer()));
    return NextResponse.json({ asset });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Upload failed" }, { status: 500 });
  }
}
