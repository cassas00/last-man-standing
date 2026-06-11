import type { Config, Context } from "@netlify/functions";
import { createAdminToken, verifyCredentials } from "../lib/admin-auth";

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let body: { username?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  }

  const username = body.username?.trim() ?? "";
  const password = body.password ?? "";

  if (!verifyCredentials(username, password)) {
    return Response.json({ ok: false, error: "Invalid credentials." }, { status: 401 });
  }

  return Response.json({ ok: true, token: createAdminToken() });
};

export const config: Config = {
  path: "/api/admin/login",
};
