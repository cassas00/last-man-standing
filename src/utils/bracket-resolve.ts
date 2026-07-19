import type { RoundMatch } from "../data/game";
import { groupFinisher, r32ThirdPlaceSlot } from "../data/qualified-teams";

function resolveSlot(
  label: string,
  matchNumber: number,
  winners: Map<number, string | undefined>,
  matchesByNumber: Map<number, RoundMatch>,
): string | undefined {
  const winnerMatch = label.match(/^Group ([A-L]) Winner$/);
  if (winnerMatch) return groupFinisher(winnerMatch[1], 1);

  const secondMatch = label.match(/^Group ([A-L]) 2nd$/);
  if (secondMatch) return groupFinisher(secondMatch[1], 2);

  if (label.startsWith("Best 3rd")) {
    const group = r32ThirdPlaceSlot[matchNumber];
    return group ? groupFinisher(group, 3) : undefined;
  }

  const matchWin = label.match(/^Match (\d+) Winner$/);
  if (matchWin) return winners.get(Number(matchWin[1]));

  const matchLose = label.match(/^Match (\d+) Loser$/);
  if (matchLose) {
    const src = Number(matchLose[1]);
    const winnerId = winners.get(src);
    const sourceMatch = matchesByNumber.get(src);
    if (!winnerId || !sourceMatch) return undefined;
    const { homeTeamId, awayTeamId } = sourceMatch;
    if (homeTeamId && awayTeamId) {
      return homeTeamId === winnerId ? awayTeamId : homeTeamId;
    }
  }

  return undefined;
}

/** Fill knockout fixture slots from confirmed group qualifiers and match results. */
export function resolveBracket(matches: RoundMatch[]): RoundMatch[] {
  const winners = new Map<number, string | undefined>();
  const resolvedByNumber = new Map<number, RoundMatch>();
  const matchesByNumber = new Map(matches.map((m) => [m.matchNumber, m]));

  for (const match of matches) {
    if (match.winnerId) winners.set(match.matchNumber, match.winnerId);
  }

  for (const match of [...matches].sort((a, b) => a.matchNumber - b.matchNumber)) {
    if (match.round < 4) {
      resolvedByNumber.set(match.matchNumber, match);
      continue;
    }

    let homeTeamId = match.homeTeamId;
    let awayTeamId = match.awayTeamId;

    if (!homeTeamId && match.homeLabel) {
      homeTeamId = resolveSlot(match.homeLabel, match.matchNumber, winners, matchesByNumber);
    }
    if (!awayTeamId && match.awayLabel) {
      awayTeamId = resolveSlot(match.awayLabel, match.matchNumber, winners, matchesByNumber);
    }

    const resolved = {
      ...match,
      ...(homeTeamId ? { homeTeamId } : {}),
      ...(awayTeamId ? { awayTeamId } : {}),
    };

    resolvedByNumber.set(match.matchNumber, resolved);
    matchesByNumber.set(match.matchNumber, resolved);
    if (resolved.winnerId) winners.set(resolved.matchNumber, resolved.winnerId);
  }

  return matches.map((m) => resolvedByNumber.get(m.matchNumber)!);
}
