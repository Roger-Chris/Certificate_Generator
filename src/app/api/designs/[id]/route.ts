import { NextResponse } from "next/server";
import { validateDesign } from "@/lib/validate";
import { ConflictError, deleteDesign, getDesign, NotFoundError, saveDesign } from "@/lib/store";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const fail = (e: unknown) => {
  if (e instanceof NotFoundError) return NextResponse.json({ error: e.message }, { status: 404 });
  if (e instanceof ConflictError)
    return NextResponse.json({ error: "Someone else saved this design after you opened it. Reload to get their changes." }, { status: 409 });
  return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 });
};

export async function GET(_req: Request, { params }: Ctx) {
  try {
    return NextResponse.json({ design: await getDesign((await params).id) });
  } catch (e) {
    return fail(e);
  }
}

/** Body: { design, expectedUpdatedAt? } */
export async function PUT(request: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  try {
    const d = validateDesign(body?.design);
    const saved = await saveDesign({ ...d, id }, typeof body?.expectedUpdatedAt === "string" ? body.expectedUpdatedAt : undefined);
    return NextResponse.json({ design: saved });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    await deleteDesign((await params).id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
