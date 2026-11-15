import { useEffect, useState } from "react";
import { Bot, ExternalLink, MessageCircle, Sparkles, X, BookOpen } from "lucide-react";
import { agentPay, getBudget } from "../api";
import type { AgentPayResult, AgentSummary, BudgetView } from "../types";
import { unitsToUsd } from "../money";
import { Face } from "../parts";
import { BudgetMeter, PaymentStatus } from "./Wallet";

interface Props {
  agent: Pick<AgentSummary, "id" | "name" | "color" | "title" | "price_units" | "price_usd">;
  onUnlocked: () => void;
  onClose: () => void;
}

export default function Paywall({ agent, onUnlocked, onClose }: Props) {
  const [budget, setBudget] = useState<BudgetView | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AgentPayResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { getBudget().then(setBudget).catch((e: Error) => setErr(e.message)); }, []);

  const pay = async () => {
    setBusy(true); setErr(null);
    try { const r = await agentPay(agent.id); setResult(r); setBudget(r.budget); }
    catch (e) { setErr((e as Error).message); }
    setBusy(false);
  };

  const unlocked = result && (result.status === "settled" || result.status === "simulated");
  const over = budget ? BigInt(agent.price_units) > BigInt(budget.remaining_units) || BigInt(agent.price_units) > BigInt(budget.per_tx_cap_units) : false;

  return (
    <div className="pw-backdrop" role="dialog" aria-modal="true" aria-label="Go deeper">
      <div className="pw-sheet">
        <div className="pw-top" style={{ background: `linear-gradient(160deg, ${agent.color || "#1f8a4c"}, #14301f)` }}>
          <button type="button" className="pw-x" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </div>
        <div className="pw-body">
          <div className="pw-id">
            <Face a={agent} size={56} />
            <div><h2>Go deeper with {agent.name}</h2><small>{agent.title}</small></div>
          </div>
          <p className="pw-desc">Unlock a 30-minute premium session: more questions and the full stories behind the spot.</p>
          <ul className="pw-benefits">
            <li><BookOpen size={20} /> Full stories, not just titles</li>
            <li><Sparkles size={20} /> Deeper answers grounded in the creator's notes</li>
            <li><MessageCircle size={20} /> Unlimited questions for 30 minutes</li>
          </ul>
          <div className="pw-fee"><span>Price</span><strong>{unitsToUsd(agent.price_units)}</strong></div>

          <div className="box tour">
            <h2><Bot size={16} /> Your tour agent</h2>
            <p>A small budget your tour agent can spend for you, with a cap per purchase. You approve nothing per tap; it refuses anything above the cap.</p>
            {budget ? <BudgetMeter b={budget} /> : !err && <p>Loading budget…</p>}
          </div>

          {!result && (
            <>
              <button type="button" className="primary" disabled={busy || over || !budget} onClick={() => void pay()}>
                {busy ? "Your tour agent is paying…" : "Let my tour agent pay"}
              </button>
              {over && <p className="pw-state err">This is above your tour agent's remaining budget or per-purchase cap.</p>}
            </>
          )}

          {result && (
            <div className={`pw-state ${unlocked ? "ok" : "err"}`} role="status">
              {result.status === "settled" && <p><strong>Payment settled on Kite testnet.</strong></p>}
              {result.status === "simulated" && <p><strong>Simulated payment (Kite testnet unavailable).</strong> No funds moved. Premium is unlocked so you can continue.</p>}
              {result.status === "refused" && <p><strong>Your tour agent refused.</strong> {result.reason}</p>}
              {result.status === "failed" && <p><strong>Payment failed.</strong> {result.reason}</p>}
              {result.payment && <PaymentStatus p={result.payment} />}
              {result.payment?.explorer_url && result.payment.tx_hash && (
                <a href={result.payment.explorer_url} target="_blank" rel="noreferrer">View on Kitescan <ExternalLink size={13} /></a>
              )}
              {unlocked
                ? <button type="button" className="primary" onClick={onUnlocked}>Continue the conversation</button>
                : <button type="button" onClick={onClose}>Close</button>}
            </div>
          )}
          {err && <p className="pw-state err" role="alert">{err}</p>}
        </div>
      </div>
    </div>
  );
}
