import { NextResponse } from "next/server";
import { type Design, newId } from "@/lib/design";
import { validateDesign } from "@/lib/validate";
import { listDesigns, saveDesign, storageMode } from "@/lib/store";
import { STARTERS } from "@/lib/starters";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json({ designs: await listDesigns(), storage: storageMode() });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed to load designs" }, { status: 500 });
  }
}

/** Create a design. Body: a design, or { starters: true } to add all starter designs. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  try {
    if (body?.starters === true) {
      const created: Design[] = [];
      for (const s of STARTERS) created.push(await saveDesign({ ...structuredClone(s), id: newId() }));
      return NextResponse.json({ designs: created });
    }
    const d = validateDesign(body);
    const saved = await saveDesign({ ...d, id: newId() });
    return NextResponse.json({ design: saved });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 });
  }
}
