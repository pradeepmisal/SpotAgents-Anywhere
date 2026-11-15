import { useEffect, useRef, useState } from "react";
import { Camera, Keyboard, Mic, Volume2, VolumeX } from "lucide-react";
import type { NearbyAgent, PaymentRequired } from "../types";
import { useChat, useSpokenSentence } from "./useChat";
import { canListen, canSpeak, listen, stopSpeaking } from "./voice";
import type { Listener } from "./voice";
import { MOCK_LABEL } from "./mockStream";
import "./chat.css";

interface Props {
  agent: NearbyAgent;
  mock: boolean;
  /** near-pay plugs in here; called on HTTP 402. */
  onPaymentRequired?: (p: PaymentRequired) => void;
  /** Parent increments this after the paywall confirms an unlock; the kept message is re-sent. */
  unlockedTick?: number;
  suggestions?: string[];
  /** Switch to live-camera mode; the camera button is hidden when absent. */
  onCamera?: () => void;
}

/** Guide bubble text with the sentence being spoken right now highlighted (live caption). */
function Said({ text, sentence }: { text: string; sentence: string }) {
  const s = sentence.trim();
  const i = s ? text.indexOf(s) : -1;
  if (i < 0) return <>{text}</>;
  return <>{text.slice(0, i)}<mark>{s}</mark>{text.slice(i + s.length)}</>;
}

export default function ChatPanel({ agent, mock, onPaymentRequired, unlockedTick = 0, suggestions = [], onCamera }: Props) {
  const [speakOn, setSpeakOn] = useState(true);
  const [text, setText] = useState("");
  const [micErr, setMicErr] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [kb, setKb] = useState(false);
  const { messages, status, premium, error, send, retry } = useChat({ agent, mock, onPaymentRequired, speakReplies: speakOn });
  const sentence = useSpokenSentence();
  const lst = useRef<Listener | null>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => { end.current?.scrollIntoView({ block: "nearest" }); }, [messages]);

  const lastTick = useRef(unlockedTick);
  useEffect(() => {
    if (unlockedTick !== lastTick.current) { lastTick.current = unlockedTick; retry(); }
  }, [unlockedTick, retry]);

  function startMic() {
    if (lst.current) return;
    stopSpeaking(); setMicErr(null);
    lst.current = listen((t) => send(t), setMicErr);
    setListening(Boolean(lst.current));
  }
  function stopMic() {
    lst.current?.stop(); lst.current = null; setListening(false);
  }

  const busy = status === "streaming";
  const mic = canListen();
  const showInput = kb || !mic;
  const lastAssistant = (() => { for (let i = messages.length - 1; i >= 0; i--) if (messages[i].role === "assistant") return i; return -1; })();
  return (
    <div className="chat">
      {mock && <div className="chat-mock">{MOCK_LABEL}</div>}
      {premium && <div className="chat-premium">Premium unlocked</div>}
      <div className="chat-log" aria-live="polite">
        {messages.length === 0 && <p className="bubble assistant"><span className="bt"><Said text={agent.greeting} sentence={sentence} /></span></p>}
        {messages.map((m, i) => (
          <p key={i} className={`bubble ${m.role}`}>
            <span className="bt">{m.role === "assistant" && i === lastAssistant ? <Said text={m.content} sentence={sentence} /> : m.content}</span>
          </p>
        ))}
        {busy && messages[messages.length - 1]?.role === "user" && <p className="bubble assistant">…</p>}
        <div ref={end} />
      </div>
      {error && <div className="chat-error" role="alert">{error}</div>}
      {status === "locked" && (
        <div className="chat-error" role="status">
          <span>This guide is locked. Unlock it to continue. Your message is kept.</span>
          <button type="button" onClick={retry}>Retry</button>
        </div>
      )}
      {micErr && <div className="chat-error" role="alert">{micErr}</div>}
      {suggestions.length > 0 && (
        <div className="suggest">
          {suggestions.map((s) => <button key={s} type="button" disabled={busy} onClick={() => send(s)}>{s}</button>)}
        </div>
      )}
      {showInput && (
        <form className="chat-input" onSubmit={(e) => { e.preventDefault(); send(text); setText(""); }}>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message" aria-label="Message" disabled={busy} />
          <button type="submit" className="btn primary sm" disabled={busy || !text.trim()}>Send</button>
        </form>
      )}
      <div className="controls">
        {mic && (
          <button type="button" className="ctl" aria-pressed={kb} aria-label="Type instead" onClick={() => setKb(!kb)}><Keyboard size={22} /></button>
        )}
        {canSpeak() && (
          <button type="button" className="ctl" aria-pressed={speakOn} aria-label="Speak replies" onClick={() => { setSpeakOn(!speakOn); stopSpeaking(); }}>
            {speakOn ? <Volume2 size={22} /> : <VolumeX size={22} />}
          </button>
        )}
        {mic && (
          <button
            type="button"
            className={`mic${listening ? " on" : ""}`}
            aria-label="Hold to talk"
            disabled={busy}
            onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); startMic(); }}
            onPointerUp={stopMic}
            onPointerCancel={stopMic}
            onContextMenu={(e) => e.preventDefault()}
          ><Mic size={30} /></button>
        )}
        {onCamera && <button type="button" className="ctl" aria-label="Switch to live camera" onClick={onCamera}><Camera size={22} /></button>}
      </div>
    </div>
  );
}
