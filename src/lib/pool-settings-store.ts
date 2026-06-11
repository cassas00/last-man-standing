import type { PoolSettings } from "../types/pool-settings";
import { emptyPoolSettings } from "../types/pool-settings";
import { getAdminToken } from "./results-store";

const SETTINGS_API = "/api/pool-settings";
const DEV_STORAGE_KEY = "lms-pool-settings-dev";

function readDevSettings(): PoolSettings {
  const raw = localStorage.getItem(DEV_STORAGE_KEY);
  if (!raw) return emptyPoolSettings();
  try {
    return JSON.parse(raw) as PoolSettings;
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
    if (res.ok) return (await res.json()) as PoolSettings;
  } catch {
    // local dev without Netlify
  }
  return readDevSettings();
}

export async function savePrizeAmount(
  prizeAmount: string,
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
      body: JSON.stringify({ prizeAmount }),
    });
    const body = (await res.json()) as {
      ok: boolean;
      settings?: PoolSettings;
      error?: string;
    };
    if (body.ok && body.settings) {
      writeDevSettings(body.settings);
    }
    return body;
  } catch {
    if (token !== "dev-admin") {
      return { ok: false, error: "Could not save. Use pnpm dev:netlify for shared storage." };
    }

    const settings: PoolSettings = {
      version: 1,
      prizeAmount: prizeAmount.trim(),
      updatedAt: new Date().toISOString(),
    };
    writeDevSettings(settings);
    return { ok: true, settings };
  }
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
