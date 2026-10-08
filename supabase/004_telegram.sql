-- brbs mafia: переезд в Telegram Mini App.
-- Запускать один раз в Supabase → SQL Editor → New query → Run.

-- Кто есть кто в Telegram: по этому ID мини-приложение узнаёт человека.
alter table public.profiles add column if not exists telegram_id bigint unique;

-- Какие напоминания «за час» уже ушли — чтобы не слать дважды.
create table if not exists public.reminders_sent (
  key text primary key,
  sent_at timestamptz not null default now()
);
alter table public.reminders_sent enable row level security; -- доступ только у сервера
