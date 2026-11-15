# SPEC: near-pay

Status: Approved (2026-11-14) · Owner: builder-near · Contracts: `near-contract.md`, `db.sql` Part 2, `api.md` §3–5 · ADR-002 to ADR-006

## Objective
A user unlocks a paid agent with a real NEAR testnet payment through the `spot_pay` contract. The creator gets 95% instantly and the platform 5%, and the backend confirms the payment on chain before unlocking.

## Scope
1. **Contract** (`contract/`): implement `near-contract.md` with all 5 required tests. Built with `cargo near build` in WSL. Deploying waits for the human's yes.
2. **Functions** (`supabase/functions/near-pay/`): `quote` and `verify` per `api.md`, plus migration `0002_payments.sql` from `db.sql` Part 2. Use raw JSON-RPC `fetch` (no heavy SDK in Deno) unless the docs show a better option.
3. **Web** (`apps/web/src/near/`): wallet connect, account chip, `payQuote`, and a paywall sheet that shows the price, a "95% to creator · 5% platform" note, Pay, a pending state, and success with an explorer link. After the wallet returns, poll `verify` every 2 s for up to 60 s.
4. **Setup notes** in `docs/SETUP.md`: WSL Rust install, `cargo-near` install, testnet account creation, deploy and `new` commands.

## Out of scope
Mainnet, refunds, creator dashboards, withdrawals, fungible tokens.

## Acceptance criteria
1. `cargo test` passes all 5 contract tests in WSL.
2. On testnet, a 0.1 NEAR payment moves exactly `95000000000000000000000` yocto to the creator and `5000000000000000000000` to the treasury. Both appear on the explorer.
3. `verify` returns `paid` only after `get_payment` has a matching record. A quote paid with the wrong creator or a smaller amount returns `invalid`.
4. Reusing a `quote_id` is rejected by the contract.
5. On an Android phone: connect the wallet, pay, return to the app, and the agent unlocks without a manual refresh.
6. No private key is stored anywhere in the repo or the app; the only keys in the browser are the wallet's own.

## [VERIFY] first (spike task, done before any UI work)
- **Wallet:** which wallet connector is current and works on Android Chrome on testnet. Options are `@near-wallet-selector/*` with MyNearWallet or Meteor, or the newer NEAR Connect. Get the exact package names and versions from docs.near.org.
- **Toolchain:** the current `near-sdk-rs` and `cargo-near` versions, and the `near` CLI (near-cli-rs) for deploying.
- **RPC:** the testnet RPC URL and the explorer URL format.

## Verified facts
Checked 2026-11-14 by T08 (sources listed in tasks/T08 Log). `[VERIFY]` = not confirmed from docs.

**Wallet connector**
- docs.near.org/tools/near-connect says to use NEAR Connect, package `@hot-labs/near-connect` (npm latest **0.12.0**, modified 2026-10-26), and calls `@near-wallet-selector/*` "deprecated and no longer maintained" (npm latest 10.1.4, Dec 2025). **Use NEAR Connect, not wallet-selector.**
- Install: `npm install @hot-labs/near-connect near-api-js` (near-api-js latest 7.5.3). The connector itself has no dependencies.
- Init: `import { NearConnector } from "@hot-labs/near-connect"; const connector = new NearConnector({ network: "testnet" });`
- Connect: `const w = await connector.connect(); const accounts = await w.getAccounts();` Disconnect: `connector.disconnect(wallet)`. Events: `connector.on('wallet:signIn', p => p.accounts[0]?.accountId)` and `'wallet:signOut'`.
- Pay: `const wallet = await connector.wallet(); const result = await wallet.signAndSendTransaction({ receiverId, actions: [{ type: "FunctionCall", params: { methodName, args, gas: "30000000000000", deposit } }] });` The tx hash is `result.transaction.hash` (the only documented use; the full result shape is not documented).
- Wallets (manifest): HOT, Meteor, Intear, MyNearWallet, Nightly, Near Mobile, Unity, OKX, Hana, Ethereum wallets, near-cli-rs, any via WalletConnect. Wallet code runs in sandboxed iframes loaded from a manifest at runtime. It is not described as a redirect flow, so the hash comes back from the awaited promise, not a URL parameter.
- Decision: **NEAR Connect with Meteor Wallet.** In the manifest (`azbang/near-connect` `repository/manifest.json`), `meteor-wallet` declares `features.testnet: true` with platforms web, chrome, android, ios. `mynearwallet` and `hot-wallet` do not declare testnet, and `near-mobile` is `testnet: false`. Other `testnet: true` wallets: intear, unity, nightly, ethereum-wallets, wallet-connect (fallbacks). Meteor matches the human's Android wallet. `[VERIFY]` the Meteor popup flow on a real Android Chrome phone.
- `[VERIFY]` Android Chrome behaviour and which wallet works best on testnet (docs have no mobile flow; HOT has an Android app and a `hotwallet://` deep link). `[VERIFY]` whether a given wallet navigates away and loses the promise; if so the app recovers by polling `verify` with the stored `quote_id` (already the plan, Scope 3). Test on the phone in T19.

**Toolchain** (crates.io API, 2026-11-14)
- `near-sdk` **5.30.2** (use the version `cargo near new` generates in Cargo.toml). `cargo-near` **0.23.0**. `near-cli-rs` (the `near` command) **0.31.1**.
- Quickstart (docs.near.org/smart-contracts/quickstart.md): rustup install; `rustup target add wasm32-unknown-unknown`; installers `near-cli-rs-installer.sh` and `cargo-near-installer.sh` from GitHub `releases/latest`; `cargo near new <name>`; `cargo test`; `cargo near build non-reproducible-wasm` (output `target/near/<name>.wasm`); deploy with `near contract deploy <id> use-file <wasm> with-init-call <method> json-args '<json>' prepaid-gas '100 Tgas' attached-deposit '0 NEAR' network-config testnet sign-with-keychain send`.
- near-cli-rs install options: `npm install -g near-cli-rs@latest`, `cargo install near-cli-rs`, shell or PowerShell installers.
- Account creation: `near create-account <id>.testnet --useFaucet --networkId testnet` (full form `near account create-account sponsor-by-faucet-service <id> autogenerate-new-keypair save-to-keychain network-config testnet create`). Sub-account: docs.near.org/tools/cli gives no syntax. The near-cli-rs agent-skill reference gives `near account create-account fund-myself <new-id> '<balance>' autogenerate-new-keypair save-to-keychain sign-as <parent> network-config testnet sign-with-keychain send`. `[VERIFY]` with `--help`.
- Call with deposit: `near contract call-function as-transaction <id> <method> json-args '<json>' prepaid-gas '30 Tgas' attached-deposit '0.1 NEAR' sign-as <acct> network-config testnet sign-with-keychain send`. View: `near contract call-function as-read-only <id> <method> json-args '<json>' network-config testnet now`.
- WSL (`wsl -l -v`): distro `Ubuntu` (WSL 2, Running, Ubuntu 26.04.1 LTS); `docker-desktop` is Stopped. `cargo`, `rustup` and `cargo-near` are **not installed** in Ubuntu yet. A Windows npm `near` is visible from WSL via PATH.

**RPC and explorer**
- Free public testnet RPCs (docs.near.org/api/rpc/providers.md): `https://test.rpc.fastnear.com` (confirmed live, `chain_id: testnet`), `https://near-testnet.drpc.org`, `https://testnet-rpc.intea.rs`, `https://api.zan.top/near-testnet`, `https://archival-rpc.testnet.near.org` (severely rate limited). Use FastNEAR for `NEAR_RPC_URL`. No JSON-RPC batching: one request object per HTTP request.
- Explorer: `https://testnet.nearblocks.io/txns/<hash>`. The docs pages checked list no explorer URLs and the site returned 403 to a script, so the format comes from the task brief: `[VERIFY]` once by opening a real hash in a browser.
- `call_function` view request (docs.near.org/api/rpc/contracts.md): POST `{"jsonrpc":"2.0","id":"dontcare","method":"query","params":{"request_type":"call_function","finality":"final","account_id":"<contract>","method_name":"get_payment","args_base64":"<base64 of {\"quote_id\":\"...\"}>"}}`. Response `result.result` is a byte array: decode as UTF-8, then `JSON.parse` (`null` means no payment). On failure `result.error` holds a message; check it first.

**Gas (30 Tgas for `pay`)**
- Docs (protocol/transactions/gas.md): a transaction may attach up to 1000 Tgas (not 300). A Transfer action costs about 0.45 Tgas and creating a receipt about 0.11 Tgas. Unspent gas is refunded (a refund fee exists from protocol 78, currently 0). The docs' own wallet example attaches 30 TGas.
- Verdict: **30 Tgas is adequate for `pay`** (one map insert, one event log and two Promise transfers come to well under 10 Tgas by the documented unit costs). Default 30 Tgas; if the quote path shows `Exceeded the prepaid gas`, raise to 50 Tgas (refunded). This is a docs-based estimate: `[VERIFY]` the real gas used on the first testnet payment (T19).
