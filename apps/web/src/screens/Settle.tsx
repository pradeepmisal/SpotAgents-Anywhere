import { useState } from "react";
import { Check, Copy, ExternalLink, ArrowRight } from "lucide-react";
import { formatNear } from "../near";
import { explorerTx } from "../near/session";
import type { LocalEntry } from "../near/session";

const short = (h: string) => (h.length > 14 ? `${h.slice(0, 6)}…${h.slice(-6)}` : h);

export default function Settle({ entry, onDone }: { entry: LocalEntry; onDone: () => void }) {
  const [copied, setCopied] = useState(false);
  const hash = entry.release_tx ?? "";
  const copy = () => {
    navigator.clipboard?.writeText(hash).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1500); }).catch(() => {});
  };
  return (
    <div className="full settle" role="dialog" aria-modal="true" aria-label="Session completed">
      <div className="settle-top">
        <div className="settle-check"><Check size={44} strokeWidth={3} /></div>
        <h1>Session completed</h1>
        <p>Your payment has been settled on NEAR.</p>
      </div>
      <div className="box settle-box">
        <div className="kv"><span>Session</span><span>{entry.agent_name ?? entry.agent_id}</span></div>
        <div className="kv"><span>Amount settled</span><span>{formatNear(entry.amount_yocto)} NEAR</span></div>
        <div className="kv"><span>Status</span><span className="badge settled">Settled</span></div>
        {hash && (
          <div className="kv"><span>Tx hash</span>
            <span className="hash">{short(hash)}
              <button className="icon-btn sm" onClick={copy} aria-label="Copy transaction hash">{copied ? <Check size={14} /> : <Copy size={14} />}</button>
            </span>
          </div>
        )}
      </div>
      <div className="settle-actions">
        {hash && <a className="btn block" href={explorerTx(hash)} target="_blank" rel="noreferrer">View on NEAR Explorer <ExternalLink size={16} /></a>}
        <button className="btn primary block" onClick={onDone}>Explore more places <ArrowRight size={18} /></button>
      </div>
    </div>
  );
}
