-- brbs mafia: свои картинки для игр (обложка, арт, шапка, логотип).
-- Запускать один раз в Supabase → SQL Editor → New query → Run.

alter table public.games
  add column if not exists cover_url text,  -- вертикальная обложка 600×900
  add column if not exists hero_url text,   -- широкий арт 1920×620
  add column if not exists header_url text, -- шапка 460×215
  add column if not exists logo_url text;   -- логотип на прозрачном фоне

-- Менять картинки может любой участник: все в компании равны.
create policy "members edit games" on public.games
  for update using (public.is_member()) with check (public.is_member());

insert into storage.buckets (id, name, public) values ('games', 'games', true)
on conflict (id) do nothing;

create policy "members upload game art" on storage.objects
  for insert with check (bucket_id = 'games' and public.is_member());
create policy "members replace game art" on storage.objects
  for update using (bucket_id = 'games' and public.is_member());
create policy "members delete game art" on storage.objects
  for delete using (bucket_id = 'games' and public.is_member());
