export interface PoolSettings {
  version: 1;
  prizeAmount: string;
  updatedAt?: string;
}

export function emptyPoolSettings(): PoolSettings {
  return { version: 1, prizeAmount: "" };
}
