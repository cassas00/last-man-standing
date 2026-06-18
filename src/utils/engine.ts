import type { Pick, Player, RoundMatch, Team } from "../data/game";
import {
  allRoundResultsIn,
  getRoundSchedule,
  roundsOverlap,
  verifyRoundSeparation,
  type RoundGap,
  type RoundSchedule,
  type ScheduleOptions,
} from "./schedule";

export type RoundPhase =
  | "upcoming"
  | "picks-open"
  | "locked"
  | "in-play"
  | "scoring"
  | "complete"
  | "tournament-over";

export interface ResolvedPick extends Pick {
  won: boolean | null;
}

export interface ResolvedPlayer extends Omit<Player, "picks"> {
  picks: ResolvedPick[];
}

export interface ResolvedGame {
  currentRound: number;
  evaluatedRound: number;
  phase: RoundPhase;
  phaseLabel: string;
  picksOpen: boolean;
  players: ResolvedPlayer[];
  aliveCount: number;
  eliminatedCount: number;
  schedule: RoundSchedule | undefined;
  totalRounds: number;
  roundGaps: RoundGap[];
  scheduleOk: boolean;
  winner: ResolvedPlayer | null;
}

function getMatchesForRound(round: number, matches: RoundMatch[]): RoundMatch[] {
  return matches.filter((m) => m.round === round);
}

export function getRoundPhase(
  round: number,
  matches: RoundMatch[],
  totalRounds: number,
  now = Date.now(),
  scheduleOptions: ScheduleOptions = {},
): RoundPhase {
  const schedule = getRoundSchedule(round, matches, scheduleOptions);
  if (!schedule) return "upcoming";

  const opensAt = new Date(schedule.opensAt).getTime();
  const cutoffAt = new Date(schedule.cutoffAt).getTime();
  const closesAt = new Date(schedule.closesAt).getTime();
  const nextOpensAt =
    round < totalRounds
      ? new Date(getRoundSchedule(round + 1, matches, scheduleOptions)!.opensAt).getTime()
      : Infinity;

  if (now < opensAt) return "upcoming";
  if (now < cutoffAt) return "picks-open";
  if (now < closesAt) return "in-play";
  if (round < totalRounds && now < nextOpensAt) return "scoring";
  if (round === totalRounds && allRoundResultsIn(round, matches)) return "tournament-over";
  if (allRoundResultsIn(round, matches)) return "complete";
  return "locked";
}

export function phaseLabel(phase: RoundPhase): string {
  switch (phase) {
    case "upcoming":
      return "Opens soon";
    case "picks-open":
      return "Picks open";
    case "locked":
      return "Picks locked";
    case "in-play":
      return "Matches in play";
    case "scoring":
      return "Calculating results";
    case "complete":
      return "Round complete";
    case "tournament-over":
      return "Tournament over";
  }
}

export function getActiveRound(
  matches: RoundMatch[],
  totalRounds: number,
  now = Date.now(),
  scheduleOptions: ScheduleOptions = {},
): number {
  for (let round = totalRounds; round >= 1; round--) {
    const schedule = getRoundSchedule(round, matches, scheduleOptions);
    if (schedule && now >= new Date(schedule.opensAt).getTime()) return round;
  }
  return 1;
}

export function getEvaluatedRound(
  matches: RoundMatch[],
  totalRounds: number,
  now = Date.now(),
  scheduleOptions: ScheduleOptions = {},
): number {
  let evaluated = 0;

  for (let round = 1; round <= totalRounds; round++) {
    if (!allRoundResultsIn(round, matches)) break;

    if (round < totalRounds) {
      const nextOpensAt = new Date(
        getRoundSchedule(round + 1, matches, scheduleOptions)!.opensAt,
      ).getTime();
      if (now < nextOpensAt) break;
    }

    evaluated = round;
  }

  return evaluated;
}

export function computePickOutcome(
  pick: Pick,
  round: number,
  matches: RoundMatch[],
): boolean | null {
  const teamMatches = getMatchesForRound(round, matches).filter(
    (m) => m.homeTeamId === pick.teamId || m.awayTeamId === pick.teamId,
  );

  if (teamMatches.length === 0) return null;

  const match = teamMatches[0];
  if (match.isDraw) return false;
  if (!match.winnerId) return null;
  return match.winnerId === pick.teamId;
}

export function derivePlayers(
  players: Player[],
  matches: RoundMatch[],
  evaluatedRound: number,
  now = Date.now(),
  scheduleOptions: ScheduleOptions = {},
): ResolvedPlayer[] {
  return players.map((player) => {
    let eliminated = false;
    let eliminatedRound: number | undefined;
    const picks: ResolvedPick[] = player.picks.map((pick) => ({
      ...pick,
      won: computePickOutcome(pick, pick.round, matches),
    }));

    for (let round = 1; round <= evaluatedRound; round++) {
      if (eliminated) break;

      const schedule = getRoundSchedule(round, matches, scheduleOptions);
      const cutoffPassed = schedule ? now >= new Date(schedule.cutoffAt).getTime() : false;
      const pick = picks.find((p) => p.round === round);

      if (!pick) {
        if (cutoffPassed) {
          eliminated = true;
          eliminatedRound = round;
        }
        continue;
      }

      const outcome = pick.won;
      if (outcome === null) continue;
      if (!outcome) {
        eliminated = true;
        eliminatedRound = round;
      }
    }

    return {
      ...player,
      picks,
      eliminated,
      eliminatedRound,
    };
  });
}

export function resolveGameState(
  players: Player[],
  matches: RoundMatch[],
  totalRounds: number,
  now = Date.now(),
  scheduleOptions: ScheduleOptions = {},
): ResolvedGame {
  const currentRound = getActiveRound(matches, totalRounds, now, scheduleOptions);
  const evaluatedRound = getEvaluatedRound(matches, totalRounds, now, scheduleOptions);
  const phase = getRoundPhase(currentRound, matches, totalRounds, now, scheduleOptions);
  const schedule = getRoundSchedule(currentRound, matches, scheduleOptions);
  const resolvedPlayers = derivePlayers(
    players,
    matches,
    evaluatedRound,
    now,
    scheduleOptions,
  );
  const alive = resolvedPlayers.filter((p) => !p.eliminated);
  const roundGaps = verifyRoundSeparation(matches, totalRounds, scheduleOptions);

  let winner: ResolvedPlayer | null = null;
  if (phase === "tournament-over" && alive.length === 1) {
    winner = alive[0];
  }

  return {
    currentRound,
    evaluatedRound,
    phase,
    phaseLabel: phaseLabel(phase),
    picksOpen: phase === "picks-open",
    players: resolvedPlayers,
    aliveCount: alive.length,
    eliminatedCount: resolvedPlayers.length - alive.length,
    schedule,
    totalRounds,
    roundGaps,
    scheduleOk: !roundsOverlap(matches, totalRounds, scheduleOptions),
    winner,
  };
}

export function getAlivePlayers(resolved: ResolvedGame): ResolvedPlayer[] {
  return resolved.players.filter((p) => !p.eliminated);
}

export function getEliminatedPlayers(resolved: ResolvedGame): ResolvedPlayer[] {
  return resolved.players.filter((p) => p.eliminated);
}

export function getTeam(teams: Team[], id: string): Team | undefined {
  return teams.find((t) => t.id === id);
}

export function getTeamsPlayingInRound(
  round: number,
  matches: RoundMatch[],
  teams: Team[],
): Team[] {
  const ids = new Set<string>();
  for (const match of getMatchesForRound(round, matches)) {
    if (match.homeTeamId) ids.add(match.homeTeamId);
    if (match.awayTeamId) ids.add(match.awayTeamId);
  }
  return teams
    .filter((team) => ids.has(team.id))
    .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
}
