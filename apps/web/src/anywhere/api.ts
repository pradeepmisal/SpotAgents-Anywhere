// Client for the frozen ax-* contract (specs/contracts/anywhere-api.md). `?mock=1` swaps in labelled sample data.
import { accessToken } from "../supabase";
import type { AgentDetail, AgentPayResult, AgentSummary, BudgetView, CompileRequest, ReviewStatus } from "./types";
import { mockAgent, mockAgentPay, mockAgents, mockBudget, mockCompile, mockReview } from "./mock";

export const MOCK = new URLSearchParams(window.location.search).get("mock") === "1";

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

async function call<T>(fn: string, opts: { method?: string; body?: unknown; query?: Record<string, string | number | undefined> } = {}): Promise<T> {
  const token = await accessToken().catch(() => undefined);
  const qs = Object.entries(opts.query ?? {}).filter(([, v]) => v !== undefined).map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join("&");
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${fn}${qs ? `?${qs}` : ""}`, {
    method: opts.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token ?? import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
    },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, (json as { error?: string }).error ?? `Request failed (HTTP ${res.status})`);
  return json as T;
}

const wait = <T,>(v: T, ms = 250) => new Promise<T>((r) => setTimeout(() => r(v), ms));

export const getAgents = (lat?: number, lng?: number): Promise<AgentSummary[]> =>
  MOCK ? wait(mockAgents()) : call("ax-agents", { query: { lat, lng } });

export const getAgent = (id: string): Promise<AgentDetail> =>
  MOCK ? wait(mockAgent(id), 150) : call("ax-agents", { query: { id } });

export const compileAgent = (req: CompileRequest): Promise<AgentDetail> =>
  MOCK ? wait(mockCompile(req), 1500) : call("ax-compile", { method: "POST", body: req });

export const reviewAgent = (agent_id: string): Promise<ReviewStatus> =>
  MOCK ? wait(mockReview(agent_id), 200) : call("ax-review", { method: "POST", body: { agent_id } });

export const getBudget = (): Promise<BudgetView> =>
  MOCK ? wait(mockBudget(), 150) : call("ax-agent-pay");

export const agentPay = (agent_id: string): Promise<AgentPayResult> =>
  MOCK ? wait(mockAgentPay(agent_id), 1200) : call("ax-agent-pay", { method: "POST", body: { agent_id } });

/** Reverse geocode via OpenStreetMap Nominatim: plain fetch, at most 1 request per second. */
let lastNominatim = 0;
export async function reverseGeocode(lat: number, lng: number): Promise<{ place: string; city: string } | null> {
  const gap = 1100 - (Date.now() - lastNominatim);
  if (gap > 0) await new Promise((r) => setTimeout(r, gap));
  lastNominatim = Date.now();
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&addressdetails=1&lat=${lat}&lon=${lng}`);
    if (!res.ok) return null;
    const j = (await res.json()) as { name?: string; display_name?: string; address?: Record<string, string> };
    const a = j.address ?? {};
    const city = a.city ?? a.town ?? a.village ?? a.municipality ?? a.county ?? "";
    const place = j.name || a.tourism || a.attraction || a.historic || a.amenity || a.road || (j.display_name ?? "").split(",")[0] || "";
    return { place, city };
  } catch { return null; }
}
