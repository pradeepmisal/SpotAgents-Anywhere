import type { NearbyAgent } from "../types";
import { formatDistance } from "../nearby/NearbyList";
import { faceSrc, spotName } from "../ui/spots";
import { PriceBadge } from "./Explore";

interface Props { agents: NearbyAgent[]; loading: boolean; error: string | null; onRetry: () => void; onOpen: (a: NearbyAgent) => void }

export default function Agents({ agents, loading, error, onRetry, onOpen }: Props) {
  const list = [...agents].sort((a, b) => a.distance_m - b.distance_m);
  return (
    <>
      <div className="pagehead"><h1>Agents</h1><p>One guide at every spot. Distances from the main entrance.</p></div>
      {loading ? <p className="empty">Loading guides…</p>
        : error ? <div className="empty" role="alert"><p>Could not load guides: {error}</p><button className="btn primary sm" onClick={onRetry}>Retry</button></div>
        : list.length === 0 ? <p className="empty">No guides found.</p>
        : (
          <div className="grid">
            {list.map((a) => (
              <button key={a.id} className="agent" onClick={() => onOpen(a)}>
                <img className="face" src={faceSrc()} alt="" />
                <strong>{a.name}</strong>
                <small>{spotName(a)} · {formatDistance(a.distance_m)}</small>
                <PriceBadge a={a} />
              </button>
            ))}
          </div>
        )}
    </>
  );
}
