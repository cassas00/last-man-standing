import type { RoundMatch } from "../data/game";
import { PICK_CUTOFF_MS } from "../data/kickoffs";

export const SCHEDULE_TIMEZONE = "Europe/London";
/** Estimated full-time whistle after kick-off. */
export const MATCH_DURATION_MS = 2 * 60 * 60 * 1000;

export interface RoundSchedule {
  round: number;
  firstKickoffAt: string;
  lastKickoffAt: string;
  cutoffAt: string;
  closesAt: string;
  opensAt: string;
  firstMatchNumber: number;
  lastMatchNumber: number;
}

export interface RoundGap {
  fromRound: number;
  toRound: number;
  lastKickoffAt: string;
  nextFirstKickoffAt: string;
  gapHours: number;
  overlaps: boolean;
}

export function formatScheduleTime(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: SCHEDULE_TIMEZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(iso));
}

function roundMatchesWithKickoff(round: number, matches: RoundMatch[]): RoundMatch[] {
  return matches.filter((m) => m.round === round && m.kickoffAt);
}

export function getLastKickoff(round: number, matches: RoundMatch[]): RoundMatch | undefined {
  const roundMatches = roundMatchesWithKickoff(round, matches);
  if (roundMatches.length === 0) return undefined;
  return roundMatches.reduce((a, b) =>
    new Date(a.kickoffAt!).getTime() > new Date(b.kickoffAt!).getTime() ? a : b,
  );
}

/** Midnight UK (Europe/London) on the calendar day after the given kick-off. */
export function getNextDayMidnightLocal(afterKickoffIso: string): string {
  const kickoff = new Date(afterKickoffIso);
  const ukDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: SCHEDULE_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(kickoff);

  const [year, month, day] = ukDate.split("-").map(Number);
  const nextUtc = new Date(Date.UTC(year, month - 1, day + 1, 12, 0, 0));
  const nextUkDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: SCHEDULE_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(nextUtc);

  const [ny, nm, nd] = nextUkDate.split("-");
  const offset = londonOffsetFor(`${ny}-${nm}-${nd}T12:00:00Z`);
  return `${ny}-${nm}-${nd}T00:00:00${offset}`;
}

/** BST in Jun–Jul; GMT otherwise. */
function londonOffsetFor(utcIso: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: SCHEDULE_TIMEZONE,
    timeZoneName: "shortOffset",
  }).formatToParts(new Date(utcIso));
  const tz = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  if (tz === "GMT+1" || tz.includes("+1")) return "+01:00";
  return "+00:00";
}

export function getRoundOpensAt(round: number, matches: RoundMatch[]): string {
  if (round <= 1) return "1970-01-01T00:00:00.000Z";
  const prevLast = getLastKickoff(round - 1, matches);
  if (!prevLast?.kickoffAt) return "1970-01-01T00:00:00.000Z";
  return getNextDayMidnightLocal(prevLast.kickoffAt);
}

export function getRoundSchedule(round: number, matches: RoundMatch[]): RoundSchedule | undefined {
  const roundMatches = roundMatchesWithKickoff(round, matches);
  if (roundMatches.length === 0) return undefined;

  const earliest = roundMatches.reduce((a, b) =>
    new Date(a.kickoffAt!).getTime() < new Date(b.kickoffAt!).getTime() ? a : b,
  );
  const latest = roundMatches.reduce((a, b) =>
    new Date(a.kickoffAt!).getTime() > new Date(b.kickoffAt!).getTime() ? a : b,
  );

  const firstKickoffMs = new Date(earliest.kickoffAt!).getTime();
  const lastKickoffMs = new Date(latest.kickoffAt!).getTime();

  return {
    round,
    firstKickoffAt: earliest.kickoffAt!,
    lastKickoffAt: latest.kickoffAt!,
    cutoffAt: new Date(firstKickoffMs - PICK_CUTOFF_MS).toISOString(),
    closesAt: new Date(lastKickoffMs + MATCH_DURATION_MS).toISOString(),
    opensAt: getRoundOpensAt(round, matches),
    firstMatchNumber: earliest.matchNumber,
    lastMatchNumber: latest.matchNumber,
  };
}

export function isPastCutoff(cutoffAt: string, now = Date.now()): boolean {
  return now >= new Date(cutoffAt).getTime();
}

export function getAllRoundSchedules(matches: RoundMatch[]): RoundSchedule[] {
  const roundNumbers = [...new Set(matches.map((m) => m.round))].sort((a, b) => a - b);
  return roundNumbers
    .map((round) => getRoundSchedule(round, matches))
    .filter((s): s is RoundSchedule => s !== undefined);
}

export function verifyRoundSeparation(matches: RoundMatch[], totalRounds: number): RoundGap[] {
  const gaps: RoundGap[] = [];
  for (let round = 1; round < totalRounds; round++) {
    const current = getRoundSchedule(round, matches);
    const next = getRoundSchedule(round + 1, matches);
    if (!current || !next) continue;

    const gapMs =
      new Date(next.firstKickoffAt).getTime() - new Date(current.lastKickoffAt).getTime();

    gaps.push({
      fromRound: round,
      toRound: round + 1,
      lastKickoffAt: current.lastKickoffAt,
      nextFirstKickoffAt: next.firstKickoffAt,
      gapHours: Math.round((gapMs / (60 * 60 * 1000)) * 10) / 10,
      overlaps: gapMs <= 0,
    });
  }
  return gaps;
}

export function roundsOverlap(matches: RoundMatch[], totalRounds: number): boolean {
  return verifyRoundSeparation(matches, totalRounds).some((gap) => gap.overlaps);
}

export function allRoundResultsIn(round: number, matches: RoundMatch[]): boolean {
  const roundMatches = matches.filter((m) => m.round === round);
  if (roundMatches.length === 0) return false;
  return roundMatches.every((m) => m.winnerId !== undefined || m.isDraw === true);
}
