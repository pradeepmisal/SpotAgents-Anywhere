import { useEffect, useState } from "react";
import { Wallet, Droplets, Link2, LogOut, History } from "lucide-react";
import { connect, disconnect, fetchBalance, formatNear, useAccountId } from "../near";
import { explorerTx, releaseSession, useHistory } from "../near/session";

function useBalance(id: string | null): string | null {
  const [bal, setBal] = useState<string | null>(null);
  useEffect(() => {
    setBal(null);
    if (!id) return;
    let live = true;
    fetchBalance(id).then((b) => { if (live) setBal(b); }).catch(() => { if (live) setBal(null); });
    return () => { live = false; };
  }, [id]);
  return bal;
}

const STATUS: Record<string, string> = { active: "Active", released: "Settled", paid: "Paid" };

export default function WalletScreen() {
  const id = useAccountId();
  const bal = useBalance(id);
  const history = useHistory();
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const end = async (q: string) => {
    setBusy(q); setErr(null);
    try { await releaseSession(q); } catch (e) { setErr(String((e as Error).message ?? e)); }
    setBusy(null);
  };
  return (
    <>
      <div className="pagehead"><h1>My Wallet</h1></div>
      <div className="wcard">
        <div className="top"><span>NEAR Wallet</span><span className="badge">Testnet</span></div>
        <div className="bal">{id ? (bal !== null ? formatNear(bal, 3) : "…") : "N/A"} <small>NEAR</small></div>
        <div className="acc">{id ?? "Not connected"}</div>
      </div>
      <div className="wactions">
        <a className="btn primary" href="https://near-faucet.io" target="_blank" rel="noreferrer"><Droplets size={18} /> Get testnet NEAR</a>
        {id
          ? <button className="btn" onClick={() => void disconnect()}><LogOut size={18} /> Disconnect</button>
          : <button className="btn" onClick={() => { setErr(null); connect().catch((e) => setErr(String(e?.message ?? e))); }}><Link2 size={18} /> Connect</button>}
      </div>
      {err && <p className="err-text" role="alert">{err}</p>}
      <div className="sec-h"><h2>Recent activity</h2></div>
      <div className="list-pad">
        {history.length === 0 && <p className="empty">No sessions yet. Paid guided sessions from this browser appear here.</p>}
        {history.map((h) => (
          <div className="act" key={h.quote_id}>
            <span className="ic"><History size={18} /></span>
            <span><strong>{h.agent_name ?? h.agent_id}</strong><small>AI session · {new Date(h.at).toLocaleDateString()}</small></span>
            <span className="amt">{formatNear(h.amount_yocto)} NEAR<span className={`badge ${h.status === "active" ? "active" : "settled"}`}>{STATUS[h.status] ?? h.status}</span></span>
            <span className="links">
              {h.start_tx && <a href={explorerTx(h.start_tx)} target="_blank" rel="noreferrer">Start tx</a>}
              {h.release_tx && <a href={explorerTx(h.release_tx)} target="_blank" rel="noreferrer">Release tx</a>}
              {h.status === "active" && <button className="btn primary sm" disabled={busy === h.quote_id} onClick={() => void end(h.quote_id)}>End &amp; pay guide</button>}
            </span>
          </div>
        ))}
      </div>
      <p className="empty" style={{ background: "none" }}><Wallet size={14} /> Testnet only. No real funds.</p>
    </>
  );
}
