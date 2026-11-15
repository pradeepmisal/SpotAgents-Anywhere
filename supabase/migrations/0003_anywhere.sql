-- SpotAgents Anywhere database contract. Status: Approved (2026-11-15). FROZEN.
-- New tables only, prefixed ax_. The NEAR-era tables (agents, payment_quotes) are not touched.
-- Migration file: supabase/migrations/0003_anywhere.sql (copy of this file).

create table public.ax_agents (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name             text not null check (char_length(name) between 1 and 60),
  title            text not null default '' check (char_length(title) <= 60),   -- e.g. "Local historian"
  place_name       text not null default '' check (char_length(place_name) <= 120),
  city             text not null default '' check (char_length(city) <= 60),
  lat              double precision not null check (lat between -90 and 90),
  lng              double precision not null check (lng between -180 and 180),
  radius_m         double precision not null default 60 check (radius_m between 10 and 2000),
  avatar           text not null default 'brunette' check (avatar ~ '^[a-z0-9-]{1,32}$'),
  color            text not null default '#1f884a' check (char_length(color) <= 16),
  price_units      numeric(40,0) not null check (price_units > 0),   -- token base units (pieUSD has 18 decimals)
  price_usd        numeric(10,4) not null check (price_usd between 0.01 and 0.10),
  compiled         jsonb not null,               -- matches anywhere-agent.schema.json
  source_notes     text not null check (char_length(source_notes) between 20 and 4000), -- never returned to clients
  status           text not null default 'in_review'
                   check (status in ('in_review','listed','listed_unreviewed','rejected')),
  version          int not null default 1 check (version between 1 and 3),
  quality_score    int check (quality_score between 0 and 100),
  quality_decision text check (quality_decision in ('accept','revise','reject')),
  quality_critique text check (char_length(quality_critique) <= 4000),
  reppo_eval_id    text,
  review_history   jsonb not null default '[]',  -- [{version, score, decision, critique, at}]
  sample           boolean not null default false, -- seeded showcase: "Sample creator · demo"
  created_at       timestamptz not null default now(),
  expires_at       timestamptz                    -- null for samples; now()+7 days for demo creators
);
create index ax_agents_geo_idx on public.ax_agents (lat, lng);
alter table public.ax_agents enable row level security;
-- Clients never read the table directly; the ax-agents function returns the public shape.

create table public.ax_budgets (
  user_id          uuid primary key references auth.users (id) on delete cascade,
  budget_units     numeric(40,0) not null,        -- default $1.00 in base units
  per_tx_cap_units numeric(40,0) not null,        -- default $0.10
  spent_units      numeric(40,0) not null default 0,
  expires_at       timestamptz not null,          -- session window, 24 h
  created_at       timestamptz not null default now()
);
alter table public.ax_budgets enable row level security;

create table public.ax_payments (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  agent_id         uuid not null references public.ax_agents (id) on delete cascade,
  amount_units     numeric(40,0) not null,
  status           text not null check (status in ('settled','simulated','failed')),
  network          text not null default 'kite-testnet',
  tx_hash          text,
  payer            text,
  pay_to           text,
  error            text,
  unlocked_until   timestamptz,
  created_at       timestamptz not null default now()
);
create index ax_payments_user_agent_idx on public.ax_payments (user_id, agent_id);
alter table public.ax_payments enable row level security;
