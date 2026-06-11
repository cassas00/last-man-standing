export interface PoolPick {
  round: number;
  teamId: string;
}

export interface PoolEntry {
  playerId: string;
  name: string;
  picks: PoolPick[];
  enteredAt: string;
  updatedAt: string;
}

export interface PoolState {
  version: 2;
  entries: Record<string, PoolEntry>;
}

/** @deprecated v1 shape — migrated on load */
export interface PoolStateV1 {
  version?: 1;
  entries: Record<string, {
    playerId: string;
    name: string;
    teamId: string;
    enteredAt: string;
    updatedAt: string;
  }>;
}

export interface SubmitPickRequest {
  playerId: string;
  round: number;
  teamId: string;
  name?: string;
}

export interface SubmitPickResponse {
  ok: boolean;
  error?: string;
  state?: PoolState;
}

export function emptyPoolState(): PoolState {
  return { version: 2, entries: {} };
}

export function migratePoolState(raw: unknown): PoolState {
  if (!raw || typeof raw !== "object") return emptyPoolState();

  const data = raw as PoolState | PoolStateV1;

  if (data.version === 2 && "entries" in data) {
    return data as PoolState;
  }

  const entries: PoolState["entries"] = {};
  const legacy = data as PoolStateV1;

  for (const [id, entry] of Object.entries(legacy.entries ?? {})) {
    if ("picks" in entry && Array.isArray((entry as PoolEntry).picks)) {
      entries[id] = entry as PoolEntry;
      continue;
    }
    if ("teamId" in entry) {
      entries[id] = {
        playerId: entry.playerId,
        name: entry.name,
        picks: [{ round: 1, teamId: entry.teamId }],
        enteredAt: entry.enteredAt,
        updatedAt: entry.updatedAt,
      };
    }
  }

  return { version: 2, entries };
}
