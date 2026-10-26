-- brbs mafia: cleanup after moving to Telegram login.
-- Run once in Supabase → SQL Editor → New query → Run (safe to re-run).
--
-- What it does: removes invites (login is now for Telegram group members only),
-- and the profile is filled on first login without Discord.
-- discord_id is kept: the bot uses it to mention people (@name) in the Discord session message.

drop table if exists public.invites cascade;

-- Profile on first login: name and photo the server passed from Telegram (api/tg/auth).
-- Photos only from Telegram: the same rule as the avatar check (008_hardening.sql).
create or replace function public.handle_new_user() returns trigger
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
