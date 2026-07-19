import type { RoundMatch } from "./game";
import { kickoffIso } from "./kickoffs";

type GroupFixture = [matchNumber: number, home: string, away: string, group: string];

const md1: GroupFixture[] = [
  [1, "mex", "rsa", "A"],
  [2, "kor", "cze", "A"],
  [3, "can", "bih", "B"],
  [4, "usa", "par", "D"],
  [5, "hai", "sco", "C"],
  [6, "aus", "tur", "D"],
  [7, "bra", "mar", "C"],
  [8, "qat", "sui", "B"],
  [9, "civ", "ecu", "E"],
  [10, "ger", "cuw", "E"],
  [11, "ned", "jpn", "F"],
  [12, "swe", "tun", "F"],
  [13, "ksa", "uru", "H"],
  [14, "esp", "cpv", "H"],
  [15, "irn", "nzl", "G"],
  [16, "bel", "egy", "G"],
  [17, "fra", "sen", "I"],
  [18, "irq", "nor", "I"],
  [19, "arg", "alg", "J"],
  [20, "aut", "jor", "J"],
  [21, "gha", "pan", "L"],
  [22, "eng", "hrv", "L"],
  [23, "por", "cod", "K"],
  [24, "uzb", "col", "K"],
];

const md2: GroupFixture[] = [
  [25, "cze", "rsa", "A"],
  [26, "sui", "bih", "B"],
  [27, "can", "qat", "B"],
  [28, "mex", "kor", "A"],
  [29, "bra", "hai", "C"],
  [30, "sco", "mar", "C"],
  [31, "tur", "par", "D"],
  [32, "usa", "aus", "D"],
  [33, "ger", "civ", "E"],
  [34, "ecu", "cuw", "E"],
  [35, "ned", "swe", "F"],
  [36, "tun", "jpn", "F"],
  [37, "uru", "cpv", "H"],
  [38, "esp", "ksa", "H"],
  [39, "bel", "irn", "G"],
  [40, "nzl", "egy", "G"],
  [41, "nor", "sen", "I"],
  [42, "fra", "irq", "I"],
  [43, "arg", "aut", "J"],
  [44, "jor", "alg", "J"],
  [45, "eng", "gha", "L"],
  [46, "pan", "hrv", "L"],
  [47, "por", "uzb", "K"],
  [48, "col", "cod", "K"],
];

const md3: GroupFixture[] = [
  [49, "sco", "bra", "C"],
  [50, "mar", "hai", "C"],
  [51, "sui", "can", "B"],
  [52, "bih", "qat", "B"],
  [53, "cze", "mex", "A"],
  [54, "rsa", "kor", "A"],
  [55, "cuw", "civ", "E"],
  [56, "ecu", "ger", "E"],
  [57, "jpn", "swe", "F"],
  [58, "tun", "ned", "F"],
  [59, "tur", "usa", "D"],
  [60, "par", "aus", "D"],
  [61, "nor", "fra", "I"],
  [62, "sen", "irq", "I"],
  [63, "egy", "irn", "G"],
  [64, "nzl", "bel", "G"],
  [65, "cpv", "ksa", "H"],
  [66, "uru", "esp", "H"],
  [67, "pan", "eng", "L"],
  [68, "gha", "hrv", "L"],
  [69, "alg", "aut", "J"],
  [70, "jor", "arg", "J"],
  [71, "col", "por", "K"],
  [72, "cod", "uzb", "K"],
];

function withKickoff(match: Omit<RoundMatch, "kickoffAt">): RoundMatch {
  return { ...match, kickoffAt: kickoffIso(match.matchNumber) };
}

function groupMatches(round: number, fixtures: GroupFixture[]): RoundMatch[] {
  return fixtures.map(([matchNumber, homeTeamId, awayTeamId, group]) =>
    withKickoff({
      round,
      matchNumber,
      homeTeamId,
      awayTeamId,
      label: `Group ${group}`,
      stage: `Group ${group}`,
    }),
  );
}

type KnockoutFixture = [matchNumber: number, round: number, homeLabel: string, awayLabel: string, label: string];

const knockout: KnockoutFixture[] = [
  [73, 4, "Group A 2nd", "Group B 2nd", "R32"],
  [74, 4, "Group E Winner", "Best 3rd (A/B/C/D/F)", "R32"],
  [75, 4, "Group F Winner", "Group C 2nd", "R32"],
  [76, 4, "Group C Winner", "Group F 2nd", "R32"],
  [77, 4, "Group I Winner", "Best 3rd (C/D/F/G/H)", "R32"],
  [78, 4, "Group E 2nd", "Group I 2nd", "R32"],
  [79, 4, "Group A Winner", "Best 3rd (C/E/F/H/I)", "R32"],
  [80, 4, "Group L Winner", "Best 3rd (E/H/I/J/K)", "R32"],
  [81, 4, "Group D Winner", "Best 3rd (B/E/F/I/J)", "R32"],
  [82, 4, "Group G Winner", "Best 3rd (A/E/H/I/J)", "R32"],
  [83, 4, "Group K 2nd", "Group L 2nd", "R32"],
  [84, 4, "Group H Winner", "Group J 2nd", "R32"],
  [85, 4, "Group B Winner", "Best 3rd (E/F/G/I/J)", "R32"],
  [86, 4, "Group J Winner", "Group H 2nd", "R32"],
  [87, 4, "Group K Winner", "Best 3rd (D/E/I/J/L)", "R32"],
  [88, 4, "Group D 2nd", "Group G 2nd", "R32"],
  [89, 5, "Match 74 Winner", "Match 77 Winner", "R16"],
  [90, 5, "Match 73 Winner", "Match 75 Winner", "R16"],
  [91, 5, "Match 76 Winner", "Match 78 Winner", "R16"],
  [92, 5, "Match 79 Winner", "Match 80 Winner", "R16"],
  [93, 5, "Match 83 Winner", "Match 84 Winner", "R16"],
  [94, 5, "Match 81 Winner", "Match 82 Winner", "R16"],
  [95, 5, "Match 86 Winner", "Match 88 Winner", "R16"],
  [96, 5, "Match 85 Winner", "Match 87 Winner", "R16"],
  [97, 6, "Match 89 Winner", "Match 90 Winner", "QF"],
  [98, 6, "Match 93 Winner", "Match 94 Winner", "QF"],
  [99, 6, "Match 91 Winner", "Match 92 Winner", "QF"],
  [100, 6, "Match 95 Winner", "Match 96 Winner", "QF"],
  [101, 7, "Match 97 Winner", "Match 98 Winner", "SF"],
  [102, 7, "Match 99 Winner", "Match 100 Winner", "SF"],
  // The LMS continues through both the bronze match and the World Cup Final.
  [103, 8, "Match 101 Loser", "Match 102 Loser", "3rd Place"],
  [104, 9, "Match 101 Winner", "Match 102 Winner", "Final"],
];

function knockoutMatches(): RoundMatch[] {
  return knockout.map(([matchNumber, round, homeLabel, awayLabel, stage]) =>
    withKickoff({
      round,
      matchNumber,
      homeLabel,
      awayLabel,
      label: stage,
      stage,
    }),
  );
}

export const matches: RoundMatch[] = [
  ...groupMatches(1, md1),
  ...groupMatches(2, md2),
  ...groupMatches(3, md3),
  ...knockoutMatches(),
];
