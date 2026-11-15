// Kite testnet x402 helpers (v2, scheme "exact", EIP-3009 transferWithAuthorization on pieUSD).
import { privateKeyToAccount } from "npm:viem@2.21.54/accounts";

export const CHAIN_ID = 2368;
export const NETWORK = "eip155:2368";
export const EXPLORER = "https://testnet.kitescan.ai/tx/";
export const ASSET = () => Deno.env.get("KITE_ASSET_ADDRESS") ?? "0x38129cf4CE5E183eFF248F42A7D345Bb1B47621A";
export const FACILITATOR = () => (Deno.env.get("KITE_FACILITATOR_URL") ?? "https://facilitator.pieverse.io/v2").replace(/\/$/, "");

export interface Requirements {
  scheme: "exact";
  network: string;
  asset: string;
  amount: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra: { name: string; version: string };
}

export function requirements(amountUnits: string): Requirements {
  const payTo = Deno.env.get("KITE_PAYTO_ADDRESS");
  if (!payTo) throw new Error("KITE_PAYTO_ADDRESS not configured");
  return {
    scheme: "exact", network: NETWORK, asset: ASSET(), amount: amountUnits, payTo,
    maxTimeoutSeconds: 300, extra: { name: "pieUSD", version: "1" },
  };
}

export const b64 = (o: unknown) => btoa(JSON.stringify(o));
export const unb64 = (s: string) => JSON.parse(atob(s));

export function randomNonce(): `0x${string}` {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return `0x${[...b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}

/** Sign an x402 v2 "exact" payment payload with the tour agent key. */
export async function signPayment(req: Requirements, resource: { url: string; description: string; mimeType: string }) {
  const pk = Deno.env.get("KITE_AGENT_PRIVATE_KEY");
  if (!pk) throw new Error("KITE_AGENT_PRIVATE_KEY not configured");
  const account = privateKeyToAccount((pk.startsWith("0x") ? pk : `0x${pk}`) as `0x${string}`);
  const now = Math.floor(Date.now() / 1000);
  const authorization = {
    from: account.address,
    to: req.payTo as `0x${string}`,
    value: BigInt(req.amount),
    validAfter: BigInt(now - 60),
    validBefore: BigInt(now + req.maxTimeoutSeconds),
    nonce: randomNonce(),
  };
  const signature = await account.signTypedData({
    domain: { name: req.extra.name, version: req.extra.version, chainId: CHAIN_ID, verifyingContract: req.asset as `0x${string}` },
    types: {
      TransferWithAuthorization: [
        { name: "from", type: "address" }, { name: "to", type: "address" },
        { name: "value", type: "uint256" }, { name: "validAfter", type: "uint256" },
        { name: "validBefore", type: "uint256" }, { name: "nonce", type: "bytes32" },
      ],
    },
    primaryType: "TransferWithAuthorization",
    message: authorization,
  });
  return {
    x402Version: 2,
    resource,
    accepted: req,
    payload: {
      signature,
      authorization: {
        from: authorization.from, to: authorization.to,
        value: authorization.value.toString(),
        validAfter: authorization.validAfter.toString(),
        validBefore: authorization.validBefore.toString(),
        nonce: authorization.nonce,
      },
    },
  };
}

async function facilitator(path: "verify" | "settle", paymentPayload: unknown, paymentRequirements: Requirements) {
  const r = await fetch(`${FACILITATOR()}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ x402Version: 2, paymentPayload, paymentRequirements }),
    signal: AbortSignal.timeout(60_000),
  });
  const text = await r.text();
  // deno-lint-ignore no-explicit-any
  let body: any; try { body = JSON.parse(text); } catch { body = { raw: text }; }
  return { ok: r.ok, status: r.status, body };
}
export const verifyPayment = (p: unknown, r: Requirements) => facilitator("verify", p, r);
export const settlePayment = (p: unknown, r: Requirements) => facilitator("settle", p, r);
