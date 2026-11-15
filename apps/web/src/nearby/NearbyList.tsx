import type { ReactNode } from "react";
import type { NearbyAgent, Yocto } from "../types";

const YOCTO_PER_NEAR = 10n ** 24n;

/** Format a yocto integer string as NEAR using BigInt only (no floats). */
export function formatNear(y: Yocto): string {
  const v = BigInt(y);
  const whole = v / YOCTO_PER_NEAR;
  const frac = (v % YOCTO_PER_NEAR).toString().padStart(24, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : `${whole}`;
}

export function formatDistance(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`;
}

interface Props {
  agents: NearbyAgent[];
  onSelect?: (agent: NearbyAgent) => void;
  /** Slot for near-pay (builder-near): called when a paid agent is chosen. */
  onPaymentRequired?: (agent: NearbyAgent) => void;
  /** Slot for chat-voice: rendered under the list. */
  chatSlot?: ReactNode;
}

export default function NearbyList({ agents, onSelect, onPaymentRequired, chatSlot }: Props) {
  const sorted = [...agents].sort((a, b) => a.distance_m - b.distance_m);
  return (
    <section>
      <ul className="list">
        {sorted.map((a) => (
          <li key={a.id}>
            <button
              className="row"
              onClick={() => {
                onSelect?.(a);
                if (a.price_yocto !== null) onPaymentRequired?.(a);
              }}
            >
              <span className="emoji" style={{ background: a.color ?? "#8a6a3b" }}>{a.emoji ?? "🤖"}</span>
              <span className="meta">
                <strong>{a.name}</strong>
                <small>{formatDistance(a.distance_m)}</small>
              </span>
              {a.price_yocto !== null
                ? <span className="badge paid">Paid · {formatNear(a.price_yocto)} NEAR</span>
                : <span className="badge free">Free</span>}
            </button>
          </li>
        ))}
      </ul>
      {chatSlot}
    </section>
  );
}
