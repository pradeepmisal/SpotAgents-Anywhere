import { useEffect, useState } from "react";
import { formatNear } from "./payQuote";
import { explorerTx, fetchBalance, releaseSession, useHistory } from "./session";
import { connect, disconnect, useAccountId } from "./wallet";
import "./paywall.css";

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

/** Header chip: connect button, or account + testnet balance. Tap opens the panel. */
export function WalletChip() {
  const id = useAccountId();
  const bal = useBalance(id);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!id) {
    return (
      <span className="near-chip">
        <button type="button" onClick={() => { setErr(null); connect().catch((e) => setErr(String(e?.message ?? e))); }}>
          Connect wallet
        </button>
        {err && <small role="alert">{err}</small>}
      </span>
    );
  }
  return (
    <span className="near-chip">
      <button type="button" onClick={() => setOpen(true)} aria-label="Open wallet">
        {id}{bal !== null ? ` · ${formatNear(bal, 2)} NEAR` : ""}
      </button>
      {open && <WalletPanel onClose={() => setOpen(false)} />}
    </span>
  );
}

export function WalletPanel({ onClose }: { onClose: () => void }) {
  const id = useAccountId();
  const bal = useBalance(id);
  const history = useHistory();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const end = async (q: string) => {
    setBusy(q); setErr(null);
    try { await releaseSession(q); } catch (e) { setErr(String((e as Error).message ?? e)); }
    setBusy(null);
  };
  return (
    <div className="pw-backdrop" role="dialog" aria-modal="true" aria-label="Wallet">
      <div className="pw-sheet">
        <div className="pw-head">
          <strong>Wallet <span className="wl-badge">Testnet</span></strong>
          <button type="button" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <p className="pw-note">{id ?? "Not connected"}</p>
        {id && <p className="pw-price">{bal !== null ? formatNear(bal, 3) : "…"} <span>NEAR</span></p>}
        <h4 className="wl-h">Sessions and payments (this browser)</h4>
        {history.length === 0 && <p className="pw-note">Nothing yet.</p>}
        <ul className="wl-list">
          {history.map((h) => (
            <li key={h.quote_id}>
              <span>{h.agent_name ?? h.agent_id} · {formatNear(h.amount_yocto)} NEAR · <b>{h.status}</b></span>
              {h.start_tx && <a href={explorerTx(h.start_tx)} target="_blank" rel="noreferrer">start tx</a>}
              {h.release_tx && <a href={explorerTx(h.release_tx)} target="_blank" rel="noreferrer">release tx</a>}
              {h.status === "active" && (
                <button type="button" disabled={busy === h.quote_id} onClick={() => void end(h.quote_id)}>End &amp; pay guide</button>
              )}
            </li>
          ))}
        </ul>
        {err && <p className="pw-state err" role="alert">{err}</p>}
        {id && <button type="button" onClick={() => { void disconnect(); onClose(); }}>Disconnect</button>}
      </div>
    </div>
  );
}

/** Bar shown while a guided session is active; ends it and pays the guide. */
export function SessionBar({ quoteId }: { quoteId: string }) {
  const entry = useHistory().find((h) => h.quote_id === quoteId);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!entry) return null;
  if (entry.status === "released") {
    return (
      <div className="pw-sessionbar">
        <span>Guide paid ✓</span>
        {entry.release_tx && <a href={explorerTx(entry.release_tx)} target="_blank" rel="noreferrer">View on explorer</a>}
      </div>
    );
  }
  if (entry.status !== "active") return null;
  return (
    <div className="pw-sessionbar">
      <span>Guided session active</span>
      <button type="button" disabled={busy} onClick={() => {
        setBusy(true); setErr(null);
        releaseSession(quoteId).catch((e) => setErr(String((e as Error).message ?? e))).finally(() => setBusy(false));
      }}>End &amp; pay guide</button>
      {err && <small role="alert">{err}</small>}
    </div>
  );
}
