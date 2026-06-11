export interface RoundInfo {
  round: number;
  name: string;
  dates: string;
  matchCount: number;
}

export const rounds: RoundInfo[] = [
  { round: 1, name: "Group Stage — Matchday 1", dates: "Jun 11–17", matchCount: 24 },
  { round: 2, name: "Group Stage — Matchday 2", dates: "Jun 18–23", matchCount: 24 },
  { round: 3, name: "Group Stage — Matchday 3", dates: "Jun 24–27", matchCount: 24 },
  { round: 4, name: "Round of 32", dates: "Jun 28 – Jul 3", matchCount: 16 },
  { round: 5, name: "Round of 16", dates: "Jul 4–7", matchCount: 8 },
  { round: 6, name: "Quarter-Finals", dates: "Jul 9–11", matchCount: 4 },
  { round: 7, name: "Semi-Finals", dates: "Jul 14–15", matchCount: 2 },
  { round: 8, name: "Final", dates: "Jul 19", matchCount: 1 },
];

export function getRoundInfo(round: number): RoundInfo | undefined {
  return rounds.find((r) => r.round === round);
}
