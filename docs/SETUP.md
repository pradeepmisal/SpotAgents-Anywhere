# Setup

SpotAgents runs on testnet with three hosted pieces: a Supabase project, a NEAR AI Cloud API key, and the `spot_pay` contract.

## 1. Services
1. **Supabase:** create a free project. Under Authentication → Sign In / Providers, enable **Anonymous sign-ins**. Note the project URL, the anon (publishable) key and the project ref.
2. **NEAR AI Cloud:** sign up at cloud.near.ai, add a few dollars of credit, and create an API key.
3. **NEAR testnet accounts:** a creator, a treasury, a contract account, and your own wallet account (for example in Meteor Wallet) as the payer.

**Never commit secrets, and never paste a seed phrase or private key into a chat, file or the repo.** The CLI's `save-to-keychain` keeps keys in your OS keychain.

## 2. Rust toolchain (Linux, macOS or WSL)
```bash
sudo apt update && sudo apt install -y build-essential pkg-config libssl-dev curl
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source "$HOME/.cargo/env"
rustup target add wasm32-unknown-unknown
curl --proto '=https' --tlsv1.2 -LsSf https://github.com/near/cargo-near/releases/latest/download/cargo-near-installer.sh | sh
curl --proto '=https' --tlsv1.2 -LsSf https://github.com/near/near-cli-rs/releases/latest/download/near-cli-rs-installer.sh | sh
```
Tested with near-sdk 5.30.2, cargo-near 0.23.0, near-cli-rs 0.31.1 and `@hot-labs/near-connect` 0.12.0.

## 3. Testnet accounts
Replace `<you>` with a unique prefix.
```bash
near account create-account sponsor-by-faucet-service <you>-creator.testnet autogenerate-new-keypair save-to-keychain network-config testnet create
near account create-account sponsor-by-faucet-service <you>-treasury.testnet autogenerate-new-keypair save-to-keychain network-config testnet create
near account create-account fund-myself spotpay.<you>-treasury.testnet '5 NEAR' autogenerate-new-keypair save-to-keychain sign-as <you>-treasury.testnet network-config testnet sign-with-keychain send
```

## 4. Build and deploy the contract
```bash
cd contract
cargo test
cargo near build non-reproducible-wasm
near contract deploy spotpay.<you>-treasury.testnet use-file ./target/near/spot_pay.wasm \
  with-init-call new json-args '{"treasury":"<you>-treasury.testnet","fee_bps":500}' \
  prepaid-gas '100 Tgas' attached-deposit '0 NEAR' network-config testnet sign-with-keychain send
near contract call-function as-read-only spotpay.<you>-treasury.testnet get_config json-args '{}' network-config testnet now
```

Optional smoke test of an escrow session (0.1 NEAR):
```bash
near contract call-function as-transaction spotpay.<you>-treasury.testnet start_session json-args '{"quote_id":"smoke-1","agent_id":"smoke","creator":"<you>-creator.testnet"}' prepaid-gas '30 Tgas' attached-deposit '0.1 NEAR' sign-as <payer>.testnet network-config testnet sign-with-keychain send
near contract call-function as-transaction spotpay.<you>-treasury.testnet release json-args '{"quote_id":"smoke-1"}' prepaid-gas '30 Tgas' attached-deposit '0 NEAR' sign-as <payer>.testnet network-config testnet sign-with-keychain send
```
The creator should gain 0.095 NEAR and the treasury 0.005 NEAR. Check the receipts at `https://testnet.nearblocks.io/txns/<tx_hash>`.

## 5. Database and functions
```bash
npx supabase link --project-ref <PROJECT_REF>
npx supabase db push --remote          # applies supabase/migrations
# then run supabase/seed.sql in the SQL editor
npx supabase secrets set NEARAI_API_KEY=... NEARAI_MODEL=z-ai/glm-5.3-flash \
  NEAR_RPC_URL=https://test.rpc.fastnear.com SPOTPAY_CONTRACT_ID=spotpay.<you>-treasury.testnet
npx supabase functions deploy chat near-pay --use-api
```

## 6. Web app
`apps/web/.env.local`:
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_SPOTPAY_CONTRACT_ID=spotpay.<you>-treasury.testnet
VITE_NEAR_NETWORK=testnet
```
```bash
cd apps/web && npm ci --ignore-scripts && npm run dev
```
