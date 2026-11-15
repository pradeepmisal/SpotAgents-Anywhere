import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getAgents, reviewAgent } from "./api";
import { CITIES } from "./types";
import type { AgentStatus, AgentSummary, ReviewStatus } from "./types";
import { haversineM } from "./geo";
import type { LatLng } from "./geo";

export interface Place extends LatLng { label: string; source: "device" | "city" }

const DEFAULT_CITY = CITIES[0];

/**
 * The visitor's chosen position. Kept in memory only (never stored or sent anywhere except the
 * ax-agents distance query): a device fix, or a city from the picker.
 */
export function useLocation() {
  const [place, setPlace] = useState<Place>({ lat: DEFAULT_CITY.lat, lng: DEFAULT_CITY.lng, label: DEFAULT_CITY.name, source: "city" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickCity = useCallback((name: string) => {
    const c = CITIES.find((x) => x.name === name);
    if (c) { setPlace({ lat: c.lat, lng: c.lng, label: c.name, source: "city" }); setError(null); }
  }, []);

  const locate = useCallback(() => {
    if (!("geolocation" in navigator)) { setError("This browser has no location. Pick a city instead."); return; }
    setBusy(true); setError(null);
    navigator.geolocation.getCurrentPosition(
      (p) => { setPlace({ lat: p.coords.latitude, lng: p.coords.longitude, label: "My location", source: "device" }); setBusy(false); },
      (e) => { setError(e.code === e.PERMISSION_DENIED ? "Location is blocked. Pick a city instead." : "Could not get your location. Pick a city instead."); setBusy(false); },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
    );
  }, []);

  return { place, busy, error, pickCity, locate };
}

/** All agents (GET ax-agents), with distances from `from` computed locally so the list is always sorted. */
export function useAgents(from: LatLng, reloadKey = 0) {
  const [raw, setRaw] = useState<AgentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [n, setN] = useState(0);

  useEffect(() => {
    let live = true;
    setLoading(true); setError(null);
    getAgents(from.lat, from.lng)
      .then((a) => { if (live) { setRaw(a); setLoading(false); } })
      .catch((e: Error) => { if (live) { setError(e.message); setLoading(false); } });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from.lat, from.lng, reloadKey, n]);

  const agents = useMemo(
    () => raw.map((a) => ({ ...a, distance_m: haversineM(from, a) })).sort((a, b) => a.distance_m - b.distance_m),
    [raw, from],
  );
  return { agents, loading, error, retry: () => setN((x) => x + 1) };
}

const POLL_MS = 30_000;

/** Polls ax-review every 30 s while the agent is `in_review`; returns the freshest status. */
export function useReviewPoll(agentId: string, initial: AgentStatus, onStatus?: (r: ReviewStatus) => void) {
  const [review, setReview] = useState<ReviewStatus | null>(null);
  const cb = useRef(onStatus);
  cb.current = onStatus;
  const status = review?.status ?? initial;

  useEffect(() => {
    if (status !== "in_review") return;
    let live = true;
    const tick = () => reviewAgent(agentId).then((r) => { if (live) { setReview(r); cb.current?.(r); } }).catch(() => {});
    const first = window.setTimeout(tick, MOCK_FIRST_MS());
    const t = window.setInterval(tick, POLL_MS);
    return () => { live = false; window.clearTimeout(first); window.clearInterval(t); };
  }, [agentId, status]);

  return review;
}

// A first check shortly after opening (then every 30 s); mock mode checks faster so the flow is visible.
const MOCK_FIRST_MS = () => (new URLSearchParams(window.location.search).get("mock") === "1" ? 4000 : 3000);
