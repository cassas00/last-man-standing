import type { Config, Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import {
  validateAdminAddPlayer,
  validateAdminSetPick,
  type AdminAddPlayerRequest,
  type AdminSetPickRequest,
} from "../../src/lib/admin-pool";
import { addPlayerToState, applyPickToState } from "../../src/lib/pool-mutations";
import type { PoolState } from "../../src/types/pool";
import { emptyPoolState, migratePoolState } from "../../src/types/pool";
import { getAuthHeader, verifyAdminToken } from "../lib/admin-auth";

const STORE_NAME = "lms-pool";
const STATE_KEY = "state";

type AdminBody =
  | ({ action: "addPlayer" } & AdminAddPlayerRequest)
  | ({ action: "setPick" } & AdminSetPickRequest);

async function readState(store: ReturnType<typeof getStore>): Promise<PoolState> {
  const state = await store.get(STATE_KEY, { type: "json" });
  return migratePoolState(state);
}

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  if (!verifyAdminToken(getAuthHeader(req))) {
    return Response.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  let body: AdminBody;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  }

  const store = getStore(STORE_NAME);
  const state = await readState(store);

  if (body.action === "addPlayer") {
    const error = validateAdminAddPlayer(state, body);
    if (error) {
      return Response.json({ ok: false, error }, { status: 400 });
    }

    const playerId = addPlayerToState(state, body.name);

    if (body.round !== undefined && body.teamId) {
      applyPickToState(state, {
        playerId,
        round: body.round,
        teamId: body.teamId,
        name: body.name,
      });
    }

    await store.setJSON(STATE_KEY, state);
    return Response.json({ ok: true, state, playerId });
  }

  if (body.action === "setPick") {
    const error = validateAdminSetPick(state, body);
    if (error) {
      return Response.json({ ok: false, error }, { status: 400 });
    }

    applyPickToState(state, {
      playerId: body.playerId,
      round: body.round,
      teamId: body.teamId,
    });

    await store.setJSON(STATE_KEY, state);
    return Response.json({ ok: true, state });
  }

  return Response.json({ ok: false, error: "Unknown action." }, { status: 400 });
};

export const config: Config = {
  path: "/api/admin/entries",
};
