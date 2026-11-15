// pieUSD has 18 decimals. Display only: all arithmetic stays in bigint.
const UNIT = 10n ** 18n;

export function unitsToUsd(units: string, dp = 2): string {
  const u = BigInt(units || "0");
  const scale = 10n ** BigInt(dp);
  const n = (u * scale + UNIT / 2n) / UNIT; // rounded
  return `$${n / scale}.${(n % scale).toString().padStart(dp, "0")}`;
}

/** USD (two decimals, e.g. 0.05) to base units, via integer cents. */
export function usdToUnits(usd: number): string {
  return (BigInt(Math.round(usd * 100)) * (UNIT / 100n)).toString();
}

/** 0..100 share of part in total (for meters). */
export function pct(part: string, total: string): number {
  const t = BigInt(total || "0");
  if (t === 0n) return 0;
  return Math.max(0, Math.min(100, Number((BigInt(part || "0") * 10000n) / t) / 100));
}
