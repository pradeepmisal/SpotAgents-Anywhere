-- ===== Part 2: near-pay ======================================================
-- Written only by the near-pay Edge Function (service role). Clients read only their own rows.
create table public.payment_quotes (
  id             text primary key,               -- quote_id, also passed to the contract (<= 64 chars)
  user_id        uuid not null references auth.users (id) on delete cascade,
  agent_id       uuid not null references public.agents (id) on delete cascade,
  creator_account text not null,
  amount_yocto   numeric(40,0) not null check (amount_yocto > 0),
  status         text not null default 'pending' check (status in ('pending', 'paid', 'expired')),
  payer_account  text,                            -- filled from the contract record on verify
  tx_hash        text,                            -- from the wallet, for the explorer link only
  expires_at     timestamptz not null,            -- quote must be paid before this
  unlocked_until timestamptz,                     -- set on verify: now() + 30 minutes
  created_at     timestamptz not null default now()
);
create index payment_quotes_unlock on public.payment_quotes (user_id, agent_id, unlocked_until desc);
alter table public.payment_quotes enable row level security;
create policy "read own quotes" on public.payment_quotes for select to authenticated using (user_id = auth.uid());
