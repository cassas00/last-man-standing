import type { ResultsState } from "../types/results";
import { emptyResultsState } from "../types/results";
import { getLiveMatches } from "./live-matches";

const RESULTS_API = "/api/results";
const LOGIN_API = "/api/admin/login";
const DEV_STORAGE_KEY = "lms-results-dev";
const TOKEN_KEY = "lms-admin-token";

function readDevResults(): ResultsState {
  const raw = localStorage.getItem(DEV_STORAGE_KEY);
  if (!raw) return emptyResultsState();
  try {
    return JSON.parse(raw) as ResultsState;
  } catch {
    return emptyResultsState();
  }
}

/** Union remote + local; remote wins on key conflicts, local fills gaps. */
export function mergeResultsStates(primary: ResultsState, secondary: ResultsState): ResultsState {
  const merged = { ...(primary.results ?? {}) };
  for (const [key, value] of Object.entries(secondary.results ?? {})) {
    if (!(key in merged)) merged[key] = value;
  }
  const primaryTime = Date.parse(primary.updatedAt ?? "") || 0;
  const secondaryTime = Date.parse(secondary.updatedAt ?? "") || 0;
  return {
    version: 1,
    results: merged,
    updatedAt: new Date(Math.max(primaryTime, secondaryTime, Date.now())).toISOString(),
  };
}

function writeDevResults(state: ResultsState) {
  localStorage.setItem(DEV_STORAGE_KEY, JSON.stringify(state));
}

export function persistResultsLocally(state: ResultsState) {
  writeDevResults(state);
}

function applyResultUpdate(
  state: ResultsState,
  request: SaveMatchResultRequest,
): { state: ResultsState; error?: string } {
  const key = String(request.matchNumber);
  const liveMatch = getLiveMatches(state).find((m) => m.matchNumber === request.matchNumber);

  if (request.isDraw && liveMatch && liveMatch.round >= 4) {
    return {
      state,
      error: "Knockout matches cannot end in a draw — pick the team that advances.",
    };
  }

  const next: ResultsState = {
    ...state,
    results: { ...state.results },
    updatedAt: new Date().toISOString(),
  };

  if (request.clear) {
    delete next.results[key];
  } else if (request.isDraw) {
    next.results[key] = { isDraw: true };
  } else if (request.winnerId) {
    next.results[key] = { winnerId: request.winnerId };
  }

  return { state: next };
}

export function getAdminToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setAdminToken(token: string) {
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearAdminSession() {
  sessionStorage.removeItem(TOKEN_KEY);
}

export async function resultsApiAvailable(): Promise<boolean> {
  try {
    const res = await fetch(RESULTS_API, { cache: "no-store" });
    if (!res.ok) return false;
    const type = res.headers.get("content-type") ?? "";
    return type.includes("application/json");
  } catch {
    return false;
  }
}

export async function loadResults(): Promise<ResultsState> {
  const local = readDevResults();
  try {
    const res = await fetch(RESULTS_API, { cache: "no-store" });
    const type = res.headers.get("content-type") ?? "";
    if (res.ok && type.includes("application/json")) {
      const remote = (await res.json()) as ResultsState;
      const merged = mergeResultsStates(remote, local);
      writeDevResults(merged);
      return merged;
    }
  } catch {
    // local dev without Netlify
  }
  return local;
}

/** Push results that exist locally but not on the API (e.g. after astro-only dev). */
export async function syncLocalResultsToApi(): Promise<number> {
  const token = getAdminToken();
  if (!token) return 0;

  let remote = emptyResultsState();
  try {
    const res = await fetch(RESULTS_API, { cache: "no-store" });
    if (!res.ok) return 0;
    remote = (await res.json()) as ResultsState;
  } catch {
    return 0;
  }

  const local = readDevResults();
  const missing = Object.keys(local.results).filter((key) => !(key in remote.results));
  if (missing.length === 0) return 0;

  let synced = 0;
  let latest = remote;
  for (const key of missing.sort((a, b) => Number(a) - Number(b))) {
    const entry = local.results[key];
    const request: SaveMatchResultRequest = { matchNumber: Number(key) };
    if (entry.isDraw) request.isDraw = true;
    else if (entry.winnerId) request.winnerId = entry.winnerId;
    else continue;

    try {
      const res = await fetch(RESULTS_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(request),
      });
      if (res.ok) {
        const body = (await res.json()) as { ok: boolean; state?: ResultsState };
        if (body.ok && body.state) {
          latest = body.state;
          synced++;
        }
      }
    } catch {
      break;
    }
  }

  if (synced > 0) {
    writeDevResults(mergeResultsStates(latest, local));
  }
  return synced;
}

export async function adminLogin(
  username: string,
  password: string,
): Promise<{ ok: boolean; token?: string; error?: string }> {
  try {
    const res = await fetch(LOGIN_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const body = (await res.json()) as { ok: boolean; token?: string; error?: string };
    if (body.ok && body.token) {
      setAdminToken(body.token);
    }
    return body;
  } catch {
    if (username === "subzero" && password === "freeze") {
      const token = "dev-admin";
      setAdminToken(token);
      return { ok: true, token };
    }
    return { ok: false, error: "Invalid credentials." };
  }
}

export interface SaveMatchResultRequest {
  matchNumber: number;
  winnerId?: string;
  isDraw?: boolean;
  clear?: boolean;
}

const POOL_DEV_KEY = "lms-pool-dev";
const MY_SLOT_KEY = "lms-my-slot";
const SETTINGS_DEV_KEY = "lms-pool-settings-dev";

export async function resetAllData(): Promise<{ ok: boolean; error?: string }> {
  const token = getAdminToken();

  try {
    const res = await fetch("/api/admin/reset", {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const body = (await res.json()) as { ok: boolean; error?: string };
    if (body.ok) {
      localStorage.removeItem(DEV_STORAGE_KEY);
      localStorage.removeItem(POOL_DEV_KEY);
      localStorage.removeItem(MY_SLOT_KEY);
      localStorage.removeItem(SETTINGS_DEV_KEY);
      sessionStorage.removeItem("lms-pending-player");
    }
    return body;
  } catch {
    if (token !== "dev-admin") {
      return { ok: false, error: "Could not reset. Use pnpm dev:netlify for shared storage." };
    }
    localStorage.removeItem(DEV_STORAGE_KEY);
    localStorage.removeItem(POOL_DEV_KEY);
    localStorage.removeItem(MY_SLOT_KEY);
    localStorage.removeItem(SETTINGS_DEV_KEY);
    sessionStorage.removeItem("lms-pending-player");
    return { ok: true };
  }
}

export async function saveMatchResult(
  request: SaveMatchResultRequest,
): Promise<{ ok: boolean; state?: ResultsState; error?: string; localOnly?: boolean }> {
  const token = getAdminToken();

  try {
    const res = await fetch(RESULTS_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(request),
    });
    if (res.ok) {
      const body = (await res.json()) as { ok: boolean; state?: ResultsState; error?: string };
      if (body.ok && body.state) {
        const merged = mergeResultsStates(body.state, readDevResults());
        writeDevResults(merged);
        return { ...body, state: merged };
      }
      return body;
    }
  } catch {
    // API unavailable — fall back to localStorage below
  }

  const state = readDevResults();
  const { state: updated, error } = applyResultUpdate(state, request);
  if (error) return { ok: false, error };

  writeDevResults(updated);
  return { ok: true, state: updated, localOnly: true };
}
