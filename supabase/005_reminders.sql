-- brbs mafia: one-hour reminders; the Supabase scheduler calls the site every 10 minutes.
-- Run once in Supabase → SQL Editor → New query → Run,
-- after replacing PASTE_CRON_SECRET with the CRON_SECRET value from Vercel.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'brbs-remind',
  '*/10 * * * *',
  $$
  select net.http_get(
    url := 'https://brbsmafia.vercel.app/api/tg/remind',
    headers := jsonb_build_object('Authorization', 'Bearer PASTE_CRON_SECRET')
  );
  $$
);
