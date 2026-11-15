import { useEffect, useRef, useState } from "react";
import type { PaymentRequired, Quote, VerifyResult } from "../types";
import { clearPendingQuote, fetchQuote, formatNear, payQuote, verifyQuote } from "./payQuote";
import { AccountChip, connect, accountId } from "./wallet";
import { startSession } from "./session";
import { SessionBar } from "./WalletUi";
import { BookOpen, MessageCircle, ShieldCheck, Sparkles, X } from "lucide-react";
import "./paywall.css";

type Phase = "loading" | "ready" | "signing" | "confirming" | "paid" | "error";

interface Props {
  required: PaymentRequired;
  agentName?: string;
  /** Display only: place photo, guide face and spot name for the Go Deeper screen. */
  image?: string;
  face?: string;
  spot?: string;
  onUnlocked: (r: VerifyResult) => void;
  onClose: () => void;
  /** Test hook: supply a mocked quote instead of calling near-pay/quote. */
  quoteOverride?: Quote;
}

const POLL_MS = 2000;
const POLL_MAX_MS = 60_000;

export default function Paywall({ required, agentName, image, face, spot, onUnlocked, onClose, quoteOverride }: Props) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  useEffect(() => {
    if (quoteOverride) { setQuote(quoteOverride); setPhase("ready"); return; }
    fetchQuote(required.agent_id)
      .then((q) => { if (alive.current) { setQuote(q); setPhase("ready"); } })
      .catch((e) => { if (alive.current) { setError(String(e.message ?? e)); setPhase("error"); } });
  }, [required.agent_id, quoteOverride]);

  async function poll(q: Quote, tx_hash?: string) {
    setPhase("confirming");
    const end = Date.now() + POLL_MAX_MS;
    while (alive.current && Date.now() < end) {
      try {
        const r = await verifyQuote({ quote_id: q.quote_id, tx_hash });
        if (!alive.current) return;
        if (r.status === "paid") { clearPendingQuote(); setResult(r); setPhase("paid"); onUnlocked(r); return; }
        if (r.status === "invalid" || r.status === "expired") {
          clearPendingQuote();
          setError(r.status === "expired" ? "The quote expired. Close this and try again." : `Payment invalid${r.reason ? `: ${r.reason}` : ""}`);
          setPhase("error");
          return;
        }
      } catch (e) {
        if (!alive.current) return;
        setError(String((e as Error).message ?? e)); setPhase("error"); return;
      }
      await new Promise((r) => setTimeout(r, POLL_MS));
    }
    if (alive.current) { setError("Still waiting for confirmation. Check the wallet, then reopen this agent."); setPhase("error"); }
  }

  async function startGuided() {
    if (!quote) return;
    setError(null);
    try {
      if (!accountId()) await connect();
      setPhase("signing");
      const { tx_hash } = await startSession(quote, accountId(), agentName);
      await poll(quote, tx_hash);
    } catch (e) {
      if (!alive.current) return;
      setError(String((e as Error).message ?? e)); setPhase("error");
    }
  }

  async function pay() {
    if (!quote) return;
    setError(null);
    try {
      if (!accountId()) await connect();
      setPhase("signing");
      const { tx_hash } = await payQuote(quote);
      await poll(quote, tx_hash);
    } catch (e) {
      if (!alive.current) return;
      setError(String((e as Error).message ?? e)); setPhase("error");
    }
  }

  const fee = formatNear(quote?.amount_yocto ?? required.price_yocto);
  return (
    <div className="pw-backdrop" role="dialog" aria-modal="true" aria-label="Go deeper">
      <div className="pw-sheet">
        <div className="pw-photo" style={image ? { backgroundImage: `url(${image})` } : undefined}>
          <button type="button" className="pw-x" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </div>
        <div className="pw-body">
          <div className="pw-id">
            {face && <img src={face} alt="" />}
            <div>
              <h2>Go deeper with {agentName ?? "this guide"}</h2>
              <small>{spot ? `${spot} · Historian` : "Historian"}</small>
            </div>
          </div>
          <p className="pw-desc">Unlock a guided session with richer stories, rare facts and answers to all your questions.</p>
          <ul className="pw-benefits">
            <li><BookOpen size={20} /> Deeper historical context</li>
            <li><Sparkles size={20} /> Rare facts and local anecdotes</li>
            <li><MessageCircle size={20} /> More questions for 30 minutes</li>
          </ul>
          <div className="pw-fee"><span>Session fee</span><strong>{fee} NEAR</strong></div>
          <p className="pw-note"><ShieldCheck size={18} /> Held by the SpotAgents contract on NEAR until you end the session · 95% to the guide's creator</p>
          <AccountChip />

          {phase === "loading" && <p className="pw-state">Getting a quote…</p>}
          {phase === "ready" && (
            <>
              <button type="button" className="primary" onClick={() => void startGuided()}>Start paid session</button>
              <button type="button" className="pw-link" onClick={() => void pay()}>Or pay now with NEAR</button>
            </>
          )}
          {phase === "signing" && <p className="pw-state">Approve the payment in your wallet…</p>}
          {phase === "confirming" && <p className="pw-state">Pending: confirming on chain…</p>}
          {phase === "paid" && (
            <div className="pw-state ok">
              <p>Unlocked. Payment confirmed.</p>
              {quote && <SessionBar quoteId={quote.quote_id} />}
              {result?.explorer_url && <a href={result.explorer_url} target="_blank" rel="noreferrer">View on explorer</a>}
              <button type="button" className="primary" onClick={onClose}>Continue</button>
            </div>
          )}
          {phase === "error" && (
            <div className="pw-state err" role="alert">
              <p>{error}</p>
              {quote && <button type="button" onClick={() => void pay()}>Try again</button>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
