import { matches, playerSlots, rounds, teams, game } from "../data/game";
import { getRoundSchedule } from "../utils/schedule";

const round1Schedule = getRoundSchedule(1, matches);

export const gameConfig = {
  title: game.title,
  subtitle: game.subtitle,
  slots: playerSlots,
  matches,
  teams,
  totalRounds: rounds.length,
  registrationCutoff: round1Schedule?.cutoffAt ?? null,
  round1Teams: matches
    .filter((m) => m.round === 1)
    .flatMap((m) => [m.homeTeamId, m.awayTeamId])
    .filter((id): id is string => !!id),
};

export type GameConfig = typeof gameConfig;
