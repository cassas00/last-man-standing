import type { PoolSettings } from "../types/pool-settings";
import type { ScheduleOptions } from "../utils/schedule";

export function scheduleOptionsFromSettings(settings: PoolSettings): ScheduleOptions {
  const cutoffOverrides: Record<number, string> = {};
  for (const [round, ext] of Object.entries(settings.roundExtensions ?? {})) {
    if (ext?.cutoffAt) cutoffOverrides[Number(round)] = ext.cutoffAt;
  }
  return Object.keys(cutoffOverrides).length ? { cutoffOverrides } : {};
}
