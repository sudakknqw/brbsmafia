import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import type { DayEntry, Game, Member, Want } from "./types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

import { WANT_TTL_HOURS } from "./limits";
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
  const { data } = await supabase.from("games").select("id, steam_appid, name").order("created_at");
  return (data ?? []) as Game[];
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
  const [members, entries, games, wants, recentIds] = await Promise.all([
    loadMembers(supabase),
    loadEntries(supabase, from ?? addDays(weekStart(today), -1), to ?? addDays(weekStart(today), 7)),
    loadGames(supabase),
    loadActiveWants(supabase),
    loadRecentGameIds(supabase, me.id),
  ]);
  const recent = recentIds.map((id) => games.find((g) => g.id === id)).filter((g): g is Game => !!g);
  return { me, members, entries, games, wants, recent, now, today };
}
