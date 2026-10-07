"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getViewer, MAX_DAY_GAMES, MAX_WANTS, WANT_TTL_HOURS } from "@/lib/crew";
import { syncDiscord } from "@/lib/discord";
import { addDays, gamingDay, hoursToSlots, isValidTimezone, slotsToHours, weekdayIndex } from "@/lib/time";
import type { DayEntry } from "@/lib/types";

async function member() {
  const viewer = await getViewer();
  if (!viewer.user || !viewer.isMember || !viewer.profile) throw new Error("Нет доступа");
  return { supabase: viewer.supabase, userId: viewer.user.id, tz: viewer.profile.timezone as string };
}

function changed() {
  revalidatePath("/", "layout");
  after(() => syncDiscord().catch((e) => console.error(e)));
}

const isDay = (day: string) => /^\d{4}-\d{2}-\d{2}$/.test(day);

async function touchRecent(supabase: Awaited<ReturnType<typeof member>>["supabase"], userId: string, gameIds: number[]) {
  if (!gameIds.length) return;
  const now = new Date().toISOString();
  await supabase
    .from("recent_games")
    .upsert(gameIds.map((game_id) => ({ user_id: userId, game_id, used_at: now })));
}

// ——— Время ———

export async function saveDay(day: string, hours: number[], gameIds: number[]) {
  if (!isDay(day)) return;
  const { supabase, userId, tz } = await member();
  const games = [...new Set(gameIds)].slice(0, MAX_DAY_GAMES);

  if (!hours.length) {
    await supabase.from("day_entries").delete().eq("user_id", userId).eq("day", day);
  } else {
    await supabase.from("day_entries").upsert({
      user_id: userId,
      day,
      status: "free",
      slots: hoursToSlots(day, hours, tz),
      game_ids: games,
      updated_at: new Date().toISOString(),
    });
    await touchRecent(supabase, userId, games);
  }
  changed();
}

export async function setBusy(day: string) {
  if (!isDay(day)) return;
  const { supabase, userId } = await member();
  await supabase.from("day_entries").upsert({
    user_id: userId,
    day,
    status: "busy",
    slots: [],
    game_ids: [],
    updated_at: new Date().toISOString(),
  });
  changed();
}

export async function clearDay(day: string) {
  if (!isDay(day)) return;
  const { supabase, userId } = await member();
  await supabase.from("day_entries").delete().eq("user_id", userId).eq("day", day);
  changed();
}

// Часы игрового дня: 0 = 08:00, 11 = 19:00, 16 = 00:00.
const EVENING = [11, 12, 13, 14, 15]; // 19:00–00:00
const WEEKEND_EVENING = [10, 11, 12, 13, 14, 15, 16]; // 18:00–01:00

export async function quickFill(kind: "today" | "tomorrow" | "weekend") {
  const { supabase, userId, tz } = await member();
  const today = gamingDay(new Date(), tz);

  let plan: { day: string; hours: number[] }[];
  if (kind === "today") plan = [{ day: today, hours: EVENING }];
  else if (kind === "tomorrow") plan = [{ day: addDays(today, 1), hours: EVENING }];
  else {
    const days = Array.from({ length: 7 }, (_, i) => addDays(today, i)).filter((d) =>
      [0, 6].includes(weekdayIndex(d)),
    );
    // В воскресенье «выходные» — только сегодня, а не следующая неделя.
    const weekend = weekdayIndex(today) === 0 ? [today] : days.slice(0, 2);
    plan = weekend.map((day) => ({ day, hours: WEEKEND_EVENING }));
  }

  const { data } = await supabase
    .from("day_entries")
    .select("user_id, day, status, slots, game_ids")
    .eq("user_id", userId)
    .in("day", plan.map((p) => p.day));
  const existing = (data ?? []) as DayEntry[];

  await supabase.from("day_entries").upsert(
    plan.map(({ day, hours }) => {
      const prev = existing.find((e) => e.day === day);
      const prevHours = prev?.status === "free" ? slotsToHours(day, prev.slots, tz) : [];
      return {
        user_id: userId,
        day,
        status: "free",
        slots: hoursToSlots(day, [...prevHours, ...hours], tz),
        game_ids: prev?.game_ids ?? [],
        updated_at: new Date().toISOString(),
      };
    }),
  );
  changed();
}

// ——— Игры ———

export async function toggleWant(gameId: number) {
  const { supabase, userId } = await member();
  const since = Date.now() - WANT_TTL_HOURS * 3600_000;

  const { data } = await supabase.from("wants").select("game_id, created_at").eq("user_id", userId);
  const rows = data ?? [];
  const expired = rows.filter((r) => new Date(r.created_at).getTime() < since).map((r) => r.game_id);
  const active = rows
    .filter((r) => new Date(r.created_at).getTime() >= since)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  if (active.some((r) => r.game_id === gameId)) {
    await supabase.from("wants").delete().eq("user_id", userId).eq("game_id", gameId);
  } else {
    // Больше трёх нельзя: самая старая хотелка уступает место.
    const drop = [...expired, ...active.slice(0, Math.max(0, active.length - MAX_WANTS + 1)).map((r) => r.game_id)];
    if (drop.length) await supabase.from("wants").delete().eq("user_id", userId).in("game_id", drop);
    await supabase.from("wants").insert({ user_id: userId, game_id: gameId });
    await touchRecent(supabase, userId, [gameId]);
  }
  changed();
}

export async function addGame(input: { steamAppId?: number; name: string }): Promise<number | null> {
  const { supabase, userId } = await member();
  const name = input.name.trim().slice(0, 80);
  if (!name) return null;

  let id: number | null = null;
  if (input.steamAppId) {
    const { data } = await supabase.from("games").select("id").eq("steam_appid", input.steamAppId).maybeSingle();
    id = data?.id ?? null;
  } else {
    const { data } = await supabase.from("games").select("id").ilike("name", name).is("steam_appid", null).maybeSingle();
    id = data?.id ?? null;
  }
  if (!id) {
    const { data, error } = await supabase
      .from("games")
      .insert({ steam_appid: input.steamAppId ?? null, name, added_by: userId })
      .select("id")
      .single();
    if (error) return null;
    id = data.id;
  }
  await touchRecent(supabase, userId, [id!]);
  changed();
  return id;
}

export async function deleteGame(gameId: number) {
  const { supabase } = await member();
  await supabase.from("games").delete().eq("id", gameId);
  changed();
}

// ——— Профиль и приглашения ———

export async function updateProfile(input: { name: string; avatarUrl?: string | null }) {
  const viewer = await getViewer();
  if (!viewer.user || !viewer.isMember) throw new Error("Нет доступа");
  const name = input.name.trim().slice(0, 32);
  if (!name) return { error: "Введи ник" };
  const patch: Record<string, unknown> = { name, onboarded: true };
  if (input.avatarUrl !== undefined) patch.avatar_url = input.avatarUrl;
  await viewer.supabase.from("profiles").update(patch).eq("id", viewer.user.id);
  changed();
  return { error: null };
}

export async function syncTimezone(tz: string) {
  const viewer = await getViewer();
  if (!viewer.user || !isValidTimezone(tz) || viewer.profile?.timezone === tz) return false;
  await viewer.supabase.from("profiles").update({ timezone: tz }).eq("id", viewer.user.id);
  revalidatePath("/", "layout");
  return true;
}

export async function createInvite(): Promise<string> {
  const { supabase, userId } = await member();
  const { data, error } = await supabase.from("invites").insert({ created_by: userId }).select("code").single();
  if (error) throw error;
  return data.code;
}

export async function signOut() {
  const viewer = await getViewer();
  await viewer.supabase.auth.signOut();
  redirect("/welcome");
}
