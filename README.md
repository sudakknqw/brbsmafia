# brbs mafia

Общее расписание и игры для компании. Next.js + Supabase + Vercel, всё на бесплатных тарифах.

## Запуск: шаг за шагом

### 1. Supabase (база и вход)
1. Зарегистрируйся на [supabase.com](https://supabase.com) → **New project**. Регион — ближе к вам (например, Frankfurt). Пароль базы сохрани.
2. Открой **SQL Editor → New query**, вставь весь файл [`supabase/schema.sql`](supabase/schema.sql) и нажми **Run**.
   Внизу появится `code` — это твоё первое приглашение. Скопируй его.
3. **Project Settings → API**: скопируй `Project URL`, `anon public` и `service_role` ключи.

   Потом так же запусти [`supabase/002_gatherings.sql`](supabase/002_gatherings.sql) — это сессии и итоги месяца, а затем [`supabase/003_game_art.sql`](supabase/003_game_art.sql) — свои картинки для игр.

### 2. Telegram-бот и мини-приложение (вход)
1. В [@BotFather](https://t.me/BotFather): `/newbot` → получишь **токен**. Затем `/newapp` → выбери бота, адрес `https://brbsmafia.vercel.app`, короткое имя `app` → ссылка вида `https://t.me/имя_бота/app`.
2. Добавь бота в вашу группу. В компанию автоматически попадают участники этой группы.
3. В Vercel: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_GROUP_ID` (ID группы, отрицательное число), `NEXT_PUBLIC_TELEGRAM_APP_URL` (ссылка из шага 1) → Redeploy.
4. В Supabase запусти [`supabase/004_telegram.sql`](supabase/004_telegram.sql), затем `supabase/005_reminders.local.sql` (готовая копия с секретом) — это напоминания за час до игры.

### 2.5. Steam (необязательно)
1. Получи ключ на [steamcommunity.com/dev/apikey](https://steamcommunity.com/dev/apikey) (домен — `brbsmafia.vercel.app`).
2. В Supabase запусти [`supabase/006_steam.sql`](supabase/006_steam.sql).
3. В Vercel и `.env.local`: `STEAM_API_KEY` → Redeploy. Каждый при входе вставит ссылку на свой профиль; игры, в которые компания чаще играет, встанут выше. Обновляется раз в сутки.

### 3. Вебхук в канал
В Discord: настройки канала → **Интеграции → Вебхуки → Новый вебхук** → **Копировать URL**.

### 4. Запуск у себя на компьютере
1. Скопируй `.env.example` в `.env.local` и заполни значения.
2. В Supabase: **Authentication → URL Configuration → Redirect URLs** добавь `http://localhost:3000/**`.
3. Выполни:
   ```bash
   npm run dev
   ```
4. Открой `http://localhost:3000/invite/<код из шага 1>`.

### 5. Выкладка на Vercel
1. Залей папку на GitHub (приватный репозиторий).
2. [vercel.com](https://vercel.com) → **Add New → Project** → выбери репозиторий.
3. В **Environment Variables** добавь всё из `.env.local`, но:
   - `NEXT_PUBLIC_SITE_URL` — адрес сайта на Vercel, например `https://brbs-mafia.vercel.app`;
   - `CRON_SECRET` — любая длинная случайная строка.
4. **Deploy**.
5. В Supabase → **URL Configuration**: **Site URL** = адрес сайта, и добавь `https://<адрес-сайта>/**` в **Redirect URLs**.

Готово: открывай `https://<адрес-сайта>/invite/<код>`, входи, а дальше приглашай друзей кнопкой с человечком в шапке.

## Где что менять
- Шуточные подписи для тех, кто молчит: [`src/lib/jokes.ts`](src/lib/jokes.ts).
- Цвета темы: [`src/app/globals.css`](src/app/globals.css).
- Пресеты быстрых кнопок («Сегодня вечером» и т.д.): [`src/app/actions.ts`](src/app/actions.ts), константы `EVENING` и `WEEKEND_EVENING`.
- Когда в Discord начинается новый день: `CREW_TIMEZONE` в переменных и расписание в [`vercel.json`](vercel.json) (сейчас 05:00 UTC = 08:00 по Москве).

## Как устроено
- Всё время в базе хранится в UTC; каждый видит его по часам своего браузера.
- «Игровой день» идёт с 08:00 до 08:00, чтобы ночные посиделки не разрывались.
- Статус «хочу сейчас» — до 3 игр, живёт 24 часа.
- На день можно выбрать до 5 игр.
- Сообщение в Discord одно на день: создаётся утром и правится после каждого изменения на сайте.
