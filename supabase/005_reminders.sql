-- brbs mafia: напоминания за час — планировщик Supabase раз в 10 минут дёргает сайт.
-- Запускать один раз в Supabase → SQL Editor → New query → Run,
-- предварительно заменив ВСТАВЬ_CRON_SECRET на значение CRON_SECRET из Vercel.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'brbs-remind',
  '*/10 * * * *',
  $$
  select net.http_get(
    url := 'https://brbsmafia.vercel.app/api/tg/remind',
    headers := jsonb_build_object('Authorization', 'Bearer ВСТАВЬ_CRON_SECRET')
  );
  $$
);
