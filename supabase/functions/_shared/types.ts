// SpotAgents shared types. Status: Approved (2026-11-14). FROZEN once approved.
// Copied verbatim into apps/web/src/types.ts and supabase/functions/_shared/types.ts.
// yoctoNEAR is always a decimal string on the wire; convert with BigInt(), never Number().

export type Yocto = string;

/** One row of the nearby_agents() RPC. */
export interface NearbyAgent {
  id: string;
  name: string;
  emoji: string | null;
  color: string | null;
  avatar: string;            // apps/web/public/avatars/<avatar>.glb
  voice: string | null;
  greeting: string;
  radius_m: number;          // exact lat/lng are deliberately not exposed
  price_yocto: Yocto | null; // null = free
  creator_account: string | null;
  is_mine: boolean;
  distance_m: number;        // rounded to 10 m
}

/** Fixed public demo location for judges who aren't in Pune (matches supabase/seed.sql). */
export const DEMO_CITY = { name: "Demo City · Shaniwar Wada, Pune", lat: 18.5195, lng: 73.8553 } as const; // [VERIFY coords]

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  agent_id: string;
  messages: ChatMessage[];   // the last one must be from the user
  client?: { now?: string; timezone?: string };
}

/** One SSE `data:` payload from the chat function. The stream ends with `data: [DONE]`. */
export type ChatEvent =
  | { text: string }
  | { error: string }
  | { premium: boolean };    // sent first: whether premium context is active for this reply

/** Body of a 402 from chat when the agent is paid and not unlocked. */
export interface PaymentRequired {
  error: "payment_required";
  agent_id: string;
  price_yocto: Yocto;
}

export interface QuoteRequest { agent_id: string }

export interface Quote {
  quote_id: string;
  contract_id: string;       // spot_pay account
  agent_id: string;
  creator_account: string;
  amount_yocto: Yocto;       // attach exactly this as the deposit
  fee_bps: number;
  expires_at: string;        // ISO time
}

export interface VerifyRequest {
  quote_id: string;
  tx_hash?: string;          // from the wallet; used only for the explorer link
}

export interface VerifyResult {
  status: "paid" | "pending" | "expired" | "invalid";
  unlocked_until: string | null;
  payer_account: string | null;
  explorer_url: string | null;
  reason?: string;           // set when status is "invalid"
  session_status?: "active" | "released" | null; // ADR-009: set when paid through a guided session
}
