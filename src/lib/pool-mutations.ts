import type { PoolState, SubmitPickRequest } from "../types/pool";

export function applyPickToState(state: PoolState, request: SubmitPickRequest): void {
  const existing = state.entries[request.playerId];
  const now = new Date().toISOString();
  const otherPicks = (existing?.picks ?? []).filter((p) => p.round !== request.round);
  const name =
    request.round === 1 && request.name?.trim()
      ? request.name.trim()
      : (existing?.name ?? request.name?.trim() ?? "");

  state.entries[request.playerId] = {
    playerId: request.playerId,
    name,
    picks: [...otherPicks, { round: request.round, teamId: request.teamId }],
    enteredAt: existing?.enteredAt ?? now,
    updatedAt: now,
  };
}

export function clearRoundPicksFromState(state: PoolState, round: number): number {
  let cleared = 0;
  const now = new Date().toISOString();
  for (const entry of Object.values(state.entries)) {
    const before = entry.picks.length;
    entry.picks = entry.picks.filter((p) => p.round !== round);
    if (entry.picks.length !== before) {
      entry.updatedAt = now;
      cleared += 1;
    }
  }
  return cleared;
}

export function addPlayerToState(state: PoolState, name: string, playerId?: string): string {
  const id = playerId ?? crypto.randomUUID();
  const now = new Date().toISOString();
  state.entries[id] = {
    playerId: id,
    name: name.trim(),
    picks: [],
    enteredAt: now,
    updatedAt: now,
  };
  return id;
}
