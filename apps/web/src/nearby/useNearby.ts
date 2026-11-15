import { useEffect, useState } from "react";
import type { NearbyAgent } from "../types";
import { MOCK_AGENTS } from "../mock";
import { ensureSession, supabase } from "../supabase";

export interface NearbyState {
  agents: NearbyAgent[];
  loading: boolean;
  error: string | null;
}

/** nearby_agents RPC. lat/lng null = not ready yet. `mock` uses fixtures. Never fakes data on failure. */
export function useNearby(lat: number | null, lng: number | null, mock: boolean, reloadKey = 0): NearbyState {
  const [state, setState] = useState<NearbyState>({ agents: [], loading: false, error: null });

  useEffect(() => {
    if (mock) { setState({ agents: MOCK_AGENTS, loading: false, error: null }); return; }
    if (lat === null || lng === null) { setState({ agents: [], loading: true, error: null }); return; }
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    (async () => {
      await ensureSession();
      const { data, error } = await supabase.rpc("nearby_agents", { p_lat: lat, p_lng: lng, p_km: 1 });
      if (error) throw error;
      return data as NearbyAgent[];
    })()
      .then((agents) => alive && setState({ agents, loading: false, error: null }))
      .catch((e) => alive && setState({ agents: [], loading: false, error: String(e?.message ?? e) }));
    return () => { alive = false; };
  }, [lat, lng, mock, reloadKey]);

  return state;
}
