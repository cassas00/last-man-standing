import type { Config, Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import type { PoolSettings, RoundExtension } from "../../src/types/pool-settings";
import { emptyPoolSettings, migratePoolSettings } from "../../src/types/pool-settings";
import { getAuthHeader, verifyAdminToken } from "../lib/admin-auth";

const STORE_NAME = "lms-pool";
const SETTINGS_KEY = "settings";

async function readSettings(store: ReturnType<typeof getStore>): Promise<PoolSettings> {
  const raw = await store.get(SETTINGS_KEY, { type: "json" });
  return migratePoolSettings(raw);
}

function validatePrizeAmount(value: unknown): string | null {
  if (typeof value !== "string") return "Prize amount must be text.";
  const trimmed = value.trim();
  if (trimmed.length > 40) return "Prize amount is too long (40 characters max).";
  return null;
}

function validateRoundExtension(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "object") return "Invalid round extension.";
  const ext = value as RoundExtension;
  if (typeof ext.cutoffAt !== "string" || Number.isNaN(Date.parse(ext.cutoffAt))) {
    return "Extension deadline must be a valid date/time.";
  }
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

    let body: {
      prizeAmount?: string;
      roundExtensions?: Record<string, RoundExtension | null>;
    };
    try {
      body = await req.json();
    } catch {
      return Response.json({ ok: false, error: "Invalid request body." }, { status: 400 });
    }

    const current = await readSettings(store);
    const updated: PoolSettings = {
      ...current,
      updatedAt: new Date().toISOString(),
    };

    if (body.prizeAmount !== undefined) {
      const error = validatePrizeAmount(body.prizeAmount);
      if (error) return Response.json({ ok: false, error }, { status: 400 });
      updated.prizeAmount = body.prizeAmount.trim();
    }

    if (body.roundExtensions !== undefined) {
      if (typeof body.roundExtensions !== "object" || body.roundExtensions === null) {
        return Response.json({ ok: false, error: "Invalid round extensions." }, { status: 400 });
      }

      const merged = { ...(current.roundExtensions ?? {}) };
      for (const [round, ext] of Object.entries(body.roundExtensions)) {
        if (ext === null) {
          delete merged[round];
          continue;
        }
        const error = validateRoundExtension(ext);
        if (error) return Response.json({ ok: false, error }, { status: 400 });
        merged[round] = { cutoffAt: ext.cutoffAt, updatedAt: new Date().toISOString() };
      }
      updated.roundExtensions = merged;
    }

    await store.setJSON(SETTINGS_KEY, updated);
    return Response.json({ ok: true, settings: updated });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = {
  path: "/api/pool-settings",
};
