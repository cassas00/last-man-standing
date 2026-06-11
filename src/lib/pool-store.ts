import type { Player } from "../data/game";
import { playerSlots } from "../data/game";
import type { PoolState, SubmitPickRequest, SubmitPickResponse } from "../types/pool";
import { emptyPoolState, migratePoolState } from "../types/pool";
import { validatePick, getTeamsTakenInRound, getTeamsUsedByPlayer } from "./pool-validation";

const API_PATH = "/api/entries";
const DEV_STORAGE_KEY = "lms-pool-dev";
const MY_SLOT_KEY = "lms-my-slot";

export function getMySlotId(): string | null {
  return localStorage.getItem(MY_SLOT_KEY);
}

export function setMySlotId(playerId: string) {
  localStorage.setItem(MY_SLOT_KEY, playerId);
}

async function readDevState(): Promise<PoolState> {
  const raw = localStorage.getItem(DEV_STORAGE_KEY);
  if (!raw) return emptyPoolState();
  try {
    return migratePoolState(JSON.parse(raw));
  } catch {
    return emptyPoolState();
  }
}

function writeDevState(state: PoolState) {
  localStorage.setItem(DEV_STORAGE_KEY, JSON.stringify(state));
}

async function fetchFromApi(): Promise<PoolState | null> {
  try {
    const res = await fetch(API_PATH);
    if (!res.ok) return null;
    return migratePoolState(await res.json());
  } catch {
    return null;
  }
}

export async function loadPoolState(): Promise<{ state: PoolState; source: "api" | "local" }> {
  const apiState = await fetchFromApi();
  if (apiState) return { state: apiState, source: "api" };
  return { state: await readDevState(), source: "local" };
}

function applyPickToState(state: PoolState, request: SubmitPickRequest): PoolState {
  const existing = state.entries[request.playerId];
  const now = new Date().toISOString();
  const otherPicks = (existing?.picks ?? []).filter((p) => p.round !== request.round);
  const name =
    request.round === 1
      ? request.name!.trim()
      : (existing?.name ?? request.name?.trim() ?? "");

  state.entries[request.playerId] = {
    playerId: request.playerId,
    name,
    picks: [...otherPicks, { round: request.round, teamId: request.teamId }],
    enteredAt: existing?.enteredAt ?? now,
    updatedAt: now,
  };

  return state;
}

export async function submitPick(request: SubmitPickRequest): Promise<SubmitPickResponse> {
  try {
    const res = await fetch(API_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    const body = (await res.json()) as SubmitPickResponse;
    if (body.ok && body.state) {
      setMySlotId(request.playerId);
      writeDevState(migratePoolState(body.state));
    }
    return body;
  } catch {
    const state = await readDevState();
    const error = validatePick(state, request);
    if (error) return { ok: false, error };

    applyPickToState(state, request);
    writeDevState(state);
    setMySlotId(request.playerId);
    return { ok: true, state };
  }
}

/** @deprecated use submitPick */
export const submitEntry = submitPick;

export function playersFromPool(state: PoolState): Player[] {
  return playerSlots.map((slot) => {
    const entry = state.entries[slot.id];
    return {
      id: slot.id,
      alias: slot.alias,
      name: entry?.name ?? "—",
      picks: entry?.picks.map((p) => ({ round: p.round, teamId: p.teamId })) ?? [],
    };
  });
}

export function isSlotTaken(state: PoolState, playerId: string): boolean {
  return playerId in state.entries;
}

export { getTeamsTakenInRound, getTeamsUsedByPlayer, getAvailableTeamsForPlayer, getAliveRegisteredPlayers } from "./pool-validation";
