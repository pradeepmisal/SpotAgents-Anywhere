//! spot_pay: pays an agent creator in NEAR, minus a platform fee.
//! Money is u128 / U128, no floats.
use near_sdk::json_types::U128;
use near_sdk::serde::Serialize;
use near_sdk::store::LookupMap;
use near_sdk::{env, near, require, AccountId, NearToken, PanicOnDefault, Promise};

const MAX_FEE_BPS: u16 = 2000;
const MAX_QUOTE_ID_LEN: usize = 64;

#[near(serializers = [borsh])]
#[derive(Clone)]
pub struct Payment {
    pub payer: AccountId,
    pub creator: AccountId,
    pub agent_id: String,
    pub amount: u128,
    pub fee: u128,
    pub block_timestamp_ms: u64,
}

#[near(serializers = [json])]
#[derive(Clone, Debug)]
pub struct PaymentView {
    pub payer: AccountId,
    pub creator: AccountId,
    pub agent_id: String,
    pub amount: U128,
    pub fee: U128,
    pub block_timestamp_ms: u64,
}

impl From<&Payment> for PaymentView {
    fn from(p: &Payment) -> Self {
        PaymentView {
            payer: p.payer.clone(),
            creator: p.creator.clone(),
            agent_id: p.agent_id.clone(),
            amount: U128(p.amount),
            fee: U128(p.fee),
            block_timestamp_ms: p.block_timestamp_ms,
        }
    }
}

const SESSION_TIMEOUT_MS: u64 = 30 * 60 * 1000;

#[near(serializers = [borsh])]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum SessionStatus {
    Active,
    Released,
}

#[near(serializers = [borsh])]
#[derive(Clone)]
pub struct Session {
    pub payer: AccountId,
    pub creator: AccountId,
    pub agent_id: String,
    pub amount: u128,
    pub fee: u128,
    pub started_ms: u64,
    pub status: SessionStatus,
    pub released_ms: Option<u64>,
}

#[near(serializers = [json])]
#[derive(Clone, Debug)]
pub struct SessionView {
    pub payer: AccountId,
    pub creator: AccountId,
    pub agent_id: String,
    pub amount: U128,
    pub fee: U128,
    pub started_ms: u64,
    /// "active" or "released"
    pub status: String,
    pub released_ms: Option<u64>,
}

impl From<&Session> for SessionView {
    fn from(s: &Session) -> Self {
        SessionView {
            payer: s.payer.clone(),
            creator: s.creator.clone(),
            agent_id: s.agent_id.clone(),
            amount: U128(s.amount),
            fee: U128(s.fee),
            started_ms: s.started_ms,
            status: match s.status {
                SessionStatus::Active => "active".to_string(),
                SessionStatus::Released => "released".to_string(),
            },
            released_ms: s.released_ms,
        }
    }
}

#[near(serializers = [json])]
#[derive(Clone, Debug)]
pub struct Config {
    pub treasury: AccountId,
    pub fee_bps: u16,
}

#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
struct PaymentEventData<'a> {
    quote_id: &'a str,
    agent_id: &'a str,
    payer: &'a AccountId,
    creator: &'a AccountId,
    amount: U128,
    fee: U128,
}

#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
struct PaymentEvent<'a> {
    standard: &'static str,
    version: &'static str,
    event: &'static str,
    data: [PaymentEventData<'a>; 1],
}

fn emit_session(released: bool, quote_id: &str, s: &Session) {
    let ev = PaymentEvent {
        standard: "spotagents",
        version: "1.0.0",
        event: if released { "session_released" } else { "session_started" },
        data: [PaymentEventData {
            quote_id,
            agent_id: &s.agent_id,
            payer: &s.payer,
            creator: &s.creator,
            amount: U128(s.amount),
            fee: U128(s.fee),
        }],
    };
    let json = near_sdk::serde_json::to_string(&ev).unwrap_or_else(|_| env::abort());
    env::log_str(&format!("EVENT_JSON:{}", json));
}

/// fee = amount * fee_bps / 10000, integer floor. u128 cannot overflow for
/// any real deposit (total NEAR supply is ~1e33 yocto; u128 max is ~3.4e38).
pub fn compute_fee(amount: u128, fee_bps: u16) -> u128 {
    amount * fee_bps as u128 / 10_000
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct SpotPay {
    treasury: AccountId,
    fee_bps: u16,
    payments: LookupMap<String, Payment>,
    sessions: LookupMap<String, Session>,
}

#[near]
impl SpotPay {
    #[init]
    pub fn new(treasury: AccountId, fee_bps: u16) -> Self {
        require!(fee_bps <= MAX_FEE_BPS, "fee_bps must be <= 2000");
        Self {
            treasury,
            fee_bps,
            payments: LookupMap::new(b"p"),
            sessions: LookupMap::new(b"s"),
        }
    }

    #[payable]
    pub fn pay(&mut self, quote_id: String, agent_id: String, creator: AccountId) {
        let deposit = env::attached_deposit().as_yoctonear();
        require!(deposit > 0, "deposit must be greater than 0");
        require!(!quote_id.is_empty(), "quote_id must not be empty");
        require!(
            quote_id.chars().count() <= MAX_QUOTE_ID_LEN,
            "quote_id must be at most 64 characters"
        );
        require!(
            !self.payments.contains_key(&quote_id) && !self.sessions.contains_key(&quote_id),
            "quote_id already used"
        );

        let fee = compute_fee(deposit, self.fee_bps);
        let net = deposit - fee;
        let payer = env::predecessor_account_id();

        let event = PaymentEvent {
            standard: "spotagents",
            version: "1.0.0",
            event: "payment",
            data: [PaymentEventData {
                quote_id: &quote_id,
                agent_id: &agent_id,
                payer: &payer,
                creator: &creator,
                amount: U128(deposit),
                fee: U128(fee),
            }],
        };
        let event_json =
            near_sdk::serde_json::to_string(&event).unwrap_or_else(|_| env::abort());

        self.payments.insert(
            quote_id,
            Payment {
                payer,
                creator: creator.clone(),
                agent_id,
                amount: deposit,
                fee,
                block_timestamp_ms: env::block_timestamp_ms(),
            },
        );

        Promise::new(creator).transfer(NearToken::from_yoctonear(net)).detach();
        if fee > 0 {
            Promise::new(self.treasury.clone()).transfer(NearToken::from_yoctonear(fee)).detach();
        }
        env::log_str(&format!("EVENT_JSON:{}", event_json));
    }

    /// ADR-009: holds the deposit in the contract until `release`.
    #[payable]
    pub fn start_session(&mut self, quote_id: String, agent_id: String, creator: AccountId) {
        let deposit = env::attached_deposit().as_yoctonear();
        require!(deposit > 0, "deposit must be greater than 0");
        require!(!quote_id.is_empty(), "quote_id must not be empty");
        require!(
            quote_id.chars().count() <= MAX_QUOTE_ID_LEN,
            "quote_id must be at most 64 characters"
        );
        require!(
            !self.payments.contains_key(&quote_id) && !self.sessions.contains_key(&quote_id),
            "quote_id already used"
        );
        let session = Session {
            payer: env::predecessor_account_id(),
            creator,
            agent_id,
            amount: deposit,
            fee: compute_fee(deposit, self.fee_bps),
            started_ms: env::block_timestamp_ms(),
            status: SessionStatus::Active,
            released_ms: None,
        };
        emit_session(false, &quote_id, &session);
        self.sessions.insert(quote_id, session);
    }

    /// Pays the creator and treasury. The payer may release any time; anyone
    /// may release once 30 minutes have passed since the session started.
    pub fn release(&mut self, quote_id: String) {
        let now = env::block_timestamp_ms();
        let caller = env::predecessor_account_id();
        let session = self
            .sessions
            .get_mut(&quote_id)
            .unwrap_or_else(|| env::panic_str("session not found"));
        require!(session.status == SessionStatus::Active, "session already released");
        require!(
            caller == session.payer || now >= session.started_ms + SESSION_TIMEOUT_MS,
            "only the payer can release before the 30 minute timeout"
        );
        // State change before any promise.
        session.status = SessionStatus::Released;
        session.released_ms = Some(now);
        let s = session.clone();
        let net = s.amount - s.fee;
        emit_session(true, &quote_id, &s);
        Promise::new(s.creator.clone()).transfer(NearToken::from_yoctonear(net)).detach();
        if s.fee > 0 {
            Promise::new(self.treasury.clone())
                .transfer(NearToken::from_yoctonear(s.fee))
                .detach();
        }
    }

    pub fn get_session(&self, quote_id: String) -> Option<SessionView> {
        self.sessions.get(&quote_id).map(SessionView::from)
    }

    pub fn get_payment(&self, quote_id: String) -> Option<PaymentView> {
        self.payments.get(&quote_id).map(PaymentView::from)
    }

    pub fn get_config(&self) -> Config {
        Config {
            treasury: self.treasury.clone(),
            fee_bps: self.fee_bps,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::{get_created_receipts, get_logs, VMContextBuilder};
    use near_sdk::testing_env;

    const ONE_NEAR: u128 = 1_000_000_000_000_000_000_000_000;

    fn acct(s: &str) -> AccountId {
        s.parse().unwrap()
    }

    fn with_deposit(deposit: u128) {
        let ctx = VMContextBuilder::new()
            .predecessor_account_id(acct("payer.testnet"))
            .attached_deposit(NearToken::from_yoctonear(deposit))
            .block_timestamp(1_700_000_000_000_000_000)
            .build();
        testing_env!(ctx);
    }

    fn setup(deposit: u128) -> SpotPay {
        with_deposit(deposit);
        SpotPay::new(acct("treasury.testnet"), 500)
    }

    #[test]
    fn t1_one_near_at_500_bps_splits_exactly() {
        let mut c = setup(ONE_NEAR);
        c.pay("q1".into(), "agent1".into(), acct("creator.testnet"));
        let p = c.get_payment("q1".into()).unwrap();
        assert_eq!(p.amount.0, ONE_NEAR);
        assert_eq!(p.fee.0, 50_000_000_000_000_000_000_000); // 0.05 NEAR
        assert_eq!(p.amount.0 - p.fee.0, 950_000_000_000_000_000_000_000); // 0.95 NEAR
        assert_eq!(get_created_receipts().len(), 2);
        assert!(get_logs()
            .iter()
            .any(|l| l.starts_with("EVENT_JSON:{\"standard\":\"spotagents\"")));
    }

    #[test]
    fn t2_one_yocto_has_zero_fee_and_no_treasury_transfer() {
        let mut c = setup(1);
        c.pay("q1".into(), "agent1".into(), acct("creator.testnet"));
        let p = c.get_payment("q1".into()).unwrap();
        assert_eq!(p.fee.0, 0);
        assert_eq!(p.amount.0 - p.fee.0, 1);
        // Only the creator transfer receipt; none to the treasury.
        assert_eq!(get_created_receipts().len(), 1);
    }

    #[test]
    #[should_panic(expected = "quote_id already used")]
    fn t3_duplicate_quote_id_panics() {
        let mut c = setup(ONE_NEAR);
        c.pay("q1".into(), "agent1".into(), acct("creator.testnet"));
        with_deposit(ONE_NEAR);
        c.pay("q1".into(), "agent1".into(), acct("creator.testnet"));
    }

    #[test]
    #[should_panic(expected = "deposit must be greater than 0")]
    fn t4_zero_deposit_panics() {
        let mut c = setup(0);
        c.pay("q1".into(), "agent1".into(), acct("creator.testnet"));
    }

    #[test]
    fn t5_get_payment_amounts_are_strings() {
        let mut c = setup(ONE_NEAR);
        c.pay("q1".into(), "agent1".into(), acct("creator.testnet"));
        let v = near_sdk::serde_json::to_value(c.get_payment("q1".into()).unwrap()).unwrap();
        assert_eq!(v["amount"], "1000000000000000000000000");
        assert_eq!(v["fee"], "50000000000000000000000");
        assert!(v["amount"].is_string() && v["fee"].is_string());
        assert!(c.get_payment("missing".into()).is_none());
    }

    #[test]
    #[should_panic(expected = "quote_id must not be empty")]
    fn empty_quote_id_panics() {
        let mut c = setup(ONE_NEAR);
        c.pay("".into(), "a".into(), acct("creator.testnet"));
    }

    #[test]
    #[should_panic(expected = "at most 64")]
    fn long_quote_id_panics() {
        let mut c = setup(ONE_NEAR);
        c.pay("x".repeat(65), "a".into(), acct("creator.testnet"));
    }

    #[test]
    fn quote_id_of_64_chars_is_accepted() {
        let mut c = setup(ONE_NEAR);
        c.pay("x".repeat(64), "a".into(), acct("creator.testnet"));
        assert!(c.get_payment("x".repeat(64)).is_some());
    }

    #[test]
    #[should_panic(expected = "fee_bps must be <= 2000")]
    fn fee_bps_over_max_panics() {
        testing_env!(VMContextBuilder::new().build());
        SpotPay::new(acct("treasury.testnet"), 2001);
    }

    #[test]
    fn fee_math_edges() {
        assert_eq!(compute_fee(0, 500), 0);
        assert_eq!(compute_fee(19, 500), 0); // floor
        assert_eq!(compute_fee(20, 500), 1);
        assert_eq!(compute_fee(ONE_NEAR, 2000), ONE_NEAR / 5);
        assert_eq!(compute_fee(ONE_NEAR, 0), 0);
    }

    fn ctx_as(who: &str, deposit: u128, ts_ms: u64) {
        testing_env!(VMContextBuilder::new()
            .predecessor_account_id(acct(who))
            .attached_deposit(NearToken::from_yoctonear(deposit))
            .block_timestamp(ts_ms * 1_000_000)
            .build());
    }

    const T0: u64 = 1_700_000_000_000;
    const HALF_HOUR: u64 = 30 * 60 * 1000;

    fn started() -> SpotPay {
        ctx_as("payer.testnet", ONE_NEAR / 10, T0);
        let mut c = SpotPay::new(acct("treasury.testnet"), 500);
        c.start_session("s1".into(), "agent1".into(), acct("creator.testnet"));
        c
    }

    #[test]
    fn s1_start_holds_funds_no_transfers() {
        let c = started();
        assert_eq!(get_created_receipts().len(), 0);
        let v = c.get_session("s1".into()).unwrap();
        assert_eq!(v.status, "active");
        assert_eq!(v.amount.0, ONE_NEAR / 10);
        assert_eq!(v.fee.0, ONE_NEAR / 200);
        assert!(get_logs().iter().any(|l| l.contains("\"event\":\"session_started\"")));
        let j = near_sdk::serde_json::to_value(&v).unwrap();
        assert!(j["amount"].is_string() && j["fee"].is_string());
        assert!(c.get_session("none".into()).is_none());
    }

    #[test]
    fn s2_payer_releases_with_exact_split() {
        let mut c = started();
        ctx_as("payer.testnet", 0, T0 + 1000);
        c.release("s1".into());
        let v = c.get_session("s1".into()).unwrap();
        assert_eq!(v.status, "released");
        assert_eq!(v.released_ms, Some(T0 + 1000));
        let receipts = get_created_receipts();
        assert_eq!(receipts.len(), 2);
        let dump = format!("{:?}", receipts);
        // 0.1 NEAR: net 0.095, fee 0.005
        assert!(dump.contains("95000000000000000000000"), "{}", dump);
        assert!(dump.contains("5000000000000000000000"), "{}", dump);
        assert!(get_logs().iter().any(|l| l.contains("\"event\":\"session_released\"")));
    }

    #[test]
    #[should_panic(expected = "only the payer can release")]
    fn s3_stranger_cannot_release_early() {
        let mut c = started();
        ctx_as("stranger.testnet", 0, T0 + HALF_HOUR - 1);
        c.release("s1".into());
    }

    #[test]
    fn s4_stranger_can_release_after_timeout() {
        let mut c = started();
        ctx_as("stranger.testnet", 0, T0 + HALF_HOUR);
        c.release("s1".into());
        assert_eq!(c.get_session("s1".into()).unwrap().status, "released");
        assert_eq!(get_created_receipts().len(), 2);
    }

    #[test]
    #[should_panic(expected = "session already released")]
    fn s5_double_release_panics() {
        let mut c = started();
        ctx_as("payer.testnet", 0, T0 + 1);
        c.release("s1".into());
        c.release("s1".into());
    }

    #[test]
    #[should_panic(expected = "quote_id already used")]
    fn s6_pay_then_start_session_same_id_panics() {
        let mut c = setup(ONE_NEAR);
        c.pay("q1".into(), "a".into(), acct("creator.testnet"));
        with_deposit(ONE_NEAR);
        c.start_session("q1".into(), "a".into(), acct("creator.testnet"));
    }

    #[test]
    #[should_panic(expected = "quote_id already used")]
    fn s7_start_session_then_pay_same_id_panics() {
        let mut c = setup(ONE_NEAR);
        c.start_session("q1".into(), "a".into(), acct("creator.testnet"));
        with_deposit(ONE_NEAR);
        c.pay("q1".into(), "a".into(), acct("creator.testnet"));
    }

    #[test]
    #[should_panic(expected = "deposit must be greater than 0")]
    fn s8_start_session_zero_deposit_panics() {
        let mut c = setup(0);
        c.start_session("q1".into(), "a".into(), acct("creator.testnet"));
    }

    #[test]
    #[should_panic(expected = "session not found")]
    fn s9_release_unknown_panics() {
        let mut c = setup(1);
        c.release("nope".into());
    }

    #[test]
    fn get_config_returns_treasury_and_bps() {
        let c = setup(1);
        let cfg = c.get_config();
        assert_eq!(cfg.treasury, acct("treasury.testnet"));
        assert_eq!(cfg.fee_bps, 500);
    }
}
