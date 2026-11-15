// ?mock=1 sample data. Everything here is labelled in the UI ("Sample creator · demo", "Mock mode").
import type { AgentDetail, AgentPayResult, AgentSummary, BudgetView, CompileRequest, PaymentView, ReviewStatus } from "./types";
import { usdToUnits } from "./money";
import { mockUnlocked } from "../chat/mockStream";

interface Seed { name: string; title: string; place: string; city: string; lat: number; lng: number; color: string; usd: number; fact: string; story: string }

const SEEDS: Seed[] = [
  { name: "Giulia Rossi", title: "Local historian", place: "Colosseum", city: "Rome", lat: 41.8902, lng: 12.4922, color: "#b45309", usd: 0.05, fact: "The Colosseum could seat roughly 50,000 spectators.", story: "The hidden tunnels under the arena floor" },
  { name: "Antoine Leclerc", title: "Tour guide", place: "Eiffel Tower", city: "Paris", lat: 48.8584, lng: 2.2945, color: "#1d4ed8", usd: 0.03, fact: "The tower was meant to stand for only 20 years.", story: "The painters who repaint it every seven years" },
  { name: "Maya Brooks", title: "Street food expert", place: "Times Square", city: "New York", lat: 40.758, lng: -73.9855, color: "#be123c", usd: 0.04, fact: "The square is named after The New York Times, which moved there in 1904.", story: "Where to eat well within two blocks" },
  { name: "Haruto Sato", title: "Temple keeper", place: "Senso-ji", city: "Tokyo", lat: 35.7148, lng: 139.7967, color: "#7c3aed", usd: 0.06, fact: "Senso-ji is Tokyo's oldest temple.", story: "The giant lantern at Kaminarimon gate" },
  { name: "Oliver Hale", title: "Parliament guide", place: "Big Ben", city: "London", lat: 51.5007, lng: -0.1246, color: "#0f766e", usd: 0.02, fact: "Big Ben is the name of the bell, not the tower.", story: "The clock that kept time through the Blitz" },
  { name: "Aarav Kulkarni", title: "Fort storyteller", place: "Shaniwar Wada", city: "Pune", lat: 18.5195, lng: 73.8553, color: "#1f8a4c", usd: 0.05, fact: "The palace was the seat of the Peshwas from 1732.", story: "The fire of 1828 and the fountain that remains" },
];

const now = () => new Date().toISOString();
const agents: AgentDetail[] = SEEDS.map((s, i) => ({
  id: `mock-${i + 1}`, name: s.name, title: s.title, place_name: s.place, city: s.city, lat: s.lat, lng: s.lng, radius_m: 80,
  avatar: "brunette", color: s.color, price_units: usdToUnits(s.usd), price_usd: s.usd, status: i === 4 ? "listed_unreviewed" : "listed",
  quality_score: i === 4 ? null : 78 + i * 3, sample: true, is_mine: false, distance_m: null, created_at: now(),
  greeting: `[mock] Hello, I am ${s.name}, ${s.title.toLowerCase()} at ${s.place}. Ask me anything.`,
  facts: [{ claim: s.fact, basis: "common_knowledge" }, { claim: `${s.place} is in ${s.city}.`, basis: "common_knowledge" }],
  stories: [{ title: s.story, kind: "local_legend" }, { title: `A tip for visiting ${s.place}`, kind: "practical_tip" }],
  teaser: `Ask about ${s.place}, or unlock the full story for $${s.usd.toFixed(2)}.`,
  suggested_questions: [`Why is ${s.place} famous?`, "Tell me a lesser-known story"],
  languages: ["en"], version: 1, quality_decision: i === 4 ? null : "accept", quality_critique: null, review_history: [],
}));

const summary = (a: AgentDetail): AgentSummary => {
  const { greeting: _g, facts: _f, stories: _s, teaser: _t, suggested_questions: _q, languages: _l, version: _v, quality_decision: _d, quality_critique: _c, review_history: _r, ...rest } = a;
  void [_g, _f, _s, _t, _q, _l, _v, _d, _c, _r];
  return rest;
};

export const mockAgents = (): AgentSummary[] => agents.map(summary);
export const mockAgent = (id: string): AgentDetail => {
  const a = agents.find((x) => x.id === id);
  if (!a) throw new Error("Agent not found");
  return { ...a };
};

export function mockCompile(req: CompileRequest): AgentDetail {
  const d: AgentDetail = {
    id: `mock-new-${Date.now()}`, name: req.name, title: req.title || "Local expert", place_name: req.place_name ?? "", city: req.city ?? "",
    lat: req.lat, lng: req.lng, radius_m: req.radius_m ?? 60, avatar: "brunette", color: "#1f8a4c", price_units: usdToUnits(req.price_usd), price_usd: req.price_usd,
    status: "in_review", quality_score: null, sample: false, is_mine: true, distance_m: null, created_at: now(),
    greeting: `[mock compile] Hi, I am ${req.name}. This text is a placeholder, not SERV Reasoning output.`,
    facts: [{ claim: req.notes.slice(0, 90), basis: "from_notes" }],
    stories: [{ title: "Your notes, as a story (mock)", kind: "personal_memory" }],
    teaser: "Mock teaser.", suggested_questions: ["What should I see here?"], languages: ["en"], version: 1,
    quality_decision: null, quality_critique: null, review_history: [],
  };
  agents.unshift(d);
  reviewPolls.set(d.id, 0);
  return { ...d };
}

const reviewPolls = new Map<string, number>();
/** Mock Reppo review: the second poll for a new agent lists it with a sample score. */
export function mockReview(id: string): ReviewStatus {
  const a = agents.find((x) => x.id === id);
  if (!a) throw new Error("Agent not found");
  const n = (reviewPolls.get(id) ?? 99) + 1;
  reviewPolls.set(id, n);
  if (a.status === "in_review" && n >= 2) {
    a.status = "listed"; a.quality_score = 82; a.quality_decision = "accept";
    a.review_history = [{ version: 1, score: 82, decision: "accept", critique: null, at: now() }];
  }
  return { agent_id: id, status: a.status, version: a.version, quality_score: a.quality_score, quality_decision: a.quality_decision, quality_critique: a.quality_critique, review_history: a.review_history };
}

const payments: PaymentView[] = [];
let spent = 0n;
const BUDGET = BigInt(usdToUnits(1)), CAP = BigInt(usdToUnits(0.1));
const budgetExpires = new Date(Date.now() + 24 * 3600_000).toISOString();

export function mockBudget(): BudgetView {
  return {
    budget_units: BUDGET.toString(), per_tx_cap_units: CAP.toString(), spent_units: spent.toString(), remaining_units: (BUDGET - spent).toString(),
    expires_at: budgetExpires, agent_wallet: "0x0000000000000000000000000000000000000000", payments: [...payments].reverse(),
  };
}

/** Mock tour-agent payment: always "simulated" (no chain involved), and says so. */
export function mockAgentPay(agentId: string): AgentPayResult {
  const a = agents.find((x) => x.id === agentId);
  if (!a) throw new Error("Agent not found");
  const price = BigInt(a.price_units);
  if (price > CAP || spent + price > BUDGET) return { status: "refused", reason: price > CAP ? "Price is above the per-purchase cap." : "Not enough budget left.", budget: mockBudget() };
  spent += price;
  mockUnlocked.add(agentId);
  const p: PaymentView = {
    id: `mock-pay-${payments.length + 1}`, agent_id: agentId, agent_name: a.name, amount_units: a.price_units, status: "simulated", tx_hash: null,
    explorer_url: null, error: "Mock mode: no payment was made", unlocked_until: new Date(Date.now() + 30 * 60_000).toISOString(), created_at: now(),
  };
  payments.push(p);
  return { status: "simulated", reason: "Mock mode: no payment was made", payment: p, budget: mockBudget() };
}
