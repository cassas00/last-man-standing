import {
  validateAdminAddPlayer,
  validateAdminSetPick,
  type AdminAddPlayerRequest,
  type AdminSetPickRequest,
} from "./admin-pool";
import { addPlayerToState, applyPickToState } from "./pool-mutations";
import type { PoolState } from "../types/pool";
import { emptyPoolState, migratePoolState } from "../types/pool";
import { getAdminToken } from "./results-store";

const ADMIN_ENTRIES_API = "/api/admin/entries";
const POOL_DEV_KEY = "lms-pool-dev";

function readDevPool(): PoolState {
  const raw = localStorage.getItem(POOL_DEV_KEY);
  if (!raw) return emptyPoolState();
  try {
    return migratePoolState(JSON.parse(raw));
  } catch {
    return emptyPoolState();
  }
}

function writeDevPool(state: PoolState) {
  localStorage.setItem(POOL_DEV_KEY, JSON.stringify(state));
}

export async function adminAddPlayer(
  request: AdminAddPlayerRequest,
): Promise<{ ok: boolean; state?: PoolState; playerId?: string; error?: string }> {
  const token = getAdminToken();

  try {
    const res = await fetch(ADMIN_ENTRIES_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ action: "addPlayer", ...request }),
    });
    const body = (await res.json()) as {
      ok: boolean;
      state?: PoolState;
      playerId?: string;
      error?: string;
    };
    if (body.ok && body.state) {
      writeDevPool(migratePoolState(body.state));
    }
    return body;
  } catch {
    if (token !== "dev-admin") {
      return { ok: false, error: "Could not add player. Use pnpm dev:netlify for shared storage." };
    }

    const state = readDevPool();
    const error = validateAdminAddPlayer(state, request);
    if (error) return { ok: false, error };

    const playerId = addPlayerToState(state, request.name);
    if (request.round !== undefined && request.teamId) {
      applyPickToState(state, {
        playerId,
        round: request.round,
        teamId: request.teamId,
        name: request.name,
      });
    }

    writeDevPool(state);
    return { ok: true, state, playerId };
  }
}

export async function adminSetPick(
  request: AdminSetPickRequest,
): Promise<{ ok: boolean; state?: PoolState; error?: string }> {
  const token = getAdminToken();

  try {
    const res = await fetch(ADMIN_ENTRIES_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ action: "setPick", ...request }),
    });
    const body = (await res.json()) as { ok: boolean; state?: PoolState; error?: string };
    if (body.ok && body.state) {
      writeDevPool(migratePoolState(body.state));
    }
    return body;
  } catch {
    if (token !== "dev-admin") {
      return { ok: false, error: "Could not save pick. Use pnpm dev:netlify for shared storage." };
    }

    const state = readDevPool();
    const error = validateAdminSetPick(state, request);
    if (error) return { ok: false, error };

    applyPickToState(state, request);
    writeDevPool(state);
    return { ok: true, state };
  }
}
