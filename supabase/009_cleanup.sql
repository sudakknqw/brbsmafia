-- brbs mafia: уборка после переезда на вход через Telegram.
-- Запускать один раз в Supabase → SQL Editor → New query → Run (повторный запуск безопасен).
--
-- Что делает: убирает приглашения (вход теперь только для участников группы в Telegram),
-- профиль при первом входе заполняется без Discord.
-- Колонку discord_id оставляем: по ней бот упоминает людей (@ник) в Discord-сообщении о сессии.

drop table if exists public.invites cascade;

-- Профиль при первом входе: ник и фото, которые сервер передал из Telegram (api/tg/auth).
-- Фото берём только из Telegram — то же правило, что у проверки аватарки (008_hardening.sql).
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
