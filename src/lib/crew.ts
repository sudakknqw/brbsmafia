import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import { personalOrder, type DayEntry, type Game, type Gathering, type Member, type Want } from "./types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

import { WANT_TTL_HOURS } from "./limits";
import { HISTORY_DAYS } from "./stats";
import { addDays, gamingDay, weekStart } from "./time";
import type { CrewData } from "./views";
export { WANT_TTL_HOURS, MAX_WANTS, MAX_DAY_GAMES } from "./limits";

// cache: за один запрос страницы пользователь проверяется один раз.
export const getViewer = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId) return { supabase, user: null, profile: null, isMember: false };

  const [{ data: profile }, { data: member }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).single(),
    supabase.from("members").select("user_id").eq("user_id", userId).maybeSingle(),
  ]);
  return { supabase, user: { id: userId }, profile, isMember: !!member };
});

/** Пускает дальше только участника, прошедшего первый вход. */
export async function requireMember() {
  const viewer = await getViewer();
  if (!viewer.user || !viewer.isMember) redirect("/welcome");
  if (!viewer.profile?.onboarded) redirect("/onboarding");
  return viewer as typeof viewer & { user: NonNullable<typeof viewer.user>; profile: Member };
}

export async function loadMembers(supabase: Supabase): Promise<Member[]> {
  const { data } = await supabase
    .from("members")
    .select("joined_at, profiles!members_user_id_fkey(id, name, avatar_url, timezone)")
    .order("joined_at");
  return (data ?? []).map((row) => row.profiles as unknown as Member);
}

export async function loadEntries(supabase: Supabase, from: string, to: string): Promise<DayEntry[]> {
  const { data } = await supabase
    .from("day_entries")
    .select("user_id, day, status, slots, game_ids")
    .gte("day", from)
    .lte("day", to);
  return (data ?? []) as DayEntry[];
}

export async function loadGames(supabase: Supabase): Promise<Game[]> {
  // «*», а не список колонок: так работает и до, и после миграции со своими картинками.
  const { data } = await supabase.from("games").select("*").order("created_at");
  return (data ?? []) as Game[];
}

/** Игры с наигранным временем всей компании. Если миграции 006 ещё нет — просто без него. */
export async function withPlaytime(supabase: Supabase, games: Game[]): Promise<Game[]> {
  const appids = [...new Set(games.flatMap((g) => (g.steam_appid ? [g.steam_appid] : [])))];
  if (!appids.length) return games;

  // PostgREST отдаёт не больше 1000 строк за раз, а библиотеки Steam целиком — это тысячи строк.
  // Берём только игры из нашей библиотеки, без нулевого времени, и листаем страницами.
  const PAGE = 1000;
  const rows: { steam_appid: number; recent_minutes: number; total_minutes: number }[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("steam_playtime")
      .select("steam_appid, recent_minutes, total_minutes")
      .in("steam_appid", appids)
      .gt("total_minutes", 0)
      .order("user_id")
      .order("steam_appid")
      .range(from, from + PAGE - 1);
    if (error) return games;
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  if (!rows.length) return games;

  const sum = new Map<number, { recent: number; total: number }>();
  for (const r of rows) {
    const s = sum.get(r.steam_appid) ?? { recent: 0, total: 0 };
    s.recent += r.recent_minutes;
    s.total += r.total_minutes;
    sum.set(r.steam_appid, s);
  }
  return games.map((g) => {
    const s = g.steam_appid ? sum.get(g.steam_appid) : undefined;
    return s ? { ...g, played_recent: s.recent, played_total: s.total } : g;
  });
}

export async function loadActiveWants(supabase: Supabase): Promise<Want[]> {
  const since = new Date(Date.now() - WANT_TTL_HOURS * 3600_000).toISOString();
  const { data } = await supabase
    .from("wants")
    .select("user_id, game_id, created_at")
    .gte("created_at", since);
  return (data ?? []) as Want[];
}

export async function loadRecentGameIds(supabase: Supabase, userId: string): Promise<number[]> {
  const { data } = await supabase
    .from("recent_games")
    .select("game_id")
    .eq("user_id", userId)
    .order("used_at", { ascending: false })
    .limit(12);
  return (data ?? []).map((r) => r.game_id as number);
}

/** Всё, что нужно экранам, одним заходом: для недели вперёд и дня назад. */
export async function loadCrewData(viewer: Awaited<ReturnType<typeof requireMember>>, from?: string, to?: string): Promise<CrewData> {
  const { supabase, profile: me } = viewer;
  const now = new Date();
  const today = gamingDay(now, me.timezone);
  const rangeFrom = from ?? addDays(weekStart(today), -1);
  const rangeTo = to ?? addDays(weekStart(today), 7);
  const [members, entries, allGames, wants, recentIds, gatherings] = await Promise.all([
    loadMembers(supabase),
    loadEntries(supabase, rangeFrom, rangeTo),
    loadGames(supabase).then((games) => withPlaytime(supabase, games)),
    loadActiveWants(supabase),
    loadRecentGameIds(supabase, me.id),
    loadGatherings(supabase, rangeFrom, rangeTo),
  ]);
  // Игры приходят уже в твоём порядке — так их и показывают библиотека и выбор игр на день.
  const games = personalOrder(allGames, me.library_order);
  const recent = recentIds.map((id) => games.find((g) => g.id === id)).filter((g): g is Game => !!g);
  const fallbackGameId = games.length ? games[Math.floor(Math.random() * games.length)].id : null;
  return { me, members, entries, games, wants, recent, gatherings, fallbackGameId, now, today };
}

/** Сборы за период. Если таблиц ещё нет (миграцию не запускали) — просто пусто. */
export async function loadGatherings(supabase: Supabase, from: string, to: string): Promise<Gathering[]> {
  const { data, error } = await supabase
    .from("gatherings")
    .select("id, day, starts_at, ends_at, game_id, game_name, created_by, members:gathering_members(user_id, status)")
    .gte("day", from)
    .lte("day", to);
  if (error) return [];
  return (data ?? []) as Gathering[];
}

/** Данные для итогов месяца: всё отмеченное и все сборы с начала месяца. */
export async function loadMonth(supabase: Supabase, today: string) {
  const monthStart = today.slice(0, 8) + "01";
  const [entries, gatherings, history] = await Promise.all([
    loadEntries(supabase, monthStart, today),
    loadGatherings(supabase, monthStart, today),
    // Для «лучшего дня недели»: 8 недель назад (и день сверху — время может перетекать через полночь).
    loadEntries(supabase, addDays(today, -HISTORY_DAYS - 1), today),
  ]);
  return { monthStart, entries, gatherings, history };
}
