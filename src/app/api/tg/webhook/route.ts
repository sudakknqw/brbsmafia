import { after, NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { loadEntries, loadMembers } from "@/lib/crew";
import { syncDiscord, syncGatheringMessage } from "@/lib/discord";
import { dayStats } from "@/lib/overlap";
import { createAdminClient } from "@/lib/supabase/admin";
import { answerCallback, editKeyboard, webhookSecret } from "@/lib/telegram";
import { addDays, gamingDay, hourStart } from "@/lib/time";

type Db = ReturnType<typeof createAdminClient>;
type RawButton = { text: string; callback_data?: string; web_app?: { url: string } };
type CallbackQuery = {
  id: string;
  from: { id: number };
  data?: string;
  message?: { message_id: number; chat: { id: number }; reply_markup?: { inline_keyboard: RawButton[][] } };
};

const HOUR = 3600_000;

/**
 * Нажатия кнопок под сообщениями бота:
 *  s:in|out:<id сессии>               — «Иду» / «Без меня» в напоминании о сессии;
 *  w:in|out:<unix начала>:<id игры>  — то же для общего окна без сессии (первое «Иду» её создаёт);
 *  n:no:<день>                        — «Сегодня NO» в вечернем пинке.
 */
export async function POST(request: NextRequest) {
  const secret = webhookSecret();
  if (!secret || request.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const update = (await request.json().catch(() => null)) as { callback_query?: CallbackQuery } | null;
  const query = update?.callback_query;
  if (!query?.data) return NextResponse.json({ ok: true });

  const db = createAdminClient();
  const { data: profile } = await db.from("profiles").select("id, timezone").eq("telegram_id", query.from.id).maybeSingle();
  const { data: member } = profile
    ? await db.from("members").select("user_id").eq("user_id", profile.id).maybeSingle()
    : { data: null };
  if (!profile || !member) {
    await answerCallback(query.id, "Сначала зайди в brbs mafia");
    return NextResponse.json({ ok: true });
  }

  const [kind, choice, ...rest] = query.data.split(":");
  let reply = "Готово";
  if (kind === "s") reply = await answerSession(db, profile.id, Number(rest[0]), choice === "in");
  if (kind === "w") reply = await answerWindow(db, profile.id, Number(rest[0]), Number(rest[1]), choice === "in");
  if (kind === "n") reply = await markBusy(db, profile.id, rest[0]);

  await answerCallback(query.id, reply);
  // Галочка на выбранной кнопке — чтобы было видно, что ответ принят.
  const message = query.message;
  if (message?.reply_markup && kind !== "n") {
    const keyboard = message.reply_markup.inline_keyboard.map((row) =>
      row.map((b) => {
        const text = b.text.replace(/^✓ /, "");
        if (!b.callback_data) return { text, url: b.web_app?.url ?? "" };
        return { text: b.callback_data === query.data ? `✓ ${text}` : text, data: b.callback_data };
      }),
    );
    await editKeyboard(message.chat.id, message.message_id, keyboard);
  } else if (message && kind === "n") {
    // После «NO» кнопки больше не нужны, кроме «Отметить время» — вдруг передумает.
    const keep = (message.reply_markup?.inline_keyboard ?? []).flat().filter((b) => b.web_app);
    await editKeyboard(message.chat.id, message.message_id, keep.map((b) => [{ text: b.text, url: b.web_app!.url }]));
  }

  return NextResponse.json({ ok: true });
}

async function setStatus(db: Db, gatheringId: number, userId: string, going: boolean) {
  await db
    .from("gathering_members")
    .upsert({ gathering_id: gatheringId, user_id: userId, status: going ? "in" : "out", updated_at: new Date().toISOString() });
  revalidatePath("/", "layout");
  after(() => syncGatheringMessage(gatheringId).catch((e) => console.error(e)));
}

async function answerSession(db: Db, userId: string, gatheringId: number, going: boolean) {
  const { data } = await db.from("gatherings").select("id").eq("id", gatheringId).maybeSingle();
  if (!data) return "Эту сессию уже отменили";
  await setStatus(db, gatheringId, userId, going);
  return going ? "Записал: идёшь" : "Понял, без тебя";
}

/** Общее окно: если сессию на это время уже начали — отвечаем в ней, иначе «Иду» её создаёт. */
async function answerWindow(db: Db, userId: string, unix: number, gameId: number, going: boolean) {
  const start = new Date(unix * 1000);
  if (!Number.isFinite(unix) || Date.now() - start.getTime() > 3 * HOUR) return "Это время уже прошло";

  const { data: existing } = await db
    .from("gatherings")
    .select("id")
    .lt("starts_at", new Date(start.getTime() + HOUR).toISOString())
    .gt("ends_at", start.toISOString())
    .limit(1)
    .maybeSingle();
  if (existing) {
    await setStatus(db, existing.id, userId, going);
    return going ? "Записал: идёшь" : "Понял, без тебя";
  }
  if (!going) return "Понял, без тебя";

  // Сессия на окно — как «Начать сессию» в приложении, по часам компании (как и напоминание).
  const tz = process.env.CREW_TIMEZONE || "Europe/Moscow";
  const day = gamingDay(start, tz);
  const [members, entries, { data: game }] = await Promise.all([
    loadMembers(db),
    loadEntries(db, addDays(day, -1), addDays(day, 1)),
    gameId ? db.from("games").select("id, name").eq("id", gameId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const { best, freeHours } = dayStats(day, tz, members, entries);
  const sameWindow = best && hourStart(day, best.from, tz).getTime() === start.getTime();
  const end = sameWindow ? hourStart(day, best.to, tz) : new Date(start.getTime() + 2 * HOUR);

  const { data: created, error } = await db
    .from("gatherings")
    .insert({
      day,
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      game_id: game?.id ?? null,
      game_name: game?.name ?? "Катка",
      created_by: userId,
    })
    .select("id")
    .single();
  if (error || !created) {
    // На этот день сессия уже есть (другое окно) — присоединяем к ней.
    const { data: sameDay } = await db.from("gatherings").select("id").eq("day", day).maybeSingle();
    if (!sameDay) return "Не получилось, попробуй в приложении";
    await setStatus(db, sameDay.id, userId, true);
    return "Записал: идёшь";
  }

  await db.from("gathering_members").insert({ gathering_id: created.id, user_id: userId, status: "in" });
  const free = sameWindow
    ? members.filter((m) => m.id !== userId && (freeHours.get(m.id) ?? []).includes(best.from)).map((m) => m.id)
    : [];
  revalidatePath("/", "layout");
  after(() => syncGatheringMessage(created.id, free).catch((e) => console.error(e)));
  return "Записал: идёшь. Сессия начата";
}

async function markBusy(db: Db, userId: string, day: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day ?? "")) return "Готово";
  await db.from("day_entries").upsert({
    user_id: userId,
    day,
    status: "busy",
    slots: [],
    game_ids: [],
    updated_at: new Date().toISOString(),
  });
  revalidatePath("/", "layout");
  after(() => syncDiscord().catch((e) => console.error(e)));
  return "Отметил: сегодня NO";
}
