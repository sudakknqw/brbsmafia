"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { crewTimezone } from "@/lib/crewTime";
import { getViewer, loadEntries, loadGames, loadMembers, withPlaytime, MAX_DAY_GAMES, MAX_WANTS, WANT_TTL_HOURS } from "@/lib/crew";
import { deleteGatheringMessage, syncDiscord, syncGatheringMessage } from "@/lib/discord";
import { dayStats } from "@/lib/overlap";
import { addSharedGames, dismissSteamGame, resolveSteamId, steamConfigured, syncSteamPlaytime } from "@/lib/steamApi";
import { addDays, DAY_HOURS, gamingDay, hourStart, hoursToSlots, isValidTimezone, slotsToHours, weekdayIndex } from "@/lib/time";
import { personalOrder, type DayEntry } from "@/lib/types";

async function member() {
  const viewer = await getViewer();
  if (!viewer.user || !viewer.isMember || !viewer.profile) throw new Error("Нет доступа");
  return { supabase: viewer.supabase, userId: viewer.user.id, tz: viewer.profile.timezone as string };
}

function changed() {
  revalidatePath("/", "layout");
  after(() => syncDiscord().catch((e) => console.error(e)));
}

// Действия может вызвать любой участник с произвольным JSON: типы TypeScript тут ничего не гарантируют.
const isDay = (day: string) => typeof day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(day);
const isId = (id: unknown): id is number => Number.isSafeInteger(id) && (id as number) > 0;

/** Часы игрового дня: только целые 0..23, без повторов, по порядку. */
const cleanHours = (hours: unknown): number[] =>
  Array.isArray(hours)
    ? [...new Set(hours.filter((h): h is number => Number.isInteger(h) && h >= 0 && h < DAY_HOURS))].sort((a, b) => a - b)
    : [];

/**
 * Аватарка — только своя картинка из нашего хранилища, фото из Telegram или та, что уже стоит
 * (у старых аккаунтов может быть, например, ссылка Discord — её не ломаем).
 */
function avatarAllowed(url: unknown, current: string | null | undefined, userId: string) {
  if (url === null) return true;
  if (typeof url !== "string") return false;
  if (url === current) return true;
  return (
    url.startsWith(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${userId}/`) ||
    url.startsWith("https://t.me/i/userpic/")
  );
}

async function touchRecent(supabase: Awaited<ReturnType<typeof member>>["supabase"], userId: string, gameIds: number[]) {
  if (!gameIds.length) return;
  const now = new Date().toISOString();
  await supabase
    .from("recent_games")
    .upsert(gameIds.map((game_id) => ({ user_id: userId, game_id, used_at: now })));
}

/**
 * Выбранные игры поднимаются в твоём порядке на одно место:
 * то, что выбираешь чаще, постепенно всплывает наверх библиотеки.
 */
async function bumpGames(supabase: Awaited<ReturnType<typeof member>>["supabase"], userId: string, gameIds: number[]) {
  if (!gameIds.length) return;
  const [{ data: profile, error }, games] = await Promise.all([
    supabase.from("profiles").select("library_order").eq("id", userId).maybeSingle(),
    loadGames(supabase).then((g) => withPlaytime(supabase, g)),
  ]);
  if (error || !profile) return; // миграции 007 ещё нет
  const ids = personalOrder(games, profile.library_order ?? []).map((g) => g.id);
  for (const id of gameIds) {
    const i = ids.indexOf(id);
    if (i > 0) [ids[i - 1], ids[i]] = [ids[i], ids[i - 1]];
  }
  await supabase.from("profiles").update({ library_order: ids }).eq("id", userId);
}

/** Свой порядок библиотеки после перетаскивания. */
export async function saveLibraryOrder(ids: number[]) {
  const { supabase, userId } = await member();
  const clean = [...new Set(ids.map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 1000);
  await supabase.from("profiles").update({ library_order: clean }).eq("id", userId);
  revalidatePath("/", "layout");
}

// ——— Время ———

export async function saveDay(day: string, hours: number[], gameIds: number[]) {
  if (!isDay(day)) return;
  const { supabase, userId, tz } = await member();
  const free = cleanHours(hours);
  const games = Array.isArray(gameIds) ? [...new Set(gameIds.filter(isId))].slice(0, MAX_DAY_GAMES) : [];
  // Поднимаем только впервые выбранные на этот день: пересохранение тех же игр не считается.
  const { data: before } = await supabase.from("day_entries").select("game_ids").eq("user_id", userId).eq("day", day).maybeSingle();
  const added = games.filter((id) => !(before?.game_ids ?? []).includes(id));

  if (!free.length) {
    await supabase.from("day_entries").delete().eq("user_id", userId).eq("day", day);
  } else {
    await supabase.from("day_entries").upsert({
      user_id: userId,
      day,
      status: "free",
      slots: hoursToSlots(day, free, tz),
      game_ids: games,
      updated_at: new Date().toISOString(),
    });
    await touchRecent(supabase, userId, games);
    after(() => bumpGames(supabase, userId, added).catch((e) => console.error(e)));
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
  if (!isId(gameId)) return;
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
    after(() => bumpGames(supabase, userId, [gameId]).catch((e) => console.error(e)));
  }
  changed();
}

export async function addGame(input: { steamAppId?: number; name: string }): Promise<number | null> {
  if (typeof input?.name !== "string") return null;
  if (input.steamAppId != null && !isId(input.steamAppId)) return null;
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

const ART_FIELDS = ["cover_url", "hero_url", "header_url", "logo_url"] as const;
type ArtField = (typeof ART_FIELDS)[number];

const artRoot = () => `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/games/`;

/**
 * Своя картинка игры (или null — вернуть картинку из Steam). Только из нашего хранилища.
 * Прошлая своя картинка этой игры удаляется из хранилища — чтобы не копились.
 */
export async function setGameArt(gameId: number, field: ArtField, url: string | null) {
  if (!isId(gameId)) return;
  const { supabase } = await member();
  if (!ART_FIELDS.includes(field)) return;
  const folder = `${artRoot()}${gameId}/`;
  // Только файл прямо в папке этой игры (вида cover-1760000000000.webp): без «..» и вложенных путей,
  // иначе через замену картинки можно было бы удалить чужую (удаление идёт служебным ключом).
  if (url !== null && (typeof url !== "string" || !url.startsWith(folder) || !/^[a-z]+-\d+\.[a-z0-9]+$/.test(url.slice(folder.length)))) return;

  const { data: before } = await supabase.from("games").select(field).eq("id", gameId).maybeSingle<Record<ArtField, string | null>>();
  const { error } = await supabase.from("games").update({ [field]: url }).eq("id", gameId);
  if (error) return;

  const old = before?.[field];
  // Удаляем служебным ключом: правила хранилища не дают обычному входу удалять без права чтения списка.
  // Путь проверен выше — это старая картинка именно этой игры.
  if (old && old !== url && old.startsWith(folder)) {
    await createAdminClient().storage.from("games").remove([old.slice(artRoot().length)]);
  }
  changed();
}

/** Убрать игру у всех — вместе с её папкой своих картинок. */
export async function deleteGame(gameId: number) {
  if (!isId(gameId)) return;
  const { supabase } = await member();
  const { data: game } = await supabase.from("games").select("steam_appid").eq("id", gameId).maybeSingle();
  const { error } = await supabase.from("games").delete().eq("id", gameId);
  if (error) return;
  // Удалённую игру Steam не добавляем обратно автоматически.
  if (game?.steam_appid) await dismissSteamGame(game.steam_appid);
  const bucket = createAdminClient().storage.from("games");
  const { data: files } = await bucket.list(String(gameId));
  if (files?.length) await bucket.remove(files.map((f) => `${gameId}/${f.name}`));
  changed();
}

// ——— Сборы пати ———

/**
 * Собрать пати одним нажатием: на лучшее окно дня и выбранную игру.
 * В Discord уходит сообщение с упоминанием всех, кто свободен в это окно.
 */
export async function startGathering(day: string, gameId: number): Promise<{ error: string | null }> {
  if (!isDay(day)) return { error: "Неверный день" };
  if (!isId(gameId)) return { error: "Такой игры нет в библиотеке" };
  const { supabase, userId, tz } = await member();


  const [members, entries, { data: game }] = await Promise.all([
    loadMembers(supabase),
    loadEntries(supabase, addDays(day, -1), addDays(day, 1)),
    supabase.from("games").select("id, name").eq("id", gameId).maybeSingle(),
  ]);
  const { best, freeHours } = dayStats(day, tz, members, entries);
  if (!best) return { error: "Пока никто не совпал по времени" };

  // Один сбор на окно: если кто-то уже собирает на это же время — не дублируем.
  const startsAt = hourStart(day, best.from, tz);
  const endsAt = hourStart(day, best.to, tz);
  const { data: overlapping } = await supabase
    .from("gatherings")
    .select("id")
    .lt("starts_at", endsAt.toISOString())
    .gt("ends_at", startsAt.toISOString())
    .limit(1);
  if (overlapping?.length) return { error: "На это время уже есть сессия" };
  if (!game) return { error: "Такой игры нет в библиотеке" };

  const { data: created, error } = await supabase
    .from("gatherings")
    .insert({
      // Окно считали по твоим часам, но день сессии — по часам компании, как и из кнопки в Telegram.
      day: gamingDay(startsAt, crewTimezone()),
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      game_id: game.id,
      game_name: game.name,
      created_by: userId,
    })
    .select("id")
    .single();
  if (error) {
    // day уникален: на этот игровой день компании уже есть сбор (другое окно).
    return { error: error.code === "23505" ? "На этот день уже есть сессия" : "Не получилось начать сессию. Попробуй ещё раз." };
  }

  await supabase.from("gathering_members").insert({ gathering_id: created.id, user_id: userId, status: "in" });
  const free = members.filter((m) => m.id !== userId && (freeHours.get(m.id) ?? []).includes(best.from)).map((m) => m.id);
  revalidatePath("/", "layout");
  after(() => syncGatheringMessage(created.id, free).catch((e) => console.error(e)));
  return { error: null };
}

/** «В деле», «Не пойду» или снять отметку (null). */
export async function setGatheringStatus(gatheringId: number, status: "in" | "out" | null) {
  if (!isId(gatheringId) || (status !== "in" && status !== "out" && status !== null)) return;
  const { supabase, userId } = await member();
  if (status) {
    await supabase
      .from("gathering_members")
      .upsert({ gathering_id: gatheringId, user_id: userId, status, updated_at: new Date().toISOString() });
  } else {
    await supabase.from("gathering_members").delete().eq("gathering_id", gatheringId).eq("user_id", userId);
  }
  revalidatePath("/", "layout");
  after(() => syncGatheringMessage(gatheringId).catch((e) => console.error(e)));
}

/** Отменить может только тот, кто собирал. */
export async function cancelGathering(gatheringId: number) {
  if (!isId(gatheringId)) return;
  const { supabase, userId } = await member();
  const { data } = await supabase
    .from("gatherings")
    .select("discord_message_id")
    .eq("id", gatheringId)
    .eq("created_by", userId)
    .maybeSingle();
  if (!data) return;
  await supabase.from("gatherings").delete().eq("id", gatheringId);
  revalidatePath("/", "layout");
  after(() => deleteGatheringMessage(data.discord_message_id).catch((e) => console.error(e)));
}

// ——— Профиль и приглашения ———

export async function updateProfile(input: { name: string; avatarUrl?: string | null }) {
  const viewer = await getViewer();
  if (!viewer.user || !viewer.isMember) throw new Error("Нет доступа");
  const name = typeof input?.name === "string" ? input.name.trim().slice(0, 32) : "";
  if (!name) return { error: "Введи ник" };
  const patch: Record<string, unknown> = { name, onboarded: true };
  if (input.avatarUrl !== undefined) {
    if (!avatarAllowed(input.avatarUrl, viewer.profile?.avatar_url, viewer.user.id)) {
      return { error: "Эта картинка не подходит для аватарки" };
    }
    patch.avatar_url = input.avatarUrl;
  }
  await viewer.supabase.from("profiles").update(patch).eq("id", viewer.user.id);
  changed();
  return { error: null };
}

/** Ссылка на свой профиль Steam: по ней узнаём, во что компания чаще играет. */
export async function setSteamProfile(link: string): Promise<{ error: string | null; warning?: string }> {
  const { userId } = await member();
  if (!steamConfigured()) return { error: "Steam ещё не подключён к сайту" };
  const steamId = await resolveSteamId(link);
  if (!steamId) return { error: "Не нашёл такой профиль. Скопируй ссылку со страницы своего профиля в Steam" };

  const { error } = await createAdminClient().from("profiles").update({ steam_id: steamId }).eq("id", userId);
  if (error) return { error: "Не получилось сохранить. Попробуй ещё раз" };
  const sync = await syncSteamPlaytime(userId, steamId);
  revalidatePath("/", "layout");
  // Общие с компанией игры добавляются в фоне: проверка в магазине Steam занимает время.
  // Открытые страницы подхватят их сами (LiveSync следит за таблицей игр).
  if (sync === "ok") after(() => addSharedGames().catch((e) => console.error(e)));
  if (sync === "private")
    return { error: null, warning: "Профиль сохранён, но игры в нём скрыты. В Steam: Профиль → Редактировать → Приватность → «Игровая информация»: Открытая" };
  return { error: null };
}

export async function syncTimezone(tz: string) {
  const viewer = await getViewer();
  if (!viewer.user || !isValidTimezone(tz) || viewer.profile?.timezone === tz) return false;
  await viewer.supabase.from("profiles").update({ timezone: tz }).eq("id", viewer.user.id);
  revalidatePath("/", "layout");
  return true;
}
