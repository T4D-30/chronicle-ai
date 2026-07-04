-- ============================================================
--  Chronicle AI — Initial Schema
--  Migration: 0001_initial_schema
--  Run via: supabase db push
-- ============================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ---- profiles --------------------------------------------------
-- Extended user data beyond auth.users
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.profiles is 'Extended user profile data.';

-- ---- campaigns -------------------------------------------------
create table public.campaigns (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  title        text not null,
  description  text,
  status       text not null default 'idle'
                 check (status in ('idle', 'active', 'paused', 'completed')),
  character_id uuid,  -- FK to characters table (Phase 1)
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index on public.campaigns(user_id);
comment on table public.campaigns is 'A player''s campaign (persistent world/story arc).';

-- ---- game_sessions ---------------------------------------------
create table public.game_sessions (
  id           uuid primary key default gen_random_uuid(),
  campaign_id  uuid not null references public.campaigns(id) on delete cascade,
  turn_number  integer not null default 0,
  status       text not null default 'active'
                 check (status in ('active', 'paused', 'completed')),
  started_at   timestamptz not null default now(),
  ended_at     timestamptz
);

create index on public.game_sessions(campaign_id);
comment on table public.game_sessions is 'A single play session within a campaign.';

-- ---- narrative_turns -------------------------------------------
create table public.narrative_turns (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references public.game_sessions(id) on delete cascade,
  turn_number   integer not null,
  player_input  text not null,
  ai_narration  text not null default '',
  dice_rolls    jsonb not null default '[]',
  created_at    timestamptz not null default now()
);

create index on public.narrative_turns(session_id);
comment on table public.narrative_turns is 'Individual turn record: player action + AI narration + dice.';

-- ============================================================
--  Row Level Security
-- ============================================================

alter table public.profiles        enable row level security;
alter table public.campaigns       enable row level security;
alter table public.game_sessions   enable row level security;
alter table public.narrative_turns enable row level security;

-- profiles: users can only see and edit their own
create policy "profiles: owner access"
  on public.profiles for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- campaigns: users own their campaigns
create policy "campaigns: owner access"
  on public.campaigns for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- game_sessions: accessible if user owns the parent campaign
create policy "game_sessions: via campaign ownership"
  on public.game_sessions for all
  using (
    exists (
      select 1 from public.campaigns c
      where c.id = campaign_id and c.user_id = auth.uid()
    )
  );

-- narrative_turns: accessible if user owns the parent session's campaign
create policy "narrative_turns: via campaign ownership"
  on public.narrative_turns for all
  using (
    exists (
      select 1 from public.game_sessions gs
      join public.campaigns c on c.id = gs.campaign_id
      where gs.id = session_id and c.user_id = auth.uid()
    )
  );

-- ============================================================
--  Auto-create profile on signup
-- ============================================================

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'display_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
--  updated_at auto-update
-- ============================================================

create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at   before update on public.profiles   for each row execute procedure public.update_updated_at();
create trigger campaigns_updated_at  before update on public.campaigns  for each row execute procedure public.update_updated_at();
