# Contract interface: `spot_pay` (NEAR testnet)

Status: Approved (2026-11-14). FROZEN once approved. Decisions: ADR-002, ADR-004, ADR-005, ADR-006.

Rust, `near-sdk-rs`, built with `cargo-near` in WSL. Deployed to a testnet sub-account such as `spotpay.<you>.testnet` (account name `[VERIFY]` at deploy time).

## State
- `treasury: AccountId`: receives the platform fee.
- `fee_bps: u16`: fee in basis points. Default **500** (5%). Maximum 2000.
- `payments: LookupMap<String, Payment>`, keyed by `quote_id`.

```rust
struct Payment { payer: AccountId, creator: AccountId, agent_id: String,
                 amount: u128, fee: u128, block_timestamp_ms: u64 }
```

## Methods
| Method | Kind | Behaviour |
|---|---|---|
| `new(treasury: AccountId, fee_bps: u16)` | `#[init]` | Panics if `fee_bps > 2000`. |
| `pay(quote_id: String, agent_id: String, creator: AccountId)` | `#[payable]` change | Panics if the deposit is 0, `quote_id` is empty or longer than 64 characters, or `quote_id` has been used before. Computes `fee = deposit * fee_bps / 10000` with integer floor; `net = deposit - fee`. Stores the `Payment`, then starts `Promise::new(creator).transfer(net)` and, if `fee > 0`, `Promise::new(treasury).transfer(fee)`. Emits an event. Returns nothing. |
| `get_payment(quote_id: String) -> Option<PaymentView>` | view | `PaymentView` is the same as `Payment`, but `amount` and `fee` are `U128`, so they serialise as JSON strings. |
| `get_config() -> { treasury, fee_bps }` | view | |

## Event (NEP-297 log)
```
EVENT_JSON:{"standard":"spotagents","version":"1.0.0","event":"payment",
 "data":[{"quote_id":"…","agent_id":"…","payer":"…","creator":"…","amount":"…","fee":"…"}]}
```

## Known limits (accepted for the hackathon)
- **A failed transfer leaves funds in the contract.** If `creator` doesn't exist, the transfer fails and `net` stays in the contract. The payment record stays, so the user still unlocks. Mitigation: the `quote` function checks the creator account exists through RPC `view_account` before issuing a quote.
- **The contract pays storage for each payment record**, from its own balance. Fund it with a few testnet NEAR.
- **No upgrade or owner methods.** Redeploy to a new account if something changes.

## Required tests (`cargo test`, plus a near-workspaces sandbox test if time allows)
1. A 1 NEAR deposit at 500 bps gives a fee of 0.05 NEAR and a net of 0.95 NEAR, exactly, in yocto.
2. A deposit of 1 yocto gives a fee of 0 and a net of 1, and makes no treasury transfer.
3. Paying twice with the same `quote_id` panics.
4. A zero deposit panics.
5. `get_payment` returns amounts as strings.

## v2 (ADR-009): guided session escrow
Additive. `pay`, `get_payment`, `get_config` are unchanged. v2 deploys to `spotpayv2.sweetfrog-treasury.testnet`. New state: `sessions: LookupMap<String, Session>` (prefix `s`), keyed by `quote_id`.

```rust
struct Session { payer, creator: AccountId, agent_id: String, amount: u128, fee: u128 /* floor, computed at start */,
                 started_ms: u64, status: Active | Released, released_ms: Option<u64> }
```

| Method | Kind | Behaviour |
|---|---|---|
| `start_session(quote_id, agent_id, creator)` | `#[payable]` change | Same validation as `pay`; `quote_id` must be unused across both payments and sessions. Stores the session as `Active` and **holds the funds (no transfer)**. Emits `session_started`. |
| `release(quote_id)` | change | Allowed if status is `Active` and (caller is the payer OR `now >= started_ms + 30 min`). Sets `Released` and `released_ms` BEFORE promises, then transfers `amount - fee` to the creator and `fee` (if > 0) to the treasury. Emits `session_released`. Panics: `session not found`, `session already released`, `only the payer can release before the 30 minute timeout`. |
| `get_session(quote_id) -> Option<SessionView>` | view | `amount`, `fee` are `U128` strings; `status` is `"active"` or `"released"`. |

Events use the same NEP-297 shape as `payment`, with `event` = `session_started` / `session_released`.

Backend: `near-pay/verify` treats a v1 `get_payment` record OR a v2 `get_session` record (active or released) as paid, with the same creator/agent/amount checks, and returns `session_status: "active" | "released" | null`.

Tests added: start holds funds (0 receipts); payer release gives an exact 95/5 split; stranger blocked before 30 min and allowed at 30 min; double release panics; duplicate `quote_id` across pay/start_session panics both ways; zero deposit panics; unknown session panics.
