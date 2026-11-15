// Poll Reppo for an in-review agent; list it, rebuild with the critique, or reject.
import { admin, caller, cors, json } from "../_shared/common.ts";
import { compileAgent } from "../_shared/serv.ts";
import { evalInput, pollEval, reppoConfigured, submitEval } from "../_shared/reppo.ts";
import type { CompiledAgent, ReviewEntry, ReviewStatus } from "../_shared/anywhere-types.ts";

const PASS_SCORE = 70;
const STALE_MS = 15 * 60 * 1000; // Reppo normally answers in 30-90 s

// deno-lint-ignore no-explicit-any
function view(r: any): ReviewStatus {
  return {
    agent_id: r.id, status: r.status, version: r.version, quality_score: r.quality_score,
    quality_decision: r.quality_decision, quality_critique: r.quality_critique, review_history: r.review_history ?? [],
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  // deno-lint-ignore no-explicit-any
  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  if (!body || typeof body.agent_id !== "string") return json({ error: "agent_id is required" }, 400);

  const db = admin();
  const uid = await caller(req, db);
  if (!uid) return json({ error: "Sign in first" }, 401);

  const { data: a, error } = await db.from("ax_agents").select("*").eq("id", body.agent_id).maybeSingle();
  if (error) return json({ error: /uuid/i.test(error.message) ? "Agent not found" : error.message }, /uuid/i.test(error.message) ? 404 : 500);
  if (!a || (a.status !== "listed" && a.status !== "listed_unreviewed" && a.owner_id !== uid)) return json({ error: "Agent not found" }, 404);
  if (a.status !== "in_review") return json(view(a));

  const update = async (patch: Record<string, unknown>) => {
    const { data, error: e } = await db.from("ax_agents").update(patch).eq("id", a.id).eq("status", "in_review").select("*").maybeSingle();
    if (e) throw new Error(e.message);
    return data ?? (await db.from("ax_agents").select("*").eq("id", a.id).single()).data;
  };
  const unreviewed = (why: string) => {
    console.error("review unavailable:", why);
    return update({ status: "listed_unreviewed" });
  };

  try {
    if (!reppoConfigured()) return json(view(await unreviewed("no REPPO_API_KEY")));
    if (!a.reppo_eval_id) {
      // Submission never happened (or a rebuild's resubmit failed).
      try {
        const id = await submitEval(evalInput(a.compiled, a.source_notes, a.name, a.place_name));
        return json(view(await update({ reppo_eval_id: id })));
      } catch (e) {
        return json(view(await unreviewed(String(e))));
      }
    }

    let p;
    try {
      p = await pollEval(a.reppo_eval_id);
    } catch (e) {
      // Transient poll errors keep it in review until the stale limit.
      if (Date.now() - new Date(a.created_at).getTime() > STALE_MS * 2) return json(view(await unreviewed(String(e))));
      return json(view(a));
    }
    const age = Date.now() - new Date(a.created_at).getTime();
    if (p.state === "pending") {
      return json(view(age > STALE_MS * 2 ? await unreviewed("reppo pending too long") : a));
    }
    if (p.state === "failed") return json(view(await unreviewed("reppo failed: " + p.reason)));

    const entry: ReviewEntry = {
      version: a.version, score: p.score, decision: p.decision, critique: p.critique, at: new Date().toISOString(),
    };
    const history = [...(a.review_history ?? []), entry];
    const passed = p.decision === "accept" || (p.score !== null && p.score >= PASS_SCORE);
    const base = {
      quality_score: p.score, quality_decision: p.decision, quality_critique: p.critique, review_history: history,
    };
    if (passed) return json(view(await update({ ...base, status: "listed" })));
    if (a.version >= 3) return json(view(await update({ ...base, status: "rejected" })));

    // Rebuild with the critique, resubmit, stay in review.
    const compiled: CompiledAgent = await compileAgent(
      { name: a.name, title: a.title, place_name: a.place_name, city: a.city, notes: a.source_notes },
      p.critique ?? `Score ${p.score}. Improve accuracy and remove anything not in the notes.`,
      a.compiled,
    );
    let evalId: string | null = null;
    try {
      evalId = await submitEval(evalInput(compiled, a.source_notes, a.name, a.place_name));
    } catch (e) {
      console.error("resubmit failed", String(e));
    }
    return json(view(await update({
      ...base, compiled, version: a.version + 1, reppo_eval_id: evalId,
      status: evalId ? "in_review" : "listed_unreviewed",
    })));
  } catch (e) {
    console.error("ax-review failed", String(e));
    return json({ error: "Review check failed" }, 500);
  }
});
