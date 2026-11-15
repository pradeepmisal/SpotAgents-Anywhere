import { useEffect, useState } from "react";
import { ArrowLeft, BookOpen, Lightbulb, MessageCircle, MapPin, ScrollText, ShieldCheck } from "lucide-react";
import { getAgent } from "../api";
import { useReviewPoll } from "../hooks";
import type { AgentDetail, CompiledStory } from "../types";
import { haversineM, formatDistance } from "../geo";
import type { LatLng } from "../geo";
import { unitsToUsd } from "../money";
import { Face, ScoreBadge, SourceBadge, VirtualBadge, isVirtual } from "../parts";

const KIND: Record<CompiledStory["kind"], { label: string; Icon: typeof BookOpen }> = {
  personal_memory: { label: "Personal memory", Icon: BookOpen },
  local_legend: { label: "Local legend", Icon: ScrollText },
  practical_tip: { label: "Practical tip", Icon: Lightbulb },
};

interface Props {
  id: string;
  from: LatLng;
  /** Optional pre-fetched detail (e.g. just compiled in Studio). */
  initial?: AgentDetail | null;
  onBack: () => void;
  onTalk: (a: AgentDetail) => void;
}

export function ReviewPanel({ a, review }: { a: AgentDetail; review: ReturnType<typeof useReviewPoll> }) {
  const status = review?.status ?? a.status;
  const score = review?.quality_score ?? a.quality_score;
  const critique = review?.quality_critique ?? a.quality_critique;
  const history = review?.review_history ?? a.review_history;
  const version = review?.version ?? a.version;
  return (
    <div className="box review">
      <h2><ShieldCheck size={16} /> Quality review</h2>
      <p><ScoreBadge status={status} score={score} /></p>
      {status === "in_review" && <p>Reppo is evaluating this agent against the creator's notes (version {version}). This page checks every 30 seconds.</p>}
      {status === "listed_unreviewed" && <p>Listed without a Reppo review (the reviewer was not available).</p>}
      {critique && <p>Reviewer note: {critique}</p>}
      {history.length > 0 && (
        <ul>{history.map((h) => <li key={h.version}>v{h.version}: {h.score ?? "no score"} · {h.decision ?? "pending"}</li>)}</ul>
      )}
    </div>
  );
}

export default function AgentPage({ id, from, initial, onBack, onTalk }: Props) {
  const [a, setA] = useState<AgentDetail | null>(initial ?? null);
  const [err, setErr] = useState<string | null>(null);
  const review = useReviewPoll(id, a?.status ?? "listed");

  useEffect(() => {
    let live = true;
    getAgent(id).then((d) => { if (live) setA(d); }).catch((e: Error) => { if (live) setErr(e.message); });
    return () => { live = false; };
  }, [id, review?.status]);

  if (err) return <div className="pagehead"><button className="icon-btn" onClick={onBack} aria-label="Back"><ArrowLeft size={20} /></button><p className="err-text" role="alert">{err}</p></div>;
  if (!a) return <div className="pagehead"><button className="icon-btn" onClick={onBack} aria-label="Back"><ArrowLeft size={20} /></button><p className="empty">Loading agent…</p></div>;

  const dist = haversineM(from, a);
  const withDist = { ...a, distance_m: dist };
  const status = review?.status ?? a.status;
  const canTalk = status !== "rejected";

  return (
    <div className="agent-page">
      <div className="ap-hero" style={{ background: `linear-gradient(160deg, ${a.color || "#1f8a4c"}, #14301f)` }}>
        <button className="icon-btn onphoto" onClick={onBack} aria-label="Back"><ArrowLeft size={20} /></button>
        <div className="ap-id">
          <Face a={a} size={76} />
          <div>
            <h1>{a.name}</h1>
            <p>{a.title}</p>
            <p><MapPin size={13} /> {[a.place_name, a.city].filter(Boolean).join(", ")} · {formatDistance(dist)}</p>
          </div>
        </div>
      </div>
      <div className="ap-badges">
        <ScoreBadge status={status} score={review?.quality_score ?? a.quality_score} />
        <SourceBadge a={a} />
        <VirtualBadge a={withDist} />
      </div>
      {isVirtual(withDist) && <p className="ap-note">You are outside this spot's {a.radius_m} m radius, so this is a virtual visit: the agent answers from what its creator wrote, not from where you stand.</p>}

      <div className="prof">
        <div className="box"><h2>Greeting</h2><p>{a.greeting}</p></div>
        {a.facts.length > 0 && (
          <div className="box"><h2>Facts</h2>
            <ul>{a.facts.map((f, i) => <li key={i}>{f.claim} <small>({f.basis === "from_notes" ? "from the creator's notes" : "common knowledge"})</small></li>)}</ul>
          </div>
        )}
        {a.stories.length > 0 && (
          <div className="box"><h2>Stories <small>(unlock with premium)</small></h2>
            <div className="stories">{a.stories.map((s, i) => { const { label, Icon } = KIND[s.kind]; return <span key={i} className="story"><Icon size={16} /><span><strong>{s.title}</strong><small>{label}</small></span></span>; })}</div>
          </div>
        )}
        <ReviewPanel a={a} review={review} />
        <div className="box price"><div className="kv"><span>Premium 30-minute session</span><strong>{unitsToUsd(a.price_units)}</strong></div><p>The first question is free. Pay once to ask more and hear the full stories.</p></div>
      </div>
      <div className="stickybar">
        <button className="btn primary block" disabled={!canTalk} onClick={() => onTalk(a)}><MessageCircle size={18} /> {isVirtual(withDist) ? "Talk (virtual visit)" : "Talk to " + a.name.split(" ")[0]}</button>
      </div>
    </div>
  );
}
