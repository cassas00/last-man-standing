import type { Player } from "../data/game";
import type { PoolState, SubmitPickRequest, SubmitPickResponse } from "../types/pool";
import { emptyPoolState, migratePoolState } from "../types/pool";
import { applyPickToState as applyPickMutation } from "./pool-mutations";
import { validatePick, getTeamsTakenInRound, getTeamsUsedByPlayer } from "./pool-validation";
import { getLiveMatches } from "./live-matches";
import { loadPoolSettings } from "./pool-settings-store";
import { loadResults } from "./results-store";
import { scheduleOptionsFromSettings } from "./schedule-options";

const API_PATH = "/api/entries";
const DEV_STORAGE_KEY = "lms-pool-dev";

const fetchOpts: RequestInit = { cache: "no-store" };

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
    const res = await fetch(API_PATH, fetchOpts);
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
  applyPickMutation(state, request);
  return state;
}

export async function submitPick(request: SubmitPickRequest): Promise<SubmitPickResponse> {
  try {
    const res = await fetch(API_PATH, {
      ...fetchOpts,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    const body = (await res.json()) as SubmitPickResponse;
    if (body.ok && body.state) {
      writeDevState(migratePoolState(body.state));
      return body;
    }
    return body;
  } catch {
    const [state, settings, results] = await Promise.all([
      readDevState(),
      loadPoolSettings(),
      loadResults(),
    ]);
    const scheduleOptions = scheduleOptionsFromSettings(settings);
    const liveMatches = getLiveMatches(results);
    const error = validatePick(state, request, Date.now(), scheduleOptions, liveMatches);
    if (error) return { ok: false, error };

    applyPickToState(state, request);
    writeDevState(state);
    return { ok: true, state };
  }
}

/** @deprecated use submitPick */
export const submitEntry = submitPick;

export function playersFromPool(state: PoolState): Player[] {
  return Object.values(state.entries).map((entry) => ({
    id: entry.playerId,
    name: entry.name,
    picks: entry.picks.map((p) => ({ round: p.round, teamId: p.teamId })),
  }));
}

export function isSlotTaken(state: PoolState, playerId: string): boolean {
  return playerId in state.entries;
}

export {
  getTeamsTakenInRound,
  getTeamsUsedByPlayer,
  getAvailableTeamsForPlayer,
  getAliveRegisteredPlayers,
  isFinalRound,
} from "./pool-validation";
