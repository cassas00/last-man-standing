import { createHmac, timingSafeEqual } from "node:crypto";

const ADMIN_USER = "subzero";
const ADMIN_PASS = "freeze";
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SECRET = `lms-admin-${ADMIN_PASS}`;

export function verifyCredentials(username: string, password: string): boolean {
  return username === ADMIN_USER && password === ADMIN_PASS;
}

export function createAdminToken(): string {
  const payload = Buffer.from(
    JSON.stringify({ u: ADMIN_USER, exp: Date.now() + TOKEN_TTL_MS }),
  ).toString("base64url");
  const sig = createHmac("sha256", SECRET).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyAdminToken(token: string | null | undefined): boolean {
  if (!token) return false;

  const [payload, sig] = token.replace(/^Bearer\s+/i, "").split(".");
  if (!payload || !sig) return false;

  const expected = createHmac("sha256", SECRET).update(payload).digest("base64url");
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return false;
  }

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as {
      u: string;
      exp: number;
    };
    return data.u === ADMIN_USER && data.exp > Date.now();
  } catch {
    return false;
  }
}

export function getAuthHeader(req: Request): string | null {
  return req.headers.get("Authorization");
}
