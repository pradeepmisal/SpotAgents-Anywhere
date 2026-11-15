import { useEffect, useRef, useState } from "react";
import { LocateFixed, Sparkles } from "lucide-react";
import { ApiError, compileAgent, reverseGeocode } from "../api";
import { useReviewPoll } from "../hooks";
import type { useLocation } from "../hooks";
import type { AgentDetail } from "../types";
import AxMap from "../AxMap";
import type { LatLng } from "../geo";
import { ScoreBadge, SourceBadge } from "../parts";
import { ReviewPanel } from "./AgentPage";

type Loc = ReturnType<typeof useLocation>;

interface Props { loc: Loc; onOpenAgent: (a: AgentDetail) => void }

function Compiled({ a, onOpen }: { a: AgentDetail; onOpen: () => void }) {
  const review = useReviewPoll(a.id, a.status);
  const status = review?.status ?? a.status;
  return (
    <div className="prof">
      <div className="box"><h2><Sparkles size={16} /> Compiled by SERV Reasoning</h2>
        <p><strong>{a.name}</strong> · {a.title} · {[a.place_name, a.city].filter(Boolean).join(", ")}</p>
        <p className="row2"><ScoreBadge status={status} score={review?.quality_score ?? a.quality_score} /><SourceBadge a={a} /></p>
      </div>
      <div className="box"><h2>Greeting</h2><p>{a.greeting}</p></div>
      <div className="box"><h2>Facts</h2><ul>{a.facts.map((f, i) => <li key={i}>{f.claim} <small>({f.basis === "from_notes" ? "from your notes" : "common knowledge"})</small></li>)}</ul></div>
      <div className="box"><h2>Stories</h2><ul>{a.stories.map((s, i) => <li key={i}>{s.title}</li>)}</ul></div>
      <ReviewPanel a={a} review={review} />
      <button className="btn primary block" onClick={onOpen}>Open agent page</button>
    </div>
  );
}

export default function Studio({ loc, onOpenAgent }: Props) {
  const [pin, setPin] = useState<LatLng>({ lat: loc.place.lat, lng: loc.place.lng });
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [placeName, setPlaceName] = useState("");
  const [city, setCity] = useState("");
  const [notes, setNotes] = useState("");
  const [price, setPrice] = useState(0.05);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [out, setOut] = useState<AgentDetail | null>(null);
  const [geo, setGeo] = useState<"idle" | "busy" | "none">("idle");
  const edited = useRef(false);

  // follow the global position when the visitor picks a city / locates
  useEffect(() => { setPin({ lat: loc.place.lat, lng: loc.place.lng }); edited.current = false; }, [loc.place.lat, loc.place.lng]);

  // suggest a place name from OpenStreetMap (Nominatim) when the pin settles; never overwrite typing
  useEffect(() => {
    let live = true;
    setGeo("busy");
    const t = window.setTimeout(() => {
      reverseGeocode(pin.lat, pin.lng).then((r) => {
        if (!live) return;
        if (!r) { setGeo("none"); return; }
        setGeo("idle");
        if (!edited.current) { setPlaceName(r.place); setCity(r.city); }
      });
    }, 700);
    return () => { live = false; window.clearTimeout(t); };
  }, [pin.lat, pin.lng]);

  const notesOk = notes.trim().length >= 20 && notes.length <= 4000;
  const valid = name.trim().length >= 1 && name.length <= 60 && notesOk;

  const submit = async () => {
    setBusy(true); setErr(null);
    try {
      const a = await compileAgent({
        name: name.trim(), title: title.trim() || undefined, place_name: placeName.trim() || undefined, city: city.trim() || undefined,
        lat: pin.lat, lng: pin.lng, notes: notes.trim(), price_usd: Math.round(price * 100) / 100,
      });
      setOut(a);
    } catch (e) {
      setErr(e instanceof ApiError && e.status === 429 ? "You can create 3 agents per 24 hours. Try again later." : (e as Error).message);
    }
    setBusy(false);
  };

  if (out) return (
    <>
      <div className="pagehead"><h1>Your agent is ready</h1><p>It is now in review. You can talk to it while Reppo checks it.</p></div>
      <Compiled a={out} onOpen={() => onOpenAgent(out)} />
    </>
  );

  return (
    <>
      <div className="pagehead"><h1>Studio</h1><p>Place an expert agent at a real spot. Write what you know; SERV Reasoning turns it into a guide, and Reppo reviews it.</p></div>
      <div className="form">
        <div className="map-wrap short">
          <AxMap center={pin} zoom={14} showYou={false} pin={pin} onPin={(p) => { edited.current = false; setPin(p); }} label="Tap the map to place your agent" />
          <span className="badge sim map-note">Tap the map to move the pin</span>
        </div>
        <button className="btn sm" onClick={loc.locate} disabled={loc.busy}><LocateFixed size={16} /> {loc.busy ? "Locating…" : "Pin my location"}</button>
        {loc.error && <p className="err-text" role="alert">{loc.error}</p>}
        <label>Your name<input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="e.g. Priya Kulkarni" /></label>
        <label>Title<input value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Local historian" /></label>
        <label>Place name <small>{geo === "busy" ? "looking up…" : geo === "none" ? "suggestion unavailable" : "suggested from OpenStreetMap"}</small>
          <input value={placeName} onChange={(e) => { edited.current = true; setPlaceName(e.target.value); }} placeholder="e.g. Shaniwar Wada" /></label>
        <label>City<input value={city} onChange={(e) => { edited.current = true; setCity(e.target.value); }} placeholder="e.g. Pune" /></label>
        <label>What you know about this place <small>{notes.trim().length}/4000 · at least 20</small>
          <textarea rows={6} value={notes} maxLength={4000} onChange={(e) => setNotes(e.target.value)} placeholder="Stories, history, tips for visitors, things only locals know. The agent answers only from this and common knowledge." /></label>
        <label>Premium price: <strong>${price.toFixed(2)}</strong>
          <input type="range" min={0.01} max={0.1} step={0.01} value={price} onChange={(e) => setPrice(Number(e.target.value))} aria-label="Premium price in USD" /></label>
        <p className="fine">Demo creator · testnet payments only. Premium sessions last 30 minutes.</p>
        {err && <p className="err-text" role="alert">{err}</p>}
        <button className="btn primary block" disabled={!valid || busy} onClick={() => void submit()}>
          <Sparkles size={18} /> {busy ? "Compiling with SERV Reasoning…" : "Compile with SERV Reasoning"}
        </button>
      </div>
    </>
  );
}
