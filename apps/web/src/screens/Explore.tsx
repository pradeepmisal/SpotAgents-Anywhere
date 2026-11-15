import { useMemo, useState } from "react";
import { Search, Wifi } from "lucide-react";
import type { NearbyAgent } from "../types";
import { formatDistance, formatNear } from "../nearby/NearbyList";
import { spotImage, spotName } from "../ui/spots";
import MapView from "./MapView";

interface Props {
  agents: NearbyAgent[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onOpen: (a: NearbyAgent) => void;
  onVirtual: () => void;
  user: { lat: number; lng: number } | null;
  userLabel: string;
}

export function PriceBadge({ a }: { a: NearbyAgent }) {
  return a.price_yocto
    ? <span className="badge paid">{formatNear(a.price_yocto)} NEAR</span>
    : <span className="badge free">Free</span>;
}

export default function Explore({ agents, loading, error, onRetry, onOpen, onVirtual, user, userLabel }: Props) {
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return [...agents].filter((a) => !t || a.name.toLowerCase().includes(t)).sort((a, b) => a.distance_m - b.distance_m);
  }, [agents, q]);

  return (
    <>
      <h1 className="h-hero">Discover living stories around you</h1>
      <label className="search">
        <Search size={18} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a guide or spot" aria-label="Search guides and spots" />
      </label>
      <div className="chips">
        <button className="chip on" aria-pressed="true">Nearby</button>
        <button className="chip" onClick={onVirtual}>Virtual visit</button>
      </div>
      <div className="map-wrap">
        <MapView agents={list} user={user} onOpen={onOpen} />
        <span className="badge sim map-note"><Wifi size={12} /> {userLabel}</span>
      </div>
      <div className="sec-h"><h2>Places nearby</h2><small>Distances from the main entrance</small></div>
      {loading ? (
        <p className="empty">Loading guides…</p>
      ) : error ? (
        <div className="empty" role="alert"><p>Could not load guides: {error}</p><button className="btn primary sm" onClick={onRetry}>Retry</button></div>
      ) : list.length === 0 ? (
        <p className="empty">{q ? "No guide or spot matches your search." : "No guides found."}</p>
      ) : (
        <div className="cards">
          {list.map((a) => (
            <button key={a.id} className="place" onClick={() => onOpen(a)}>
              <img className="ph" src={spotImage(a)} alt="" loading="lazy" />
              <span className="pb">
                <strong>{spotName(a)}</strong>
                <small>{formatDistance(a.distance_m)} · 1 guide</small>
                <span className="row2"><PriceBadge a={a} /></span>
              </span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}
