import { useCallback, useEffect, useRef, useState } from "react";
import { ROUTE } from "./route";

const AUTO_STOP_MS = 20000;
const GLIDE_MS = 2500;

/** Simulated GPS: glides along ROUTE coordinates. Nothing here touches the real device position. */
export function useVirtualWalk(enabled: boolean) {
  const [stop, setStop] = useState(0);
  const [pos, setPos] = useState({ lat: ROUTE[0].lat, lng: ROUTE[0].lng });
  const [auto, setAuto] = useState(false);
  const posRef = useRef(pos);
  posRef.current = pos;

  // glide to the stop's coordinates so the position "moves" rather than jumps
  useEffect(() => {
    if (!enabled) return;
    const from = posRef.current;
    const to = ROUTE[stop];
    const t0 = performance.now();
    const id = window.setInterval(() => {
      const k = Math.min(1, (performance.now() - t0) / GLIDE_MS);
      setPos({ lat: from.lat + (to.lat - from.lat) * k, lng: from.lng + (to.lng - from.lng) * k });
      if (k >= 1) window.clearInterval(id);
    }, 200);
    return () => window.clearInterval(id);
  }, [stop, enabled]);

  // auto-walk: ~20 s per stop, stops at the end of the route
  useEffect(() => {
    if (!enabled || !auto) return;
    if (stop >= ROUTE.length - 1) { setAuto(false); return; }
    const id = window.setTimeout(() => setStop((s) => Math.min(ROUTE.length - 1, s + 1)), AUTO_STOP_MS);
    return () => window.clearTimeout(id);
  }, [enabled, auto, stop]);

  const next = useCallback(() => setStop((s) => Math.min(ROUTE.length - 1, s + 1)), []);
  const prev = useCallback(() => setStop((s) => Math.max(0, s - 1)), []);
  const goTo = useCallback((i: number) => {
    const k = Math.max(0, Math.min(ROUTE.length - 1, i));
    setPos({ lat: ROUTE[k].lat, lng: ROUTE[k].lng }); // jump (no glide), e.g. when opened from the list
    setStop(k);
  }, []);
  const reset = useCallback(() => { setStop(0); setAuto(false); }, []);
  return { stop, pos, auto, setAuto, next, prev, goTo, reset, last: stop >= ROUTE.length - 1 };
}
