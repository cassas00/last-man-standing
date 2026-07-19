import type { Player, RoundMatch, Team } from "../data/game";
import { matches, teams } from "../data/game";
import { rounds } from "../data/rounds";
import type { PoolState, SubmitPickRequest } from "../types/pool";
import { resolveGameState, getTeamsPlayingInRound, getRoundPhase } from "../utils/engine";
import {
  getRoundSchedule,
  getTeamsBlockedBeforeCutoff,
  type ScheduleOptions,
} from "../utils/schedule";

function poolToPlayers(state: PoolState): Player[] {
  return Object.values(state.entries).map((entry) => ({
    id: entry.playerId,
    name: entry.name,
    picks: entry.picks.map((p) => ({ round: p.round, teamId: p.teamId })),
  }));
}

export function getTeamsTakenInRound(
  state: PoolState,
  round: number,
  excludePlayerId?: string,
): Set<string> {
  const taken = new Set<string>();
  for (const entry of Object.values(state.entries)) {
    if (excludePlayerId && entry.playerId === excludePlayerId) continue;
    const pick = entry.picks.find((p) => p.round === round);
    if (pick) taken.add(pick.teamId);
  }
  return taken;
}

export function getTeamsUsedByPlayer(state: PoolState, playerId: string): Set<string> {
  const entry = state.entries[playerId];
  if (!entry) return new Set();
  return new Set(entry.picks.map((p) => p.teamId));
}

export function getPlayerPickForRound(
  state: PoolState,
  playerId: string,
  round: number,
): string | undefined {
  return state.entries[playerId]?.picks.find((p) => p.round === round)?.teamId;
}

export function isPickWindowOpen(
  round: number,
  now = Date.now(),
  scheduleOptions: ScheduleOptions = {},
): boolean {
  return getRoundPhase(round, matches, rounds.length, now, scheduleOptions) === "picks-open";
}

/** New players may only join during the Round 1 pick window. */
export function isRegistrationOpen(
  now = Date.now(),
  scheduleOptions: ScheduleOptions = {},
): boolean {
  return isPickWindowOpen(1, now, scheduleOptions);
}

export function getAliveRegisteredPlayers(
  state: PoolState,
  now = Date.now(),
  scheduleOptions: ScheduleOptions = {},
  liveMatches: RoundMatch[] = matches,
): Player[] {
  const players = poolToPlayers(state);
  const resolved = resolveGameState(players, liveMatches, rounds.length, now, scheduleOptions);
  return resolved.players.filter((p) => !p.eliminated && p.name !== "—");
}

/** 3rd-place rollover resets the field — team reuse does not apply. */
export function isRolloverRound(round: number): boolean {
  return round === 8;
}

/** The World Cup Final allows either finalist even if the player used them earlier. */
export function isFinalRound(round: number): boolean {
  return round === rounds.length;
}

export function getAvailableTeamsForPlayer(
  state: PoolState,
  playerId: string,
  round: number,
  allMatches: RoundMatch[] = matches,
  allTeams: Team[] = teams,
  scheduleOptions: ScheduleOptions = {},
): Team[] {
  const playing = getTeamsPlayingInRound(round, allMatches, allTeams);
  const usedByPlayer = getTeamsUsedByPlayer(state, playerId);
  const currentRoundPick = state.entries[playerId]?.picks.find((p) => p.round === round);
  const waiveReuse = isRolloverRound(round) || isFinalRound(round);

  const schedule = getRoundSchedule(round, allMatches, scheduleOptions);
  const blocked = schedule
    ? getTeamsBlockedBeforeCutoff(round, allMatches, schedule.cutoffAt)
    : new Set<string>();

  return playing
    .filter((team) => {
      if (blocked.has(team.id) && currentRoundPick?.teamId !== team.id) return false;
      if (waiveReuse) return true;
      return !usedByPlayer.has(team.id) || currentRoundPick?.teamId === team.id;
    })
    .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
}

export function validatePick(
  state: PoolState,
  body: SubmitPickRequest,
  now = Date.now(),
  scheduleOptions: ScheduleOptions = {},
  liveMatches: RoundMatch[] = matches,
): string | null {
  const round = body.round;
  if (!Number.isInteger(round) || round < 1 || round > rounds.length) {
    return "Invalid round.";
  }

  if (!body.playerId || typeof body.playerId !== "string") {
    return "Invalid player.";
  }

  if (!isPickWindowOpen(round, now, scheduleOptions)) {
    const schedule = getRoundSchedule(round, liveMatches, scheduleOptions);
    return schedule
      ? `Picks for Round ${round} are closed.`
      : "Picks are not open.";
  }

  const playingIds = new Set(
    getTeamsPlayingInRound(round, liveMatches, teams).map((t) => t.id),
  );
  if (!playingIds.has(body.teamId)) {
    return `Pick a team playing in Round ${round}.`;
  }

  const schedule = getRoundSchedule(round, liveMatches, scheduleOptions);
  if (schedule) {
    const blocked = getTeamsBlockedBeforeCutoff(round, liveMatches, schedule.cutoffAt);
    const currentRoundPick = state.entries[body.playerId]?.picks.find((p) => p.round === round);
    if (blocked.has(body.teamId) && currentRoundPick?.teamId !== body.teamId) {
      return "That team's match kicks off before the pick deadline.";
    }
  }

  const usedByPlayer = getTeamsUsedByPlayer(state, body.playerId);
  const currentRoundPick = state.entries[body.playerId]?.picks.find((p) => p.round === round);

  if (
    !isRolloverRound(round) &&
    !isFinalRound(round) &&
    usedByPlayer.has(body.teamId) &&
    currentRoundPick?.teamId !== body.teamId
  ) {
    return "You cannot pick the same team twice.";
  }

  const existing = state.entries[body.playerId];

  if (round === 1) {
    if (!existing && !isRegistrationOpen(now, scheduleOptions)) {
      return "Registration is closed. The Round 1 deadline has passed.";
    }

    const name = body.name?.trim();
    if (!name || name.length < 2) return "Enter your name (at least 2 characters).";
    if (name.length > 40) return "Name is too long.";
    return null;
  }

  if (!existing) {
    return "You must register in Round 1 before picking in later rounds.";
  }

  // 3rd-place rollover: every registered player can pick again.
  if (isRolloverRound(round)) {
    return null;
  }

  const alive = getAliveRegisteredPlayers(state, now, scheduleOptions, liveMatches);
  if (!alive.some((p) => p.id === body.playerId)) {
    return "Only surviving players can submit picks.";
  }

  return null;
}
