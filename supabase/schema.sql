-- brbs mafia: database schema.
-- Run as a whole in Supabase → SQL Editor → New query → Run.

create extension if not exists pgcrypto;

-- A profile is created automatically on the first Telegram login.
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  discord_id text, -- for @name mentions in the Discord session message (optional)
  name text not null default 'Без имени',
  avatar_url text,
  timezone text not null default 'Europe/Moscow',
  onboarded boolean not null default false,
  created_at timestamptz not null default now()
);

-- Crew members. Only the server writes here (when a Telegram group member logs in).
create table public.members (
  user_id uuid primary key references public.profiles on delete cascade,
  invited_by uuid references public.profiles on delete set null,
  joined_at timestamptz not null default now()
);

create table public.games (
  id bigint generated always as identity primary key,
  steam_appid integer unique,
  name text not null,
  added_by uuid references public.profiles on delete set null,
  created_at timestamptz not null default now()
);

-- "Want now" status: lives 24 hours (filtered by created_at).
create table public.wants (
  user_id uuid references public.profiles on delete cascade,
  game_id bigint references public.games on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, game_id)
);

-- Quick access: games the person searched for or picked.
create table public.recent_games (
  user_id uuid references public.profiles on delete cascade,
  game_id bigint references public.games on delete cascade,
  used_at timestamptz not null default now(),
  primary key (user_id, game_id)
);

-- One entry per person per day (the day in their local time).
-- status: 'free' means time is marked (slots), 'busy' means they pressed NO.
-- No entry means "silent".
create table public.day_entries (
  user_id uuid references public.profiles on delete cascade,
  day date not null,
  status text not null check (status in ('free', 'busy')),
  slots jsonb not null default '[]', -- [{"start": iso, "end": iso}]
  game_ids bigint[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (user_id, day),
  check (cardinality(game_ids) <= 5)
);

-- Internal: the id of today's Discord message.
create table public.app_state (
  key text primary key,
  value jsonb
);

-- Profile on first login: name and photo the server passed from Telegram (api/tg/auth).
-- Photos only from Telegram: the same rule as the avatar check (008_hardening.sql).
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      'Без имени'
    ),
    case
      when new.raw_user_meta_data ->> 'avatar_url' like 'https://t.me/i/userpic/%'
        then new.raw_user_meta_data ->> 'avatar_url'
    end
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where user_id = auth.uid());
$$;

-- Access: only members see and change things; your own data only you.
alter table public.profiles enable row level security;
alter table public.members enable row level security;
alter table public.games enable row level security;
alter table public.wants enable row level security;
alter table public.recent_games enable row level security;
alter table public.day_entries enable row level security;
alter table public.app_state enable row level security;

create policy "members read profiles" on public.profiles
  for select using (public.is_member() or id = auth.uid());
create policy "own profile update" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

create policy "members read members" on public.members
  for select using (public.is_member());

create policy "members read games" on public.games
  for select using (public.is_member());
create policy "members add games" on public.games
  for insert with check (public.is_member());
create policy "members delete games" on public.games
  for delete using (public.is_member());

create policy "members read wants" on public.wants
  for select using (public.is_member());
create policy "own wants insert" on public.wants
  for insert with check (public.is_member() and user_id = auth.uid());
create policy "own wants delete" on public.wants
  for delete using (user_id = auth.uid());

create policy "own recent games" on public.recent_games
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "members read days" on public.day_entries
  for select using (public.is_member());
create policy "own days insert" on public.day_entries
  for insert with check (public.is_member() and user_id = auth.uid());
create policy "own days update" on public.day_entries
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own days delete" on public.day_entries
  for delete using (user_id = auth.uid());

-- Live updates on the site.
alter publication supabase_realtime add table
  public.profiles, public.games, public.wants, public.day_entries, public.members;

-- Avatars.
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true);
create policy "avatar upload" on storage.objects
  for insert with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatar update" on storage.objects
  for update using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
