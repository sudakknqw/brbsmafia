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

// cache: the user is checked once per page request.
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

/** Lets through only members who finished onboarding. */
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
  // "*" rather than a column list: works both before and after the notes migration.
  const { data } = await supabase
    .from("day_entries")
    .select("*")
    .gte("day", from)
    .lte("day", to);
  return (data ?? []) as DayEntry[];
}

export async function loadGames(supabase: Supabase): Promise<Game[]> {
  // "*" rather than a column list: works both before and after the custom art migration.
  const { data } = await supabase.from("games").select("*").order("created_at");
  return (data ?? []) as Game[];
}

/** Games with the whole crew's playtime. If migration 006 isn't applied yet, just without it. */
export async function withPlaytime(supabase: Supabase, games: Game[]): Promise<Game[]> {
  const appids = [...new Set(games.flatMap((g) => (g.steam_appid ? [g.steam_appid] : [])))];
  if (!appids.length) return games;

  // PostgREST returns at most 1000 rows per request, and full Steam libraries are thousands of rows.
  // Only take games from our library with non-zero playtime, and page through them.
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

/**
 * Personal library order (008_hardening.sql). null means it couldn't be read
 * (e.g. the migration hasn't run yet); then the default order is used.
 */
export async function loadLibraryOrder(supabase: Supabase, userId: string): Promise<number[] | null> {
  const { data, error } = await supabase.from("library_order").select("game_ids").eq("user_id", userId).maybeSingle();
  if (error) return null;
  return ((data?.game_ids ?? []) as (number | string)[]).map(Number);
}

/** Everything the screens need in one go: a week ahead and a day back. */
export async function loadCrewData(viewer: Awaited<ReturnType<typeof requireMember>>, from?: string, to?: string): Promise<CrewData> {
  const { supabase, profile: me } = viewer;
  const now = new Date();
  const today = gamingDay(now, me.timezone);
  const rangeFrom = from ?? addDays(weekStart(today), -1);
  const rangeTo = to ?? addDays(weekStart(today), 7);
  const [members, entries, allGames, wants, recentIds, gatherings, order] = await Promise.all([
    loadMembers(supabase),
    loadEntries(supabase, rangeFrom, rangeTo),
    loadGames(supabase).then((games) => withPlaytime(supabase, games)),
    loadActiveWants(supabase),
    loadRecentGameIds(supabase, me.id),
    loadGatherings(supabase, rangeFrom, rangeTo),
    loadLibraryOrder(supabase, me.id),
  ]);
  // Games already come in your order; the library and the day's game picker show them that way.
  const games = personalOrder(allGames, order ?? []);
  const recent = recentIds.map((id) => games.find((g) => g.id === id)).filter((g): g is Game => !!g);
  const fallbackGameId = games.length ? games[Math.floor(Math.random() * games.length)].id : null;
  return { me, members, entries, games, wants, recent, gatherings, fallbackGameId, now, today };
}

/**
 * Sessions for a period. If the tables don't exist yet (migration not run), just empty.
 * A session's day is the gaming day in the crew time zone and may be the neighbouring day for a viewer,
 * so the period has a day of margin and sessions are matched to days by starts_at (gatheringView).
 */
export async function loadGatherings(supabase: Supabase, from: string, to: string): Promise<Gathering[]> {
  const { data, error } = await supabase
    .from("gatherings")
    .select("id, day, starts_at, ends_at, game_id, game_name, created_by, members:gathering_members(user_id, status)")
    .gte("day", from)
    .lte("day", to);
  if (error) return [];
  return (data ?? []) as Gathering[];
}

/** Data for the monthly stats: all marked time and all sessions since the start of the month. */
export async function loadMonth(supabase: Supabase, today: string) {
  const monthStart = today.slice(0, 8) + "01";
  const [entries, gatherings, history] = await Promise.all([
    loadEntries(supabase, monthStart, today),
    loadGatherings(supabase, monthStart, today),
    // For the "best weekday" card: 8 weeks back (plus a day on top, since time can spill past midnight).
    loadEntries(supabase, addDays(today, -HISTORY_DAYS - 1), today),
  ]);
  return { monthStart, entries, gatherings, history };
}
