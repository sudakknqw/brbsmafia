-- brbs mafia: закручиваем гайки.
-- Запускать один раз в Supabase → SQL Editor → New query → Run (повторный запуск безопасен).
--
-- Что делает:
-- 1) через свою сессию в браузере человек может менять в профиле только ник, аватарку,
--    «прошёл первый вход» и часовой пояс (telegram_id и steam_id пишет только сервер);
-- 2) аватарка — только из нашего хранилища, из Telegram или старая из Discord
--    (проверяются новые записи, старые строки не трогаем);
-- 3) лимиты на размер и тип файлов в хранилищах avatars и games;
-- 4) свой порядок библиотеки переезжает из profiles в отдельную таблицу library_order:
--    profiles транслируется всем в реальном времени, и каждое перетаскивание игры
--    перерисовывало приложение у всей компании.

-- 1. Какие колонки профиля можно менять своей сессией.
revoke update on public.profiles from anon, authenticated;
grant update (name, avatar_url, onboarded, timezone) on public.profiles to authenticated;

-- 2. Откуда может быть аватарка. NOT VALID: старые строки не проверяются, только новые записи.
alter table public.profiles drop constraint if exists profiles_avatar_url_check;
alter table public.profiles add constraint profiles_avatar_url_check check (
  avatar_url is null
  or avatar_url ~ '^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/avatars/'
  or avatar_url like 'https://t.me/i/userpic/%'
  or avatar_url like 'https://cdn.discordapp.com/%'
) not valid;

-- 3. Лимиты хранилищ. Аватарка в браузере — до 3 МБ как есть (берём с запасом 5 МБ, без SVG);
-- картинки игр браузер сам ужимает до JPEG/PNG не больше 1920×620 (берём с запасом 8 МБ).
update storage.buckets
set file_size_limit = 5 * 1024 * 1024,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/heic', 'image/heif']
where id = 'avatars';

update storage.buckets
set file_size_limit = 8 * 1024 * 1024,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'games';

-- 4. Свой порядок игр в библиотеке: id игр по порядку. Игр не из списка — в конце.
-- В живые обновления (supabase_realtime) таблицу НЕ добавляем: порядок нужен только себе.
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

-- Переносим уже сохранённые порядки из profiles (007_library_order.sql) и убираем старую колонку.
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
