import type { Config, Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { getLiveMatches } from "../../src/lib/live-matches";
import type { ResultsState } from "../../src/types/results";
import { emptyResultsState } from "../../src/types/results";
import { getAuthHeader, verifyAdminToken } from "../lib/admin-auth";

const STORE_NAME = "lms-pool";
const RESULTS_KEY = "results";

interface UpdateBody {
  matchNumber: number;
  winnerId?: string;
  isDraw?: boolean;
  clear?: boolean;
}

async function readResults(store: ReturnType<typeof getStore>): Promise<ResultsState> {
  const raw = await store.get(RESULTS_KEY, { type: "json" });
  if (!raw || typeof raw !== "object") return emptyResultsState();
  const data = raw as ResultsState;
  return { version: 1, results: data.results ?? {}, updatedAt: data.updatedAt };
}

function validateUpdate(body: UpdateBody, results: ResultsState): string | null {
  if (!Number.isInteger(body.matchNumber) || body.matchNumber < 1) {
    return "Invalid match number.";
  }

  const liveMatches = getLiveMatches(results);
  const match = liveMatches.find((m) => m.matchNumber === body.matchNumber);
  if (!match) return "Match not found.";

  if (body.clear) return null;

  if (body.isDraw) {
    if (match.round >= 4) {
      return "Knockout matches cannot end in a draw — pick the team that advances.";
    }
    if (!match.homeTeamId || !match.awayTeamId) {
      return "Cannot mark a draw until both teams are known.";
    }
    return null;
  }

  if (!body.winnerId) return "Pick a winner, draw, or clear the result.";

  if (match.homeTeamId && match.awayTeamId) {
    if (body.winnerId !== match.homeTeamId && body.winnerId !== match.awayTeamId) {
      return "Winner must be one of the teams in this match.";
    }
    return null;
  }

  return null;
}

export default async (req: Request, _context: Context) => {
  const store = getStore(STORE_NAME);

  if (req.method === "GET") {
    const state = await readResults(store);
    return Response.json(state, {
      headers: { "Cache-Control": "no-store" },
    });
  }

  if (req.method === "POST") {
    if (!verifyAdminToken(getAuthHeader(req))) {
      return Response.json({ ok: false, error: "Unauthorized." }, { status: 401 });
    }

    let body: UpdateBody;
    try {
      body = await req.json();
    } catch {
      return Response.json({ ok: false, error: "Invalid request body." }, { status: 400 });
    }

    const state = await readResults(store);
    const error = validateUpdate(body, state);
    if (error) {
      return Response.json({ ok: false, error }, { status: 400 });
    }
    const key = String(body.matchNumber);

    if (body.clear) {
      delete state.results[key];
    } else if (body.isDraw) {
      state.results[key] = { isDraw: true };
    } else {
      state.results[key] = { winnerId: body.winnerId };
    }

    state.updatedAt = new Date().toISOString();
    await store.setJSON(RESULTS_KEY, state);
    return Response.json({ ok: true, state });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = {
  path: "/api/results",
};
