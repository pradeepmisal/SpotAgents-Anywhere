import { useEffect, useState } from "react";
import type { ComponentType } from "react";

type Near = {
  WalletChip?: ComponentType;
  connect?: () => Promise<string | null>;
  useAccountId?: () => string | null;
};

/**
 * Header wallet area. Uses `WalletChip` from ../near when builder-near has shipped it,
 * otherwise falls back to a minimal "Connect wallet" button using the near connect function.
 */
export default function WalletSlot() {
  const [near, setNear] = useState<Near | null>(null);
  useEffect(() => {
    let alive = true;
    import("../near").then((m) => alive && setNear(m as unknown as Near)).catch(() => alive && setNear({}));
    return () => { alive = false; };
  }, []);
  if (!near) return <span className="wallet-slot" aria-hidden="true" />;
  if (near.WalletChip) {
    const Chip = near.WalletChip;
    return <span className="wallet-slot"><Chip /></span>;
  }
  return <span className="wallet-slot"><Fallback near={near} /></span>;
}

function Fallback({ near }: { near: Near }) {
  const [err, setErr] = useState<string | null>(null);
  // The module's exports are fixed once loaded, so this hook call is stable across renders.
  const id = near.useAccountId ? near.useAccountId() : null;
  return (
    <>
      <button
        type="button"
        className="btn wallet-btn"
        disabled={!near.connect}
        onClick={() => { setErr(null); near.connect?.().catch((e) => setErr(String(e?.message ?? e))); }}
      >
        <span className="wallet-dot" aria-hidden="true" />
        {id ?? "Connect wallet"}
      </button>
      {err && <small role="alert" className="wallet-err">{err}</small>}
    </>
  );
}
