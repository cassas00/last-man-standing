import { matches } from "./fixtures";
import { rounds } from "./rounds";
import { resolveGameState } from "../utils/engine";

export interface Team {
  id: string;
  name: string;
  short: string;
  color: string;
}

export interface Pick {
  round: number;
  teamId: string;
  won?: boolean;
}

export interface Player {
  id: string;
  name: string;
  picks: Pick[];
  eliminated?: boolean;
  eliminatedRound?: number;
}

export interface RoundMatch {
  round: number;
  matchNumber: number;
  homeTeamId?: string;
  awayTeamId?: string;
  homeLabel?: string;
  awayLabel?: string;
  winnerId?: string;
  isDraw?: boolean;
  kickoffAt?: string;
  label: string;
  stage: string;
}

export interface GameState {
  title: string;
  subtitle: string;
  currentRound: number;
  totalRounds: number;
  teams: Team[];
  players: Player[];
  matches: RoundMatch[];
}

export const teams: Team[] = [
  { id: "mex", name: "Mexico", short: "MEX", color: "#006847" },
  { id: "rsa", name: "South Africa", short: "RSA", color: "#FFB81C" },
  { id: "kor", name: "South Korea", short: "KOR", color: "#CD2E3A" },
  { id: "cze", name: "Czechia", short: "CZE", color: "#11457E" },
  { id: "can", name: "Canada", short: "CAN", color: "#FF0000" },
  { id: "sui", name: "Switzerland", short: "SUI", color: "#FF0000" },
  { id: "qat", name: "Qatar", short: "QAT", color: "#8A1538" },
  { id: "bih", name: "Bosnia & Herzegovina", short: "BIH", color: "#002395" },
  { id: "bra", name: "Brazil", short: "BRA", color: "#FFDF00" },
  { id: "mar", name: "Morocco", short: "MAR", color: "#C1272D" },
  { id: "hai", name: "Haiti", short: "HAI", color: "#00209F" },
  { id: "sco", name: "Scotland", short: "SCO", color: "#0065BD" },
  { id: "usa", name: "United States", short: "USA", color: "#3C3B6E" },
  { id: "par", name: "Paraguay", short: "PAR", color: "#D52B1E" },
  { id: "aus", name: "Australia", short: "AUS", color: "#FFCD00" },
  { id: "tur", name: "Türkiye", short: "TUR", color: "#E30A17" },
  { id: "ger", name: "Germany", short: "GER", color: "#FFFFFF" },
  { id: "cuw", name: "Curaçao", short: "CUW", color: "#002B7F" },
  { id: "civ", name: "Côte d'Ivoire", short: "CIV", color: "#F77F00" },
  { id: "ecu", name: "Ecuador", short: "ECU", color: "#FFDD00" },
  { id: "ned", name: "Netherlands", short: "NED", color: "#FF6600" },
  { id: "jpn", name: "Japan", short: "JPN", color: "#BC002D" },
  { id: "tun", name: "Tunisia", short: "TUN", color: "#E70013" },
  { id: "swe", name: "Sweden", short: "SWE", color: "#006AA7" },
  { id: "bel", name: "Belgium", short: "BEL", color: "#EF3340" },
  { id: "egy", name: "Egypt", short: "EGY", color: "#CE1126" },
  { id: "irn", name: "Iran", short: "IRN", color: "#239F40" },
  { id: "nzl", name: "New Zealand", short: "NZL", color: "#000000" },
  { id: "esp", name: "Spain", short: "ESP", color: "#AA151B" },
  { id: "cpv", name: "Cabo Verde", short: "CPV", color: "#003893" },
  { id: "ksa", name: "Saudi Arabia", short: "KSA", color: "#006C35" },
  { id: "uru", name: "Uruguay", short: "URU", color: "#55B5E5" },
  { id: "fra", name: "France", short: "FRA", color: "#002395" },
  { id: "sen", name: "Senegal", short: "SEN", color: "#00853F" },
  { id: "nor", name: "Norway", short: "NOR", color: "#BA0C2F" },
  { id: "irq", name: "Iraq", short: "IRQ", color: "#007A3D" },
  { id: "arg", name: "Argentina", short: "ARG", color: "#74ACDF" },
  { id: "alg", name: "Algeria", short: "ALG", color: "#006233" },
  { id: "aut", name: "Austria", short: "AUT", color: "#ED2939" },
  { id: "jor", name: "Jordan", short: "JOR", color: "#007A3D" },
  { id: "por", name: "Portugal", short: "POR", color: "#006600" },
  { id: "uzb", name: "Uzbekistan", short: "UZB", color: "#1EB53A" },
  { id: "col", name: "Colombia", short: "COL", color: "#FCD116" },
  { id: "cod", name: "Congo DR", short: "COD", color: "#007FFF" },
  { id: "eng", name: "England", short: "ENG", color: "#FFFFFF" },
  { id: "hrv", name: "Croatia", short: "CRO", color: "#FF0000" },
  { id: "gha", name: "Ghana", short: "GHA", color: "#CE1126" },
  { id: "pan", name: "Panama", short: "PAN", color: "#DA121A" },
];

/** Default empty roster before pool entries load. */
export const players: Player[] = [];

export { matches, rounds };

export function getResolvedGame(now = new Date()) {
  return resolveGameState(players, matches, rounds.length, now.getTime());
}

const resolved = getResolvedGame();

export const game: GameState = {
  title: "Last Man Standing",
  subtitle: "World Cup 2026 Kombat",
  currentRound: resolved.currentRound,
  totalRounds: rounds.length,
  teams,
  players: resolved.players,
  matches,
};

export function getTeam(id: string): Team | undefined {
  return teams.find((t) => t.id === id);
}

export function getMatchesForRound(round: number): RoundMatch[] {
  return matches.filter((m) => m.round === round);
}

export {
  getAlivePlayers,
  getEliminatedPlayers,
  getTeamsPlayingInRound,
} from "../utils/engine";

export {
  getRoundSchedule,
  getAllRoundSchedules,
  formatScheduleTime,
  isPastCutoff,
  verifyRoundSeparation,
  roundsOverlap,
} from "../utils/schedule";

export type { RoundSchedule, RoundGap } from "../utils/schedule";
export type { ResolvedGame, ResolvedPlayer, RoundPhase } from "../utils/engine";
