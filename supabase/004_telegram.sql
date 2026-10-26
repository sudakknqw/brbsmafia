-- brbs mafia: moving to a Telegram Mini App.
-- Run once in Supabase → SQL Editor → New query → Run.

-- Who is who in Telegram: the Mini App recognises people by this ID.
alter table public.profiles add column if not exists telegram_id bigint unique;

-- Which one-hour reminders were already sent, so nothing goes out twice.
create table if not exists public.reminders_sent (
  key text primary key,
  sent_at timestamptz not null default now()
);
alter table public.reminders_sent enable row level security; -- server-only access
