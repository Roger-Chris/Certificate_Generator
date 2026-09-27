import { NextResponse } from "next/server";
import { deleteAsset, getAsset, NotFoundError } from "@/lib/store";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ key: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { contentType, bytes } = await getAsset((await params).key);
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": contentType,
        // Keys are random and never reused, so the file can be cached for good (privately — it's behind login).
        "Cache-Control": "private, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    const status = e instanceof NotFoundError ? 404 : 500;
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status });
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    await deleteAsset((await params).key);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 });
  }
}
