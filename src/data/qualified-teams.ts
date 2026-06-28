/**
 * Group-stage qualifiers for the 2026 World Cup Round of 32.
 * Order: 1st, 2nd, 3rd (3rd only if they advanced as a best third-place team).
 *
 * Third-place groups that qualified: B, D, E, F, I, J, K, L
 * (FIFA Annex C combination — groups A, C, G, H thirds did not advance).
 */
export const groupQualifiers: Record<string, string[]> = {
  A: ["mex", "rsa"],
  B: ["sui", "can", "bih"],
  C: ["bra", "mar"],
  D: ["usa", "aus", "par"],
  E: ["ger", "civ", "ecu"],
  F: ["ned", "jpn", "swe"],
  G: ["bel", "egy"],
  H: ["esp", "cpv"],
  I: ["fra", "nor", "sen"],
  J: ["arg", "aut", "alg"],
  K: ["col", "por", "cod"],
  L: ["eng", "hrv", "gha"],
};

/** Which group's 3rd-place team fills each R32 "Best 3rd" slot (match number → group). */
export const r32ThirdPlaceSlot: Record<number, string> = {
  74: "D", // Germany vs Paraguay
  77: "F", // France vs Sweden
  79: "E", // Mexico vs Ecuador
  80: "K", // England vs Congo DR
  81: "B", // USA vs Bosnia
  82: "I", // Belgium vs Senegal
  85: "J", // Switzerland vs Algeria
  87: "L", // Colombia vs Ghana
};

export function groupFinisher(group: string, position: 1 | 2 | 3): string | undefined {
  return groupQualifiers[group]?.[position - 1];
}
