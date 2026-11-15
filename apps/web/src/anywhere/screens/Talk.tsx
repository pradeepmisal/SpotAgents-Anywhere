import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import AvatarStage from "../../avatar/AvatarStage";
import ChatPanel from "../../chat/ChatPanel";
import { useSpeaking, useSpokenSentence } from "../../chat/useChat";
import { speak, stopSpeaking } from "../../chat/voice";
import type { AgentDetail, PaymentRequired } from "../types";
import { MOCK } from "../api";
import { haversineM } from "../geo";
import type { LatLng } from "../geo";
import { unitsToUsd } from "../money";
import { isVirtual } from "../parts";
import Paywall from "./Paywall";

interface Props { agent: AgentDetail; from: LatLng; onBack: () => void }

export default function Talk({ agent, from, onBack }: Props) {
  const speaking = useSpeaking();
  const sentence = useSpokenSentence();
  const [paywall, setPaywall] = useState<PaymentRequired | null>(null);
  const [tick, setTick] = useState(0);
  const [big, setBig] = useState(false);
  const virtual = isVirtual({ distance_m: haversineM(from, agent), radius_m: agent.radius_m });

  useEffect(() => {
    const t = window.setTimeout(() => speak(agent.greeting, null), 250); // entered via a tap, so speech is allowed
    return () => { window.clearTimeout(t); stopSpeaking(); };
  }, [agent]);

  useEffect(() => {
    const t = window.setTimeout(() => window.dispatchEvent(new Event("resize")), 380);
    return () => window.clearTimeout(t);
  }, [big]);

  return (
    <div className="experience talk">
      <div className="talk-bg" style={{ background: `linear-gradient(170deg, ${agent.color || "#1f8a4c"} 0%, #14301f 85%)` }}>
        <span className="talk-place">{agent.place_name || agent.city}</span>
      </div>
      <section className="conv" aria-label={`Talk to ${agent.name}`}>
        <div className="conv-photo">
          <div className="exp-bar">
            <button className="icon-btn onphoto" onClick={onBack} aria-label="Back to the agent page"><ArrowLeft size={20} /></button>
            {virtual
              ? <span className="badge sim">Virtual visit · you are not at this spot</span>
              : <span className="badge live onphoto">You are at this spot</span>}
          </div>
        </div>
        <div className="conv-low">
          <div className="conv-ident">
            <button type="button" className={`portrait${big ? " big" : ""}${speaking ? " talking" : ""}`} onClick={() => setBig((v) => !v)} aria-label={big ? "Shrink portrait" : "Enlarge portrait"} aria-pressed={big}>
              <AvatarStage key={agent.id} agent={agent} speaking={speaking} mood={speaking ? "happy" : "neutral"} greet={1} text={sentence} />
            </button>
            <div className="ident-meta">
              <span className="id-pill">
                <span className="t">{agent.name} · {agent.title}</span>
                <span className={`wave${speaking ? " on" : ""}`} aria-hidden="true"><i /><i /><i /><i /></span>
              </span>
              <small>First question free · then {unitsToUsd(agent.price_units)}</small>
            </div>
          </div>
          <ChatPanel agent={agent} mock={MOCK} onPaymentRequired={setPaywall} unlockedTick={tick} suggestions={agent.suggested_questions.slice(0, 3)} />
        </div>
      </section>
      {paywall && <Paywall agent={agent} onUnlocked={() => { setPaywall(null); setTick((t) => t + 1); }} onClose={() => setPaywall(null)} />}
    </div>
  );
}
