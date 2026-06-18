export interface RoundExtension {
  cutoffAt: string;
  updatedAt?: string;
}

export interface PoolSettings {
  version: 2;
  prizeAmount: string;
  roundExtensions?: Record<string, RoundExtension>;
  updatedAt?: string;
}

export function emptyPoolSettings(): PoolSettings {
  return { version: 2, prizeAmount: "", roundExtensions: {} };
}

export function migratePoolSettings(raw: unknown): PoolSettings {
  if (!raw || typeof raw !== "object") return emptyPoolSettings();
  const data = raw as Partial<PoolSettings> & { version?: number; prizeAmount?: string };
  return {
    version: 2,
    prizeAmount: typeof data.prizeAmount === "string" ? data.prizeAmount : "",
    roundExtensions:
      data.roundExtensions && typeof data.roundExtensions === "object"
        ? data.roundExtensions
        : {},
    updatedAt: data.updatedAt,
  };
}
