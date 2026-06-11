import type { Config, Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { emptyPoolState } from "../../src/types/pool";
import { emptyPoolSettings } from "../../src/types/pool-settings";
import { emptyResultsState } from "../../src/types/results";
import { getAuthHeader, verifyAdminToken } from "../lib/admin-auth";

const STORE_NAME = "lms-pool";
const STATE_KEY = "state";
const RESULTS_KEY = "results";
const SETTINGS_KEY = "settings";

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  if (!verifyAdminToken(getAuthHeader(req))) {
    return Response.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const store = getStore(STORE_NAME);
  await store.setJSON(STATE_KEY, emptyPoolState());
  await store.setJSON(RESULTS_KEY, emptyResultsState());
  await store.setJSON(SETTINGS_KEY, emptyPoolSettings());

  return Response.json({ ok: true });
};

export const config: Config = {
  path: "/api/admin/reset",
};
