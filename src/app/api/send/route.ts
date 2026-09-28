import { NextResponse } from "next/server";
import nodemailer, { type Transporter } from "nodemailer";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_ATTACHMENT_BYTES = 3.5 * 1024 * 1024; // Vercel caps request bodies at 4.5 MB
const EMAIL_RE = /^[^\s@<>,;"]+@[^\s@<>,;"]+\.[^\s@<>,;"]+$/;

let transporter: Transporter | null = null;
function getTransporter(): Transporter {
  transporter ??= nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
  });
  return transporter;
}

const configured = () => Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);

/**
 * Lets the UI show whether email is set up, and which address it sends from.
 * `?verify=1` also signs in to Gmail to check the App Password (sends nothing).
 */
export async function GET(request: Request) {
  const info = { configured: configured(), from: process.env.GMAIL_USER ?? null };
  if (!new URL(request.url).searchParams.has("verify") || !info.configured) return NextResponse.json(info);
  try {
    await getTransporter().verify();
    return NextResponse.json({ ...info, verified: true });
  } catch (err) {
    transporter = null;
    const message = err instanceof Error ? err.message : "Unknown error";
    const hint = /Invalid login|Username and Password not accepted|535/i.test(message)
      ? "Gmail rejected the login. Check GMAIL_USER and that GMAIL_APP_PASSWORD is a 16-letter App Password (not the normal password)."
      : message;
    return NextResponse.json({ ...info, verified: false, error: hint });
  }
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Sends one certificate. Body: multipart form with to, subject, body, file (PDF). */
export async function POST(request: Request) {
  if (!configured()) {
    return NextResponse.json({ error: "Email is not configured (GMAIL_USER / GMAIL_APP_PASSWORD)." }, { status: 500 });
  }
  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const to = String(form.get("to") ?? "").trim();
  const subject = String(form.get("subject") ?? "").trim().slice(0, 300);
  const body = String(form.get("body") ?? "").slice(0, 10_000);
  const file = form.get("file");

  if (!EMAIL_RE.test(to)) return NextResponse.json({ error: `Invalid email address: ${to}` }, { status: 400 });
  if (!subject) return NextResponse.json({ error: "Subject is empty" }, { status: 400 });
  if (!(file instanceof File) || file.type !== "application/pdf") {
    return NextResponse.json({ error: "Missing PDF attachment" }, { status: 400 });
  }
  if (file.size > MAX_ATTACHMENT_BYTES) return NextResponse.json({ error: "Attachment too large" }, { status: 413 });

  const filename = file.name.replace(/[\r\n"]/g, "").slice(0, 120) || "certificate.pdf";
  try {
    await getTransporter().sendMail({
      from: { name: process.env.MAIL_FROM_NAME || "Certificates", address: process.env.GMAIL_USER! },
      to,
      subject,
      text: body,
      html: `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#222">${escapeHtml(body).replace(/\n/g, "<br>")}</div>`,
      attachments: [{ filename, content: Buffer.from(await file.arrayBuffer()), contentType: "application/pdf" }],
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    transporter = null; // force a fresh connection on the next attempt
    const message = err instanceof Error ? err.message : "Unknown error";
    const status = /Invalid login|Username and Password not accepted/i.test(message) ? 502 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
