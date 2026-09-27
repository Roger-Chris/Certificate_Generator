/** Stateless signed session cookie: "<expiry-ms>.<hex HMAC-SHA256(expiry)>". Web Crypto, so it runs anywhere. */

export const SESSION_COOKIE = "cg_session";
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

async function hmac(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function secret(): string | null {
  const s = process.env.AUTH_SECRET;
  return s && s.length >= 16 ? s : null;
}

export async function createSessionToken(): Promise<string> {
  const s = secret();
  if (!s) throw new Error("AUTH_SECRET is not configured (needs at least 16 characters)");
  const exp = String(Date.now() + SESSION_TTL_MS);
  return `${exp}.${await hmac(exp, s)}`;
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  const s = secret();
  if (!s || !token) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig || !/^\d+$/.test(exp) || Number(exp) < Date.now()) return false;
  return timingSafeEqual(sig, await hmac(exp, s));
}

export async function checkPassword(input: string): Promise<boolean> {
  const expected = process.env.ADMIN_PASSWORD;
  const s = secret();
  if (!expected || !s) return false;
  // Compare HMACs so the comparison time doesn't depend on where the strings differ.
  return timingSafeEqual(await hmac(input, s), await hmac(expected, s));
}
