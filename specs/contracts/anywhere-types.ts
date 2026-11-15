// SpotAgents Anywhere shared types. Status: Approved (2026-11-15). FROZEN.
// Copied verbatim into apps/web/src/anywhere/types.ts and supabase/functions/_shared/anywhere-types.ts.
// *_units are decimal strings of token base units (pieUSD: 18 decimals). Convert with BigInt(), never Number().

export type Units = string;

export type AgentStatus = "in_review" | "listed" | "listed_unreviewed" | "rejected";

export interface CompiledFact { claim: string; basis: "from_notes" | "common_knowledge" }
export interface CompiledStory { title: string; text: string; kind: "personal_memory" | "local_legend" | "practical_tip" }

/** Full SERV output (anywhere-agent.schema.json). `premium` never leaves the server. */
export interface CompiledAgent {
  persona: string;
  greeting: string;
  facts: CompiledFact[];
  stories: CompiledStory[];
  teaser: string;
  premium: string;
  suggested_questions: string[];
  languages: string[];
}

export interface CompileRequest {
  name: string;
  title?: string;            // "Local historian"
  place_name?: string;
  city?: string;
  lat: number;
  lng: number;
  radius_m?: number;         // default 60
  notes: string;             // 20–4000 chars
  price_usd: number;         // 0.01–0.10, display value; server converts to units
}

export interface AgentSummary {
  id: string;
  name: string;
  title: string;
  place_name: string;
  city: string;
  lat: number;
  lng: number;
  radius_m: number;
  avatar: string;
  color: string;
  price_units: Units;
  price_usd: number;
  status: AgentStatus;
  quality_score: number | null;
  sample: boolean;           // "Sample creator · demo"
  is_mine: boolean;
  distance_m: number | null; // when lat/lng were given, rounded to 10 m
  created_at: string;
}

export interface ReviewEntry { version: number; score: number | null; decision: string | null; critique: string | null; at: string }

export interface AgentDetail extends AgentSummary {
  greeting: string;
  facts: CompiledFact[];
  stories: { title: string; kind: CompiledStory["kind"] }[]; // story text is premium
  teaser: string;
  suggested_questions: string[];
  languages: string[];
  version: number;
  quality_decision: "accept" | "revise" | "reject" | null;
  quality_critique: string | null;
  review_history: ReviewEntry[];
}

export interface ChatMessage { role: "user" | "assistant"; content: string }
export interface ChatRequest { agent_id: string; messages: ChatMessage[] }
export type ChatEvent = { text: string } | { error: string } | { premium: boolean };

export interface PaymentRequired { error: "payment_required"; agent_id: string; price_units: Units; price_usd: number }

export interface ReviewStatus {
  agent_id: string;
  status: AgentStatus;
  version: number;
  quality_score: number | null;
  quality_decision: "accept" | "revise" | "reject" | null;
  quality_critique: string | null;
  review_history: ReviewEntry[];
}

export interface PaymentView {
  id: string;
  agent_id: string;
  agent_name: string;
  amount_units: Units;
  status: "settled" | "simulated" | "failed";
  tx_hash: string | null;
  explorer_url: string | null; // https://testnet.kitescan.ai/tx/<hash>
  error: string | null;
  unlocked_until: string | null;
  created_at: string;
}

export interface BudgetView {
  budget_units: Units;
  per_tx_cap_units: Units;
  spent_units: Units;
  remaining_units: Units;
  expires_at: string;
  agent_wallet: string;      // tour agent address (public)
  payments: PaymentView[];
}

export interface AgentPayResult {
  status: "settled" | "simulated" | "refused" | "failed";
  reason?: string;           // refused/failed/simulated: why
  payment?: PaymentView;
  budget: BudgetView;
}

/** Cities for the picker (location denied or remote judges). */
export const CITIES = [
  { name: "Pune", lat: 18.5195, lng: 73.8553 },
  { name: "Rome", lat: 41.8902, lng: 12.4922 },
  { name: "Paris", lat: 48.8584, lng: 2.2945 },
  { name: "New York", lat: 40.7580, lng: -73.9855 },
  { name: "Tokyo", lat: 35.7148, lng: 139.7967 },
  { name: "London", lat: 51.5007, lng: -0.1246 },
] as const;
