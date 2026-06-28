import type { RoundMatch, Team } from "../data/game";
import { matches, teams } from "../data/game";
import { rounds } from "../data/rounds";
import type { PoolState } from "../types/pool";
import { getTeamsPlayingInRound } from "../utils/engine";
import {
  getRoundSchedule,
  getTeamsBlockedBeforeCutoff,
  type ScheduleOptions,
} from "../utils/schedule";
import { getTeamsUsedByPlayer } from "./pool-validation";

export interface AdminAddPlayerRequest {
  name: string;
  round?: number;
  teamId?: string;
}

export interface AdminSetPickRequest {
  playerId: string;
  round: number;
  teamId: string;
}

function validateName(name: string | undefined): string | null {
  const trimmed = name?.trim();
  if (!trimmed || trimmed.length < 2) return "Enter a name (at least 2 characters).";
  if (trimmed.length > 40) return "Name is too long.";
  return null;
}

function validateTeamPick(
  state: PoolState,
  playerId: string,
  round: number,
  teamId: string,
  allMatches: RoundMatch[] = matches,
  allTeams: Team[] = teams,
  scheduleOptions: ScheduleOptions = {},
): string | null {
  if (!Number.isInteger(round) || round < 1 || round > rounds.length) {
    return "Invalid round.";
  }

  const playingIds = new Set(
    getTeamsPlayingInRound(round, allMatches, allTeams).map((t) => t.id),
  );
  if (!playingIds.has(teamId)) {
    return `Pick a team playing in Round ${round}.`;
  }

  const schedule = getRoundSchedule(round, allMatches, scheduleOptions);
  if (schedule) {
    const blocked = getTeamsBlockedBeforeCutoff(round, allMatches, schedule.cutoffAt);
    const currentRoundPick = state.entries[playerId]?.picks.find((p) => p.round === round);
    if (blocked.has(teamId) && currentRoundPick?.teamId !== teamId) {
      return "That team's match kicks off before the pick deadline.";
    }
  }

  const usedByPlayer = getTeamsUsedByPlayer(state, playerId);
  const currentRoundPick = state.entries[playerId]?.picks.find((p) => p.round === round);

  if (usedByPlayer.has(teamId) && currentRoundPick?.teamId !== teamId) {
    return "That player has already used this team in a previous round.";
  }

  return null;
}

export function validateAdminAddPlayer(
  state: PoolState,
  body: AdminAddPlayerRequest,
  scheduleOptions: ScheduleOptions = {},
  liveMatches: RoundMatch[] = matches,
): string | null {
  const nameError = validateName(body.name);
  if (nameError) return nameError;

  if (!body.teamId && body.round === undefined) return null;

  if (!body.teamId || body.round === undefined) {
    return "Provide both round and team to assign a pick, or leave both empty to add the player only.";
  }

  return validateTeamPick(state, "__new__", body.round, body.teamId, liveMatches, teams, scheduleOptions);
}

export function validateAdminSetPick(
  state: PoolState,
  body: AdminSetPickRequest,
  scheduleOptions: ScheduleOptions = {},
  liveMatches: RoundMatch[] = matches,
): string | null {
  if (!body.playerId || typeof body.playerId !== "string") {
    return "Invalid player.";
  }

  if (!state.entries[body.playerId]) {
    return "Player not found.";
  }

  return validateTeamPick(
    state,
    body.playerId,
    body.round,
    body.teamId,
    liveMatches,
    teams,
    scheduleOptions,
  );
}
