-- SpotAgents database contract. Status: Approved (2026-11-14). FROZEN once approved.
-- Builders copy this into supabase/migrations/ (geo-agents: part 1, near-pay: part 2).
-- Part 1 is adapted from upstream supabase/migrations/20261106000000_agents.sql and
-- 20261106120000_agent_shape.sql (MIT). See docs/BASELINE.md.

-- ===== Part 1: geo-agents =====================================================
create table public.agents (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 60),
  emoji         text check (char_length(emoji) <= 8),
  color         text check (char_length(color) <= 16),
  avatar        text not null default 'default' check (avatar ~ '^[a-z0-9-]{1,32}$'), -- GLB key in apps/web/public/avatars/<avatar>.glb
  voice         text check (char_length(voice) <= 64),            -- browser speechSynthesis voice name hint
  greeting      text not null default '' check (char_length(greeting) <= 500),
  context       text not null default '' check (char_length(context) <= 8000),  -- never returned to clients
  premium_context text not null default '' check (char_length(premium_context) <= 8000), -- used only after payment
  lat           double precision not null check (lat between -90 and 90),
  lng           double precision not null check (lng between -180 and 180),
  radius_m      double precision not null default 25 check (radius_m between 3 and 2000),
  price_yocto   numeric(40,0) check (price_yocto is null or price_yocto > 0),  -- null = free
  creator_account text check (creator_account ~ '^[a-z0-9._-]{2,64}$'),   -- NEAR testnet account paid by the contract
  model         text check (model is null or char_length(model) <= 100),   -- NEAR AI model id; null = server default
  created_at    timestamptz not null default now(),
  constraint paid_has_creator check (price_yocto is null or creator_account is not null)
);
create index agents_geo_idx on public.agents (lat, lng);
alter table public.agents enable row level security;
create policy "owners manage their agents" on public.agents
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Public discovery. Never returns context, premium_context, or exact coordinates
-- (one seed set sits at the developer's home); distance is rounded to 10 m.
create function public.nearby_agents(p_lat double precision, p_lng double precision, p_km double precision default 1)
returns table (
  id uuid, name text, emoji text, color text, avatar text, voice text, greeting text,
  radius_m double precision,
  price_yocto text, creator_account text, is_mine boolean, distance_m double precision
)
language sql stable security definer set search_path = public as $$
  select a.id, a.name, a.emoji, a.color, a.avatar, a.voice, a.greeting,
         a.radius_m, a.price_yocto::text, a.creator_account,
         a.owner_id = auth.uid(), round(d.m / 10) * 10
  from public.agents a
  cross join lateral (
    select 6371000 * 2 * asin(sqrt(
      power(sin(radians(a.lat - p_lat) / 2), 2) +
      cos(radians(p_lat)) * cos(radians(a.lat)) * power(sin(radians(a.lng - p_lng) / 2), 2)
    )) as m
  ) d
  where a.lat between p_lat - least(p_km, 50) / 111.0 and p_lat + least(p_km, 50) / 111.0
    and d.m <= least(p_km, 50) * 1000
  order by d.m
  limit 100
$$;
revoke all on function public.nearby_agents(double precision, double precision, double precision) from public;
grant execute on function public.nearby_agents(double precision, double precision, double precision) to anon, authenticated;

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
