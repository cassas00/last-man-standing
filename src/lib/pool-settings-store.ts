import type { PoolSettings } from "../types/pool-settings";
import { emptyPoolSettings, migratePoolSettings } from "../types/pool-settings";
import { getAdminToken } from "./results-store";

const SETTINGS_API = "/api/pool-settings";
const DEV_STORAGE_KEY = "lms-pool-settings-dev";

function readDevSettings(): PoolSettings {
  const raw = localStorage.getItem(DEV_STORAGE_KEY);
  if (!raw) return emptyPoolSettings();
  try {
    return migratePoolSettings(JSON.parse(raw));
  } catch {
    return emptyPoolSettings();
  }
}

function writeDevSettings(settings: PoolSettings) {
  localStorage.setItem(DEV_STORAGE_KEY, JSON.stringify(settings));
}

export async function loadPoolSettings(): Promise<PoolSettings> {
  try {
    const res = await fetch(SETTINGS_API, { cache: "no-store" });
    if (res.ok) return migratePoolSettings(await res.json());
  } catch {
    // local dev without Netlify
  }
  return readDevSettings();
}

async function postSettings(
  body: Record<string, unknown>,
): Promise<{ ok: boolean; settings?: PoolSettings; error?: string }> {
  const token = getAdminToken();

  try {
    const res = await fetch(SETTINGS_API, {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    const result = (await res.json()) as {
      ok: boolean;
      settings?: PoolSettings;
      error?: string;
    };
    if (result.ok && result.settings) {
      writeDevSettings(migratePoolSettings(result.settings));
    }
    return result;
  } catch {
    if (token !== "dev-admin") {
      return { ok: false, error: "Could not save. Use pnpm dev:netlify for shared storage." };
    }

    const current = readDevSettings();
    const updated: PoolSettings = {
      ...current,
      updatedAt: new Date().toISOString(),
    };

    if (body.prizeAmount !== undefined) {
      updated.prizeAmount = String(body.prizeAmount).trim();
    }

    if (body.roundExtensions !== undefined) {
      const merged = { ...(current.roundExtensions ?? {}) };
      for (const [round, ext] of Object.entries(
        body.roundExtensions as Record<string, { cutoffAt: string } | null>,
      )) {
        if (ext === null) {
          delete merged[round];
        } else {
          merged[round] = { cutoffAt: ext.cutoffAt, updatedAt: new Date().toISOString() };
        }
      }
      updated.roundExtensions = merged;
    }

    writeDevSettings(migratePoolSettings(updated));
    return { ok: true, settings: migratePoolSettings(updated) };
  }
}

export async function savePrizeAmount(
  prizeAmount: string,
): Promise<{ ok: boolean; settings?: PoolSettings; error?: string }> {
  return postSettings({ prizeAmount });
}

export async function saveRoundExtension(
  round: number,
  cutoffAt: string,
): Promise<{ ok: boolean; settings?: PoolSettings; error?: string }> {
  return postSettings({
    roundExtensions: {
      [String(round)]: { cutoffAt },
    },
  });
}

export async function clearRoundExtension(
  round: number,
): Promise<{ ok: boolean; settings?: PoolSettings; error?: string }> {
  return postSettings({
    roundExtensions: {
      [String(round)]: null,
    },
  });
}

export function applyPrizeToDom(settings: PoolSettings) {
  const amount = settings.prizeAmount?.trim();
  document.querySelectorAll("[data-prize-banner]").forEach((el) => {
    const banner = el as HTMLElement;
    const amountEl = banner.querySelector("[data-prize-amount]");
    if (!amount) {
      banner.hidden = true;
      return;
    }
    if (amountEl) amountEl.textContent = amount;
    banner.hidden = false;
  });

  const winnerSub = document.querySelector("#lms-winner .final-warning__sub");
  if (winnerSub) {
    winnerSub.textContent = amount
      ? `Takes ${amount} — last fighter standing.`
      : "Last fighter standing.";
  }
}
