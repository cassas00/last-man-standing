import type { Config, Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import type { PoolState, SubmitPickRequest } from "../../src/types/pool";
import { migratePoolState } from "../../src/types/pool";
import { applyPickToState } from "../../src/lib/pool-mutations";
import { validatePick } from "../../src/lib/pool-validation";
import { getLiveMatches } from "../../src/lib/live-matches";
import { scheduleOptionsFromSettings } from "../../src/lib/schedule-options";
import { migratePoolSettings } from "../../src/types/pool-settings";
import { emptyResultsState } from "../../src/types/results";
import type { ResultsState } from "../../src/types/results";

const STORE_NAME = "lms-pool";
const STATE_KEY = "state";
const SETTINGS_KEY = "settings";
const RESULTS_KEY = "results";

async function readState(store: ReturnType<typeof getStore>): Promise<PoolState> {
  const state = await store.get(STATE_KEY, { type: "json" });
  return migratePoolState(state);
}

async function readResults(store: ReturnType<typeof getStore>): Promise<ResultsState> {
  const raw = await store.get(RESULTS_KEY, { type: "json" });
  if (!raw || typeof raw !== "object") return emptyResultsState();
  const data = raw as ResultsState;
  return { version: 1, results: data.results ?? {}, updatedAt: data.updatedAt };
}

export default async (req: Request, _context: Context) => {
  const store = getStore(STORE_NAME);

  if (req.method === "GET") {
    const state = await readState(store);
    return Response.json(state, {
      headers: { "Cache-Control": "no-store" },
    });
  }

  if (req.method === "POST") {
    let body: SubmitPickRequest;
    try {
      body = await req.json();
    } catch {
      return Response.json({ ok: false, error: "Invalid request body." }, { status: 400 });
    }

    const state = await readState(store);
    const settingsRaw = await store.get(SETTINGS_KEY, { type: "json" });
    const scheduleOptions = scheduleOptionsFromSettings(migratePoolSettings(settingsRaw));
    const results = await readResults(store);
    const liveMatches = getLiveMatches(results);

    const error = validatePick(state, body, Date.now(), scheduleOptions, liveMatches);
    if (error) {
      return Response.json({ ok: false, error }, { status: 400 });
    }

    applyPickToState(state, body);
    await store.setJSON(STATE_KEY, state);
    return Response.json({ ok: true, state });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = {
  path: "/api/entries",
};
