import { useMemo, useState } from "react";
import { LocateFixed, MapPin, Search } from "lucide-react";
import { CITIES } from "../types";
import type { AgentSummary } from "../types";
import type { useLocation } from "../hooks";
import AxMap from "../AxMap";
import { formatDistance } from "../geo";
import { Face, ScoreBadge, SourceBadge, VirtualBadge, PriceBadge } from "../parts";

type Loc = ReturnType<typeof useLocation>;

interface Props {
  loc: Loc;
  agents: AgentSummary[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onOpen: (a: AgentSummary) => void;
  /** "list" = the Agents tab (no map). */
  variant?: "explore" | "list";
}

export function AgentRow({ a, onOpen }: { a: AgentSummary; onOpen: (a: AgentSummary) => void }) {
  return (
    <button className="arow" onClick={() => onOpen(a)}>
      <Face a={a} size={52} />
      <span className="arow-b">
        <strong>{a.name}</strong>
        <small>{a.title} · {a.place_name || a.city}</small>
        <span className="row2">
          <ScoreBadge status={a.status} score={a.quality_score} />
          <SourceBadge a={a} />
        </span>
      </span>
      <span className="arow-r">
        <small>{formatDistance(a.distance_m)}</small>
        <PriceBadge units={a.price_units} />
      </span>
    </button>
  );
}

export function LocationBar({ loc }: { loc: Loc }) {
  return (
    <div className="locbar">
      <button className="btn sm" onClick={loc.locate} disabled={loc.busy} aria-label="Use my location">
        <LocateFixed size={16} /> {loc.busy ? "Locating…" : "My location"}
      </button>
      <label className="city">
        <MapPin size={16} />
        <select value={loc.place.source === "city" ? loc.place.label : ""} onChange={(e) => loc.pickCity(e.target.value)} aria-label="Pick a city">
          {loc.place.source === "device" && <option value="">My location</option>}
          {CITIES.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
        </select>
      </label>
      {loc.error && <p className="err-text" role="alert">{loc.error}</p>}
    </div>
  );
}

export default function Explore({ loc, agents, loading, error, onRetry, onOpen, variant = "explore" }: Props) {
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return agents.filter((a) => !t || `${a.name} ${a.title} ${a.place_name} ${a.city}`.toLowerCase().includes(t));
  }, [agents, q]);

  return (
    <>
      {variant === "explore"
        ? <h1 className="h-hero">Expert agents at real places, anywhere on Earth</h1>
        : <div className="pagehead"><h1>Agents</h1><p>Sorted by distance from {loc.place.label}.</p></div>}
      <LocationBar loc={loc} />
      <label className="search">
        <Search size={18} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a person, place or city" aria-label="Search agents" />
      </label>
      {variant === "explore" && (
        <div className="map-wrap">
          <AxMap agents={list} center={loc.place} zoom={loc.place.source === "device" ? 14 : 11} onOpen={onOpen} label="World map of agents" />
          <span className="badge sim map-note"><MapPin size={12} /> {loc.place.source === "device" ? "Your location" : `${loc.place.label} (city picker)`}</span>
        </div>
      )}
      <div className="sec-h"><h2>{variant === "explore" ? "Nearest agents" : `${list.length} agents`}</h2><small>Distance from {loc.place.label}</small></div>
      {loading ? <p className="empty">Loading agents…</p>
        : error ? <div className="empty" role="alert"><p>Could not load agents: {error}</p><button className="btn primary sm" onClick={onRetry}>Retry</button></div>
        : list.length === 0 ? <p className="empty">{q ? "No agent matches your search." : "No agents yet. Create the first one in Studio."}</p>
        : <div className="alist">{(variant === "explore" ? list.slice(0, 8) : list).map((a) => <AgentRow key={a.id} a={a} onOpen={onOpen} />)}</div>}
    </>
  );
}

export { VirtualBadge };
