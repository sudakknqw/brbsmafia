-- brbs mafia: схема базы.
-- Запускать целиком в Supabase → SQL Editor → New query → Run.

create extension if not exists pgcrypto;

-- Профиль создаётся автоматически при первом входе через Telegram.
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null default 'Без имени',
  avatar_url text,
  timezone text not null default 'Europe/Moscow',
  onboarded boolean not null default false,
  created_at timestamptz not null default now()
);

-- Участники компании. Пишет сюда только сервер (при входе участника группы в Telegram).
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

-- Статус «хочу сейчас»: живёт 24 часа (фильтр по created_at).
create table public.wants (
  user_id uuid references public.profiles on delete cascade,
  game_id bigint references public.games on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, game_id)
);

-- Быстрый доступ: игры, которые человек искал или выбирал.
create table public.recent_games (
  user_id uuid references public.profiles on delete cascade,
  game_id bigint references public.games on delete cascade,
  used_at timestamptz not null default now(),
  primary key (user_id, game_id)
);

-- Один человек — одна запись на день (день по его местному времени).
-- status: 'free' — отметил время (slots), 'busy' — нажал «Не могу».
-- Нет записи — «молчит».
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

-- Служебное: id сегодняшнего сообщения в Discord.
create table public.app_state (
  key text primary key,
  value jsonb
);

-- Профиль при первом входе: ник и фото, которые сервер передал из Telegram (api/tg/auth).
-- Фото берём только из Telegram — то же правило, что у проверки аватарки (008_hardening.sql).
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

-- Доступ: всё видят и меняют только участники, своё — только своё.
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

-- Живые обновления на сайте.
alter publication supabase_realtime add table
  public.profiles, public.games, public.wants, public.day_entries, public.members;

-- Аватарки.
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true);
create policy "avatar upload" on storage.objects
  for insert with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatar update" on storage.objects
  for update using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
