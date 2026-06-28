import { matches } from "../data/fixtures";
import { applyResults } from "./apply-results";
import type { ResultsState } from "../types/results";
import { emptyResultsState } from "../types/results";

export function getLiveMatches(results: ResultsState | null | undefined = emptyResultsState()) {
  return applyResults(matches, results ?? emptyResultsState());
}
