import { useEffect, useRef, useState } from "react";

export type GpsState = "off" | "waiting" | "ok" | "denied";

/**
 * Watches the device position but publishes it at most every `everyMs` (default 5 s).
 * In memory only: never stored, logged or displayed (home-location privacy rule).
 */
export function useRealPosition(enabled: boolean, everyMs = 5000) {
  const [state, setState] = useState<GpsState>("off");
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const latest = useRef<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!enabled) { setState("off"); setPos(null); latest.current = null; return; }
    if (!navigator.geolocation) { setState("denied"); return; }
    setState("waiting");
    const wid = navigator.geolocation.watchPosition(
      (p) => {
        const first = latest.current === null;
        latest.current = { lat: p.coords.latitude, lng: p.coords.longitude };
        if (first) { setState("ok"); setPos(latest.current); }
      },
      () => setState("denied"),
      { enableHighAccuracy: true, maximumAge: 2000 },
    );
    const tid = window.setInterval(() => { if (latest.current) setPos(latest.current); }, everyMs);
    return () => { navigator.geolocation.clearWatch(wid); window.clearInterval(tid); };
  }, [enabled, everyMs]);

  return { state, pos };
}
