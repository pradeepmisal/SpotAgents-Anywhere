import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import type { NearbyAgent, PaymentRequired } from "../types";
import AvatarStage from "../avatar/AvatarStage";
import ChatPanel from "../chat/ChatPanel";
import { useSpeaking, useSpokenSentence } from "../chat/useChat";
import { speak, stopSpeaking } from "../chat/voice";
import { Paywall, toPaymentRequired, releaseSession } from "../near";
import { useHistory } from "../near/session";
import { PriceBadge } from "../screens/Explore";
import Arrival from "../screens/Arrival";
import { faceSrc, spotImage, spotName, suggestionsFor } from "../ui/spots";
import CameraBackdrop from "./CameraBackdrop";
import VirtualBackdrop from "./VirtualBackdrop";
import { ROUTE } from "./route";
import { useGeofence } from "./useGeofence";
import type { useVirtualWalk } from "./useVirtualWalk";
import type { GpsState } from "./useRealPosition";

interface Props {
  mode: "virtual" | "real";
  agents: NearbyAgent[];
  loading: boolean;
  error: string | null;
  gps: GpsState;
  walk: ReturnType<typeof useVirtualWalk>;
  mock: boolean;
  initial: NearbyAgent | null;
  onExit: () => void;
  onSwitchVirtual: () => void;
  /** Switch to the live camera ("I'm here"). */
  onSwitchReal: () => void;
}

type Stage = "walk" | "arrival" | "conv";

export default function Experience({ mode, agents, loading, error, gps, walk, mock, initial, onExit, onSwitchVirtual, onSwitchReal }: Props) {
  const [activeId, setActiveId] = useState<string | null>(initial?.id ?? null);
  const [stage, setStage] = useState<Stage>(initial ? "arrival" : "walk");
  const [paywall, setPaywall] = useState<PaymentRequired | null>(null);
  const [unlockedTick, setUnlockedTick] = useState(0);
  const [sessErr, setSessErr] = useState<string | null>(null);
  const speaking = useSpeaking();
  const sentence = useSpokenSentence();
  const [bigPortrait, setBigPortrait] = useState(false);
  const history = useHistory();

  // keep the last known agent object so the guide stays on screen if a refresh drops it
  const known = useRef(new Map<string, NearbyAgent>());
  agents.forEach((a) => known.current.set(a.id, a));
  if (initial) known.current.set(initial.id, known.current.get(initial.id) ?? initial);
  const active = activeId ? known.current.get(activeId) ?? null : null;
  const away = active ? active.distance_m > active.radius_m * (mode === "real" ? 1.5 : 1) : false; // real GPS gets hysteresis

  const open = useCallback((a: NearbyAgent) => {
    setActiveId(a.id);
    setStage("arrival");
    setPaywall(null);
  }, []);

  const geo = useGeofence(agents, true, (a) => open(a));

  // opened from a list: show the arrival screen once
  const startedInitial = useRef(false);
  useEffect(() => {
    if (initial && !startedInitial.current) { startedInitial.current = true; geo.markOpened(initial.id); open(initial); }
  }, [initial, open, geo]);

  // leaving the radius leaves the guide; the "Guide nearby" chip brings the conversation back
  const wasAway = useRef(false);
  useEffect(() => {
    if (away && !wasAway.current) setStage("walk");
    wasAway.current = away;
  }, [away]);

  // the avatar canvas only resizes on window resize: nudge it after the portrait animates / appears
  useEffect(() => {
    const t = window.setTimeout(() => window.dispatchEvent(new Event("resize")), 380);
    return () => window.clearTimeout(t);
  }, [bigPortrait, stage]);

  useEffect(() => () => { stopSpeaking(); }, []);

  // the greeting is spoken once the user taps "Meet the guide" (a gesture, and the avatar is on screen)
  const meet = () => {
    if (!active) return;
    setStage("conv");
    const a = active;
    window.setTimeout(() => speak(a.greeting, a.voice), 150);
  };
  const reopen = () => { setStage("conv"); };

  const stop = ROUTE[walk.stop];
  const sess = active ? history.find((h) => h.agent_id === active.id && h.status === "active") : undefined;

  const walkBar = (cls: string) => (
    <div className={`walk ${cls}`}>
      <div className="walk-label">
        <small>Stop {walk.stop + 1} of {ROUTE.length}</small>
        <strong>{stop.label}</strong>
      </div>
      <div className="walk-btns">
        <button className="btn" onClick={walk.prev} disabled={walk.stop === 0} aria-label="Previous stop"><ChevronLeft size={18} /></button>
        <button className={`btn${walk.auto ? " on" : ""}`} onClick={() => walk.setAuto(!walk.auto)} aria-pressed={walk.auto}>{walk.auto ? "Pause" : "Auto"}</button>
        <button className="btn primary" onClick={walk.next} disabled={walk.last}>Next <ChevronRight size={18} /></button>
      </div>
    </div>
  );

  return (
    <div className={`experience ${mode}`}>
      {mode === "virtual" ? <VirtualBackdrop stop={walk.stop} /> : <CameraBackdrop onUnavailable={onSwitchVirtual} />}

      {stage !== "conv" && (
        <>
          <div className="exp-bar">
            <button className="icon-btn onphoto" onClick={onExit} aria-label="Back to home"><ArrowLeft size={20} /></button>
          </div>
          <div className="exp-badge">
            {mode === "virtual"
              ? <span className="badge sim">Virtual visit · simulated location</span>
              : <span className="badge live onphoto">{gps === "waiting" ? "Finding your position…" : "Live camera"}</span>}
          </div>
        </>
      )}

      {mode === "real" && gps === "denied" && (
        <div className="notice" role="alert">
          <p>Location is blocked, so guides cannot find you.</p>
          <button className="btn primary" onClick={onSwitchVirtual}>Take the virtual walk instead</button>
        </div>
      )}
      {error && <div className="notice" role="alert"><p>Could not load guides: {error}</p></div>}
      {loading && !agents.length && !error && <div className="notice"><p>Finding guides near you…</p></div>}

      {stage === "walk" && (
        <>
          {active && (
            <button className={`guide-chip${away ? " away" : ""}`} onClick={reopen}>
              <img src={faceSrc()} alt="" /> {away ? "Guide nearby" : "Open guide"} · {active.name}
            </button>
          )}
          {!active && !loading && agents.length > 0 && (
            <div className="hint">{mode === "virtual" ? "Press Next or Auto. A guide appears when you reach a spot." : "Walk towards a spot. Its guide appears when you arrive."}</div>
          )}
          {mode === "virtual" && walkBar("")}
        </>
      )}

      {stage === "arrival" && active && <Arrival agent={active} onMeet={meet} onClose={() => setStage("walk")} />}

      {stage === "conv" && active && (
        <section className="conv" aria-label={`Chat with ${active.name}`}>
          <div className="conv-photo" style={mode === "virtual" ? { backgroundImage: `url(${spotImage(active)})` } : undefined}>
            <div className="exp-bar">
              <button className="icon-btn onphoto" onClick={() => setStage("walk")} aria-label="Back to the map walk"><ArrowLeft size={20} /></button>
              {mode === "virtual"
                ? <span className="badge sim">Virtual visit · simulated location</span>
                : <span className="badge live onphoto">Live camera</span>}
            </div>
          </div>
          <div className="conv-low">
            <div className="conv-ident">
              <button
                type="button"
                className={`portrait${away ? " dim" : ""}${bigPortrait ? " big" : ""}${speaking ? " talking" : ""}`}
                onClick={() => setBigPortrait((v) => !v)}
                aria-label={bigPortrait ? "Shrink guide portrait" : "Enlarge guide portrait"}
                aria-pressed={bigPortrait}
              >
                <AvatarStage key={active.id} agent={active} speaking={speaking} mood={speaking ? "happy" : "neutral"} greet={1} text={sentence} />
              </button>
              <div className="ident-meta">
                <span className="id-pill">
                  <span className="t">{active.name} · Historian</span>
                  <span className={`wave${speaking ? " on" : ""}`} aria-hidden="true"><i /><i /><i /><i /></span>
                </span>
                <PriceBadge a={active} />
                <small>{active.price_yocto ? "First question free" : spotName(active)}</small>
              </div>
            </div>
            {mode === "virtual" && walkBar("inline")}
            {sess && (
              <div className="sess-bar">
                <span>Guided session active</span>
                <button className="btn primary sm" onClick={() => { setSessErr(null); releaseSession(sess.quote_id).catch((e) => setSessErr(String((e as Error).message ?? e))); }}>End session</button>
              </div>
            )}
            {sessErr && <div className="chat-error" role="alert">{sessErr}</div>}
            <ChatPanel
              agent={active}
              mock={mock}
              onPaymentRequired={setPaywall}
              unlockedTick={unlockedTick}
              suggestions={suggestionsFor(active)}
              onCamera={mode === "virtual" ? onSwitchReal : undefined}
            />
          </div>
        </section>
      )}

      {paywall && active && (
        <Paywall
          required={paywall.agent_id === active.id ? paywall : toPaymentRequired(active)}
          agentName={active.name}
          image={spotImage(active)}
          face={faceSrc()}
          spot={spotName(active)}
          onUnlocked={() => { setPaywall(null); setUnlockedTick((t) => t + 1); }}
          onClose={() => setPaywall(null)}
        />
      )}
    </div>
  );
}
