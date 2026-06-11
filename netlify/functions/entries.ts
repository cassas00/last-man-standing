import type { Config, Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import type { PoolState, SubmitPickRequest } from "../../src/types/pool";
import { emptyPoolState, migratePoolState } from "../../src/types/pool";
import { validatePick } from "../../src/lib/pool-validation";
import { playerSlots } from "../../src/data/game";

const STORE_NAME = "lms-pool";
const STATE_KEY = "state";

async function readState(store: ReturnType<typeof getStore>): Promise<PoolState> {
  const state = await store.get(STATE_KEY, { type: "json" });
  return migratePoolState(state);
}

function applyPick(state: PoolState, body: SubmitPickRequest): void {
  const existing = state.entries[body.playerId];
  const now = new Date().toISOString();
  const otherPicks = (existing?.picks ?? []).filter((p) => p.round !== body.round);
  const name =
    body.round === 1
      ? body.name!.trim()
      : (existing?.name ?? "");

  state.entries[body.playerId] = {
    playerId: body.playerId,
    name,
    picks: [...otherPicks, { round: body.round, teamId: body.teamId }],
    enteredAt: existing?.enteredAt ?? now,
    updatedAt: now,
  };
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

    if (!playerSlots.some((s) => s.id === body.playerId)) {
      return Response.json({ ok: false, error: "Invalid player." }, { status: 400 });
    }

    const state = await readState(store);
    const error = validatePick(state, body);
    if (error) {
      return Response.json({ ok: false, error }, { status: 400 });
    }

    applyPick(state, body);
    await store.setJSON(STATE_KEY, state);
    return Response.json({ ok: true, state });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = {
  path: "/api/entries",
};
