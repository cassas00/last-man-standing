import type { ResultsState } from "../types/results";
import { emptyResultsState } from "../types/results";

const RESULTS_API = "/api/results";
const LOGIN_API = "/api/admin/login";
const DEV_STORAGE_KEY = "lms-results-dev";
const TOKEN_KEY = "lms-admin-token";

async function readDevResults(): Promise<ResultsState> {
  const raw = localStorage.getItem(DEV_STORAGE_KEY);
  if (!raw) return emptyResultsState();
  try {
    return JSON.parse(raw) as ResultsState;
  } catch {
    return emptyResultsState();
  }
}

function writeDevResults(state: ResultsState) {
  localStorage.setItem(DEV_STORAGE_KEY, JSON.stringify(state));
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

export async function loadResults(): Promise<ResultsState> {
  try {
    const res = await fetch(RESULTS_API, { cache: "no-store" });
    if (res.ok) return (await res.json()) as ResultsState;
  } catch {
    // local dev without Netlify
  }
  return readDevResults();
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
): Promise<{ ok: boolean; state?: ResultsState; error?: string }> {
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
    const body = (await res.json()) as { ok: boolean; state?: ResultsState; error?: string };
    if (body.ok && body.state) {
      writeDevResults(body.state);
    }
    return body;
  } catch {
    if (token !== "dev-admin") {
      return { ok: false, error: "Could not save. Use pnpm dev:netlify for shared storage." };
    }

    const state = await readDevResults();
    const key = String(request.matchNumber);

    if (request.clear) {
      delete state.results[key];
    } else if (request.isDraw) {
      state.results[key] = { isDraw: true };
    } else if (request.winnerId) {
      state.results[key] = { winnerId: request.winnerId };
    }

    state.updatedAt = new Date().toISOString();
    writeDevResults(state);
    return { ok: true, state };
  }
}
