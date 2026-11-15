import { useEffect, useState } from "react";
import { History, Wallet as WalletIcon } from "lucide-react";
import { getBudget } from "../api";
import type { BudgetView, PaymentView } from "../types";
import { pct, unitsToUsd } from "../money";

export function BudgetMeter({ b }: { b: BudgetView }) {
  const spent = pct(b.spent_units, b.budget_units);
  return (
    <div className="meter" aria-label="Tour agent budget">
      <div className="meter-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(spent)}><i style={{ width: `${spent}%` }} /></div>
      <div className="meter-row"><span>{unitsToUsd(b.remaining_units)} left of {unitsToUsd(b.budget_units)}</span><span>cap {unitsToUsd(b.per_tx_cap_units)} per purchase</span></div>
    </div>
  );
}

export function PaymentStatus({ p }: { p: PaymentView }) {
  if (p.status === "settled") return <span className="badge settled">Settled on Kite testnet</span>;
  if (p.status === "simulated") return <span className="badge sim-label">Simulated payment (Kite testnet unavailable)</span>;
  return <span className="badge rej">Failed{p.error ? `: ${p.error}` : ""}</span>;
}

export default function Wallet() {
  const [b, setB] = useState<BudgetView | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { getBudget().then(setB).catch((e: Error) => setErr(e.message)); }, []);

  return (
    <>
      <div className="pagehead"><h1>Wallet</h1><p>Your tour agent pays for premium sessions within a budget you control.</p></div>
      <div className="wcard">
        <div className="top"><span>Tour agent budget</span><span className="badge">Kite testnet · pieUSD</span></div>
        <div className="bal">{b ? unitsToUsd(b.remaining_units) : "…"} <small>left</small></div>
        <div className="acc">{b ? `of ${unitsToUsd(b.budget_units)} · cap ${unitsToUsd(b.per_tx_cap_units)} per purchase · expires ${new Date(b.expires_at).toLocaleString()}` : "Loading…"}</div>
      </div>
      {b && <div className="list-pad" style={{ marginTop: 12 }}><BudgetMeter b={b} /></div>}
      {err && <p className="err-text" role="alert">{err}</p>}
      <div className="sec-h"><h2>Payments</h2></div>
      <div className="list-pad">
        {b && b.payments.length === 0 && <p className="empty">No payments yet. When you unlock a premium session, it shows up here.</p>}
        {b?.payments.map((p) => (
          <div className="act" key={p.id}>
            <span className="ic"><History size={18} /></span>
            <span><strong>{p.agent_name}</strong><small>{new Date(p.created_at).toLocaleString()}</small></span>
            <span className="amt">{unitsToUsd(p.amount_units)}<PaymentStatus p={p} /></span>
            {p.tx_hash && p.explorer_url && <span className="links"><a href={p.explorer_url} target="_blank" rel="noreferrer">View on Kitescan</a></span>}
          </div>
        ))}
      </div>
      <p className="empty" style={{ background: "none" }}><WalletIcon size={14} /> Testnet only. No real funds. A payment without a transaction on Kitescan is always labelled simulated.</p>
    </>
  );
}
