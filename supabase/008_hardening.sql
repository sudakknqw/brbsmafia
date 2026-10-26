-- brbs mafia: hardening.
-- Run once in Supabase → SQL Editor → New query → Run (safe to re-run).
--
-- What it does:
-- 1) with their own browser session a person may only change their name, avatar,
--    onboarding flag and time zone in the profile (telegram_id and steam_id are written by the server only);
-- 2) avatars only from our storage, from Telegram, or a legacy Discord one
--    (only new writes are checked, existing rows are left alone);
-- 3) size and type limits for files in the avatars and games buckets;
-- 4) the personal library order moves from profiles to a separate library_order table:
--    profiles is broadcast to everyone in realtime, and every game drag
--    re-rendered the app for the whole crew.

-- 1. Which profile columns a user session may change.
revoke update on public.profiles from anon, authenticated;
grant update (name, avatar_url, onboarded, timezone) on public.profiles to authenticated;

-- 2. Where an avatar may come from. NOT VALID: existing rows aren't checked, only new writes.
alter table public.profiles drop constraint if exists profiles_avatar_url_check;
alter table public.profiles add constraint profiles_avatar_url_check check (
  avatar_url is null
  or avatar_url ~ '^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/avatars/'
  or avatar_url like 'https://t.me/i/userpic/%'
  or avatar_url like 'https://cdn.discordapp.com/%'
) not valid;

-- 3. Storage limits. Avatars are uploaded as is, up to 3 MB in the browser (5 MB here for margin, no SVG);
-- game art is shrunk by the browser to JPEG/PNG of at most 1920×620 (8 MB here for margin).
update storage.buckets
set file_size_limit = 5 * 1024 * 1024,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/heic', 'image/heif']
where id = 'avatars';

update storage.buckets
set file_size_limit = 8 * 1024 * 1024,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'games';

-- 4. Personal library order: game ids in order. Games not in the list go last.
-- The table is NOT added to realtime (supabase_realtime): the order only matters to its owner.
create table if not exists public.library_order (
  user_id uuid primary key references public.profiles on delete cascade,
  game_ids bigint[] not null default '{}',
  updated_at timestamptz not null default now()
);
alter table public.library_order enable row level security;
grant select, insert, update on public.library_order to authenticated;

drop policy if exists "own library order read" on public.library_order;
create policy "own library order read" on public.library_order
  for select using (user_id = auth.uid());
drop policy if exists "own library order insert" on public.library_order;
create policy "own library order insert" on public.library_order
  for insert with check (public.is_member() and user_id = auth.uid());
drop policy if exists "own library order update" on public.library_order;
create policy "own library order update" on public.library_order
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Move already saved orders over from profiles (007_library_order.sql) and drop the old column.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'library_order'
  ) then
    insert into public.library_order (user_id, game_ids)
    select id, library_order from public.profiles where cardinality(library_order) > 0
    on conflict (user_id) do nothing;
    alter table public.profiles drop column library_order;
  end if;
end $$;
