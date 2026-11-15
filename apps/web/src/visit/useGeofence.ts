import { useEffect, useRef } from "react";
import type { NearbyAgent } from "../types";

export const RETRIGGER_MS = 2 * 60 * 1000;

/**
 * Calls onEnter(agent) when the user moves from outside to inside an agent's radius_m,
 * never for the same agent twice within 2 minutes. Uses distance_m of the given list.
 */
export function useGeofence(agents: NearbyAgent[], enabled: boolean, onEnter: (a: NearbyAgent) => void) {
  const inside = useRef(new Set<string>());
  const last = useRef(new Map<string, number>());
  const cb = useRef(onEnter);
  cb.current = onEnter;

  useEffect(() => {
    if (!enabled) { inside.current.clear(); return; }
    const now = Date.now();
    const nowInside = agents.filter((a) => a.distance_m <= a.radius_m).sort((a, b) => a.distance_m - b.distance_m);
    const ids = new Set(nowInside.map((a) => a.id));
    for (const a of nowInside) {
      if (inside.current.has(a.id)) continue;
      const prev = last.current.get(a.id);
      if (prev !== undefined && now - prev < RETRIGGER_MS) continue;
      last.current.set(a.id, now);
      cb.current(a);
      break; // one guide at a time; closest first
    }
    inside.current = ids;
  }, [agents, enabled]);

  /** Mark an agent as just opened (manual tap) so it does not auto-open again within 2 min. */
  return { markOpened: (id: string) => last.current.set(id, Date.now()) };
}
