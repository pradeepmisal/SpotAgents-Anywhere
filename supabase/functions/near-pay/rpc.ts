// Raw JSON-RPC helpers for NEAR (no SDK).

function rpcUrl(): string {
  return Deno.env.get("NEAR_RPC_URL") ?? "https://test.rpc.fastnear.com";
}

// deno-lint-ignore no-explicit-any
async function rpc(params: Record<string, unknown>): Promise<any> {
  const res = await fetch(rpcUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: "dontcare", method: "query", params }),
  });
  if (!res.ok) throw new Error(`NEAR RPC HTTP ${res.status}`);
  return await res.json();
}

/** true if the account exists, false if the RPC says it does not. Throws on any other failure. */
export async function accountExists(accountId: string): Promise<boolean> {
  const body = await rpc({ request_type: "view_account", finality: "final", account_id: accountId });
  if (body.result && !body.error && !body.result.error) return true;
  const msg = JSON.stringify(body.error ?? body.result?.error ?? "");
  if (/UNKNOWN_ACCOUNT|does not exist/i.test(msg)) return false;
  throw new Error(`NEAR RPC view_account failed: ${msg}`);
}

/** Calls a contract view method and returns the parsed JSON result (null if the contract returns null). */
export async function callView<T = unknown>(contractId: string, method: string, args: unknown): Promise<T> {
  const args_base64 = btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(args))));
  const body = await rpc({
    request_type: "call_function",
    finality: "final",
    account_id: contractId,
    method_name: method,
    args_base64,
  });
  if (body.error || body.result?.error) {
    throw new Error(`NEAR RPC ${method} failed: ${JSON.stringify(body.error ?? body.result.error)}`);
  }
  const bytes: number[] = body.result?.result;
  if (!Array.isArray(bytes)) throw new Error(`NEAR RPC ${method}: no result`);
  return JSON.parse(new TextDecoder().decode(new Uint8Array(bytes))) as T;
}
