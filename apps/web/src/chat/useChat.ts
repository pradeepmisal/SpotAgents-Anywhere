import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ChatEvent, ChatMessage, ChatRequest, NearbyAgent, PaymentRequired } from "../types";
import { accessToken } from "../supabase";
import { mockStream } from "./mockStream";
import { getSpokenSentence, isSpeaking, sentenceSpeaker, stopSpeaking, subscribeSpeaking } from "./voice";

/** True while any speechSynthesis utterance (greeting or reply) is queued or playing. */
export function useSpeaking(): boolean {
  return useSyncExternalStore(subscribeSpeaking, isSpeaking);
}

/** The sentence currently being spoken ("" when silent); drives live captions and lip-sync. */
export function useSpokenSentence(): string {
  return useSyncExternalStore(subscribeSpeaking, getSpokenSentence);
}

export type ChatStatus = "idle" | "streaming" | "locked" | "error";

interface Options {
  agent: NearbyAgent;
  mock: boolean;
  /** Supplied by near-pay: called on HTTP 402. */
  onPaymentRequired?: (p: PaymentRequired) => void;
  speakReplies: boolean;
}

/** Parse an SSE body into raw `data:` payload strings. */
async function* sseData(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    buf = buf.replace(/\r\n/g, "\n");
    let i: number;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const block = buf.slice(0, i);
      buf = buf.slice(i + 2);
      const data = block.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trimStart()).join("\n");
      if (data) yield data;
    }
  }
}

export function useChat({ agent, mock, onPaymentRequired, speakReplies }: Options) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<ChatStatus>("idle");
  const [premium, setPremium] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const msgsRef = useRef<ChatMessage[]>([]);
  const busy = useRef(false);
  const speakRef = useRef(speakReplies);
  speakRef.current = speakReplies;
  const payRef = useRef(onPaymentRequired);
  payRef.current = onPaymentRequired;

  const commit = (m: ChatMessage[]) => { msgsRef.current = m; setMessages(m); };

  // reset when switching agent
  useEffect(() => {
    stopSpeaking();
    commit([]); setStatus("idle"); setPremium(false); setError(null); busy.current = false;
    return stopSpeaking;
  }, [agent.id]);

  const run = useCallback(async (history: ChatMessage[]) => {
    busy.current = true;
    setStatus("streaming"); setError(null);
    const speaker = sentenceSpeaker(agent.voice);
    let reply = "";
    let outcome: ChatStatus = "idle";
    try {
      let events: AsyncGenerator<string>;
      if (mock) {
        events = mockStream(agent, history[history.length - 1].content, history.filter((m) => m.role === "user").length);
      } else {
        const token = await accessToken();
        const req: ChatRequest = {
          agent_id: agent.id,
          messages: history,
          client: { now: new Date().toISOString(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone },
        };
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token ?? import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
          },
          body: JSON.stringify(req),
        });
        if (res.status === 402) {
          const body = (await res.json()) as PaymentRequired;
          throw Object.assign(new Error("payment_required"), { status: 402, body });
        }
        if (!res.ok || !res.body) {
          const j = await res.json().catch(() => ({}));
          throw new Error((j as { error?: string }).error ?? `Chat failed (HTTP ${res.status})`);
        }
        events = sseData(res.body);
      }

      let started = false;
      for await (const data of events) {
        if (data === "[DONE]") break;
        let ev: ChatEvent;
        try { ev = JSON.parse(data) as ChatEvent; } catch { continue; }
        if ("premium" in ev) setPremium(ev.premium);
        else if ("error" in ev) { setError(ev.error); outcome = "error"; }
        else if ("text" in ev) {
          reply += ev.text;
          if (speakRef.current) speaker.push(ev.text);
          const base = started ? msgsRef.current.slice(0, -1) : msgsRef.current;
          started = true;
          commit([...base, { role: "assistant", content: reply }]);
        }
      }
      if (speakRef.current) speaker.flush();
    } catch (e) {
      const err = e as Error & { status?: number; body?: PaymentRequired };
      if (err.status === 402) {
        outcome = "locked";
        const p: PaymentRequired = err.body ?? { error: "payment_required", agent_id: agent.id, price_yocto: agent.price_yocto ?? "0" };
        payRef.current?.(p);
      } else {
        setError(err.message || "Chat failed");
        outcome = "error";
      }
    } finally {
      busy.current = false;
      setStatus(outcome);
    }
  }, [agent, mock]);

  const send = useCallback((text: string) => {
    const t = text.trim();
    if (!t || busy.current) return;
    stopSpeaking();
    const history = [...msgsRef.current, { role: "user" as const, content: t }];
    commit(history);
    void run(history);
  }, [run]);

  /** Re-send the kept user message, e.g. after the paywall reports unlocked. */
  const retry = useCallback(() => {
    const h = msgsRef.current;
    if (busy.current || !h.length || h[h.length - 1].role !== "user") return;
    void run(h);
  }, [run]);

  const speaking = useSpeaking();
  return { messages, status, premium, error, send, retry, speaking };
}
