-- Steam profile and playtime: games are sorted by it (most launched first).
alter table public.profiles add column if not exists steam_id text;

create table if not exists public.steam_playtime (
  user_id uuid not null references public.profiles(id) on delete cascade,
  steam_appid integer not null,
  recent_minutes integer not null default 0, -- over the last 2 weeks
  total_minutes integer not null default 0,
  last_played timestamptz,
  primary key (user_id, steam_appid)
);
alter table public.steam_playtime enable row level security;

-- Readable by all members; written only by the server (service key).
drop policy if exists "members read playtime" on public.steam_playtime;
create policy "members read playtime" on public.steam_playtime
  for select using (public.is_member());
