import type { RoundMatch } from "../data/game";
import { groupFinisher, r32ThirdPlaceSlot } from "../data/qualified-teams";

function resolveSlot(
  label: string,
  matchNumber: number,
  winners: Map<number, string | undefined>,
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

  return undefined;
}

/** Fill knockout fixture slots from confirmed group qualifiers and match results. */
export function resolveBracket(matches: RoundMatch[]): RoundMatch[] {
  const winners = new Map<number, string | undefined>();
  const resolvedByNumber = new Map<number, RoundMatch>();

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
      homeTeamId = resolveSlot(match.homeLabel, match.matchNumber, winners);
    }
    if (!awayTeamId && match.awayLabel) {
      awayTeamId = resolveSlot(match.awayLabel, match.matchNumber, winners);
    }

    const resolved = {
      ...match,
      ...(homeTeamId ? { homeTeamId } : {}),
      ...(awayTeamId ? { awayTeamId } : {}),
    };

    resolvedByNumber.set(match.matchNumber, resolved);
    if (resolved.winnerId) winners.set(resolved.matchNumber, resolved.winnerId);
  }

  return matches.map((m) => resolvedByNumber.get(m.matchNumber)!);
}
