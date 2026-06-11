import type { Config, Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import type { PoolSettings } from "../../src/types/pool-settings";
import { emptyPoolSettings } from "../../src/types/pool-settings";
import { getAuthHeader, verifyAdminToken } from "../lib/admin-auth";

const STORE_NAME = "lms-pool";
const SETTINGS_KEY = "settings";

async function readSettings(store: ReturnType<typeof getStore>): Promise<PoolSettings> {
  const raw = await store.get(SETTINGS_KEY, { type: "json" });
  if (!raw || typeof raw !== "object") return emptyPoolSettings();
  const data = raw as PoolSettings;
  return {
    version: 1,
    prizeAmount: typeof data.prizeAmount === "string" ? data.prizeAmount : "",
    updatedAt: data.updatedAt,
  };
}

function validatePrizeAmount(value: unknown): string | null {
  if (typeof value !== "string") return "Prize amount must be text.";
  const trimmed = value.trim();
  if (trimmed.length > 40) return "Prize amount is too long (40 characters max).";
  return null;
}

export default async (req: Request, _context: Context) => {
  const store = getStore(STORE_NAME);

  if (req.method === "GET") {
    const settings = await readSettings(store);
    return Response.json(settings, {
      headers: { "Cache-Control": "no-store" },
    });
  }

  if (req.method === "POST") {
    if (!verifyAdminToken(getAuthHeader(req))) {
      return Response.json({ ok: false, error: "Unauthorized." }, { status: 401 });
    }

    let body: { prizeAmount?: string };
    try {
      body = await req.json();
    } catch {
      return Response.json({ ok: false, error: "Invalid request body." }, { status: 400 });
    }

    const error = validatePrizeAmount(body.prizeAmount ?? "");
    if (error) {
      return Response.json({ ok: false, error }, { status: 400 });
    }

    const settings: PoolSettings = {
      version: 1,
      prizeAmount: (body.prizeAmount ?? "").trim(),
      updatedAt: new Date().toISOString(),
    };

    await store.setJSON(SETTINGS_KEY, settings);
    return Response.json({ ok: true, settings });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = {
  path: "/api/pool-settings",
};
