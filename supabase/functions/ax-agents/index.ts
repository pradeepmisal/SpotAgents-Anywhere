// Discover agents. Never returns source_notes or compiled.premium.
import { admin, caller, cors, json } from "../_shared/common.ts";
import type { AgentDetail, AgentSummary, CompiledAgent } from "../_shared/anywhere-types.ts";

const COLS = "id, owner_id, name, title, place_name, city, lat, lng, radius_m, avatar, color, price_units::text, price_usd, status, quality_score, sample, created_at, expires_at, compiled, version, quality_decision, quality_critique, review_history";

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad, dLng = (lng2 - lng1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// deno-lint-ignore no-explicit-any
function summary(r: any, uid: string | null, here: { lat: number; lng: number } | null): AgentSummary {
  return {
    id: r.id, name: r.name, title: r.title, place_name: r.place_name, city: r.city, lat: r.lat, lng: r.lng,
    radius_m: r.radius_m, avatar: r.avatar, color: r.color, price_units: String(r.price_units),
    price_usd: Number(r.price_usd), status: r.status, quality_score: r.quality_score, sample: r.sample,
    is_mine: !!uid && r.owner_id === uid,
    distance_m: here ? Math.round(haversineM(here.lat, here.lng, r.lat, r.lng) / 10) * 10 : null,
    created_at: r.created_at,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "GET") return json({ error: "GET only" }, 405);

  const db = admin();
  const uid = await caller(req, db);
  if (!uid) return json({ error: "Sign in first" }, 401);

  const url = new URL(req.url);
  const latP = url.searchParams.get("lat"), lngP = url.searchParams.get("lng");
  const lat = latP === null ? NaN : Number(latP), lng = lngP === null ? NaN : Number(lngP);
  const here = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
  const nowIso = new Date().toISOString();

  const id = url.searchParams.get("id");
  if (id) {
    const { data, error } = await db.from("ax_agents").select(COLS).eq("id", id).maybeSingle();
    if (error) return json({ error: /uuid/i.test(error.message) ? "Agent not found" : error.message }, /uuid/i.test(error.message) ? 404 : 500);
    const expired = data?.expires_at && data.expires_at < nowIso;
    const visible = data && !expired && (["listed", "listed_unreviewed"].includes(data.status) || data.owner_id === uid);
    if (!visible) return json({ error: "Agent not found" }, 404);
    const c = data.compiled as CompiledAgent;
    const detail: AgentDetail = {
      ...summary(data, uid, here),
      greeting: c.greeting, facts: c.facts,
      stories: c.stories.map((s) => ({ title: s.title, kind: s.kind })),
      teaser: c.teaser, suggested_questions: c.suggested_questions, languages: c.languages,
      version: data.version, quality_decision: data.quality_decision, quality_critique: data.quality_critique,
      review_history: data.review_history ?? [],
    };
    return json(detail);
  }

  const { data, error } = await db.from("ax_agents").select(COLS)
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    .or(`status.in.(listed,listed_unreviewed),owner_id.eq.${uid}`)
    .order("created_at", { ascending: false }).limit(1000);
  if (error) return json({ error: error.message }, 500);
  let list = (data ?? []).map((r) => summary(r, uid, here));
  if (here) list.sort((a, b) => (a.distance_m ?? 0) - (b.distance_m ?? 0));
  list = list.slice(0, 300);
  return json(list);
});
