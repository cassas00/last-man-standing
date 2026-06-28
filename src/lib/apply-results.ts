import type { RoundMatch } from "../data/game";
import type { ResultsState } from "../types/results";
import { resolveBracket } from "../utils/bracket-resolve";

export function applyResults(matches: RoundMatch[], results: ResultsState): RoundMatch[] {
  let next = matches;

  if (results?.results && Object.keys(results.results).length > 0) {
    next = matches.map((match) => {
    const override = results.results[String(match.matchNumber)];
    if (!override) return match;

    if (override.isDraw) {
      return { ...match, isDraw: true, winnerId: undefined };
    }

    if (override.winnerId) {
      return { ...match, winnerId: override.winnerId, isDraw: false };
    }

    const { winnerId: _w, isDraw: _d, ...rest } = match;
    return rest;
    });
  }

  return resolveBracket(next);
}
