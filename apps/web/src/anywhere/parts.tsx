import type { AgentStatus, AgentSummary } from "./types";
import { unitsToUsd } from "./money";

export function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
}

export function Face({ a, size = 48 }: { a: Pick<AgentSummary, "name" | "color">; size?: number }) {
  return (
    <span className="face-ini" style={{ width: size, height: size, background: a.color || "#1f8a4c", fontSize: size * 0.38 }} aria-hidden="true">
      {initials(a.name)}
    </span>
  );
}

/** Honest provenance label: seeded sample agents vs user-made demo agents. */
export function SourceBadge({ a }: { a: Pick<AgentSummary, "sample" | "is_mine"> }) {
  return <span className="badge">{a.sample ? "Sample creator · demo" : a.is_mine ? "Demo creator · yours" : "Demo creator"}</span>;
}

export function ScoreBadge({ status, score }: { status: AgentStatus; score: number | null }) {
  if (status === "in_review") return <span className="badge active">In review by Reppo</span>;
  if (status === "rejected") return <span className="badge rej">Not listed · review failed</span>;
  if (score != null) return <span className="badge ok">Reppo score {score}</span>;
  return <span className="badge">Not yet reviewed</span>;
}

export const PriceBadge = ({ units }: { units: string }) => <span className="badge paid">{unitsToUsd(units)} premium</span>;

export const isVirtual = (a: Pick<AgentSummary, "distance_m" | "radius_m">) => a.distance_m == null || a.distance_m > a.radius_m;

export function VirtualBadge({ a }: { a: Pick<AgentSummary, "distance_m" | "radius_m"> }) {
  return isVirtual(a) ? <span className="badge sim-dark">Virtual visit</span> : <span className="badge live">You are here</span>;
}
