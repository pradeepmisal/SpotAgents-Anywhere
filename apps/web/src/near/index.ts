import type { NearbyAgent, PaymentRequired } from "../types";
export { default as Paywall } from "./Paywall";
export { AccountChip, connect, disconnect, accountId, useAccountId } from "./wallet";
export { WalletChip, WalletPanel, SessionBar } from "./WalletUi";
export { startSession, releaseSession, fetchBalance } from "./session";
export { payQuote, fetchQuote, verifyQuote, formatNear, setAuthTokenGetter, CONTRACT_ID } from "./payQuote";

/**
 * Integration: keep `const [paywall, setPaywall] = useState<NearbyAgent | null>(null)`, pass
 * `onPaymentRequired={(a) => setPaywall(a)}` to NearbyList and render
 * `<Paywall required={toPaymentRequired(paywall)} onUnlocked={...} onClose={...} />`.
 */
export function toPaymentRequired(a: NearbyAgent): PaymentRequired {
  return { error: "payment_required", agent_id: a.id, price_yocto: a.price_yocto ?? "0" };
}
