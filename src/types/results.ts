export interface MatchResult {
  winnerId?: string;
  isDraw?: boolean;
}

export interface ResultsState {
  version: 1;
  results: Record<string, MatchResult>;
  updatedAt?: string;
}

export function emptyResultsState(): ResultsState {
  return { version: 1, results: {} };
}
