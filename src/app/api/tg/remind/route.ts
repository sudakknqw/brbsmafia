import { NextResponse, type NextRequest } from "next/server";
import { dayStats, entryFor } from "@/lib/overlap";
import { createAdminClient } from "@/lib/supabase/admin";
import { crewTimezone } from "@/lib/crewTime";
import { escapeHtml, sendMessage, type Keyboard } from "@/lib/telegram";
import { addDays, formatTime, gamingDay, hourStart } from "@/lib/time";
import type { DayEntry, Game, Gathering, Member } from "@/lib/types";
import { WANT_TTL_HOURS } from "@/lib/limits";

type Person = Member & { telegram_id: number | null };
type Reminder = {
  key: string;
  start: Date;
  game: string;
  people: Person[];
  /** Payload for the Going / Skip buttons (parsed by /api/tg/webhook). */
  answer: { in: string; out: string };
  /** Already marked as going, so their button starts checked. */
  marked: boolean;
};

// Evening nudge: sent at this local hour if the person hasn't marked the day yet.
const NUDGE_HOUR = 18;

const HOUR = 3600_000;

/**
 * One-hour reminder, called by the Supabase scheduler every 10 minutes.
 * If a session (or a common window without a session) starts within the hour,
 * the bot messages everyone going: "<b>Game</b> at 21:00 / name, name, name" in their own time zone.
 * Going / Skip buttons under the message let people answer without opening the app.
 *
 * Also the evening nudge: whoever hasn't marked today by 18:00 local time
 * (while someone else in the crew has) gets one private message.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  if (!process.env.TELEGRAM_BOT_TOKEN) return NextResponse.json({ ok: false, error: "no-bot" }, { status: 503 });

  const db = createAdminClient();
  const tz = crewTimezone();
  const now = new Date();
  const today = gamingDay(now, tz);
  const soon = (d: Date) => d.getTime() > now.getTime() && d.getTime() - now.getTime() <= HOUR;

  const [{ data: rows }, { data: entryRows }, { data: gameRows }, { data: wantRows }, { data: gatheringRows }] = await Promise.all([
    db.from("members").select("profiles!members_user_id_fkey(id, name, avatar_url, timezone, telegram_id)"),
    db.from("day_entries").select("user_id, day, status, slots, game_ids").gte("day", addDays(today, -1)).lte("day", addDays(today, 2)),
    db.from("games").select("*"),
    db.from("wants").select("user_id, game_id, created_at").gte("created_at", new Date(now.getTime() - WANT_TTL_HOURS * HOUR).toISOString()),
    db
      .from("gatherings")
      .select("id, day, starts_at, ends_at, game_id, game_name, created_by, members:gathering_members(user_id, status)")
      .gt("starts_at", now.toISOString())
      .lte("starts_at", new Date(now.getTime() + HOUR).toISOString()),
  ]);
  const people = (rows ?? []).map((r) => r.profiles as unknown as Person);
  const entries = (entryRows ?? []) as DayEntry[];
  const games = (gameRows ?? []) as Game[];
  const wants = wantRows ?? [];
  const gatherings = (gatheringRows ?? []) as Gathering[];

  const reminders: Reminder[] = [];

  // Sessions: whoever answered "In" is going.
  for (const g of gatherings) {
    const going = g.members.filter((m) => m.status === "in").map((m) => people.find((p) => p.id === m.user_id));
    reminders.push({
      key: `session:${g.id}`,
      start: new Date(g.starts_at),
      game: g.game_name,
      people: going.filter((p): p is Person => !!p),
      answer: { in: `s:in:${g.id}`, out: `s:out:${g.id}` },
      marked: true,
    });
  }

  // Common window without a session: everyone free at its start is going.
  for (const day of [today, addDays(today, 1)]) {
    const { best, freeHours } = dayStats(day, tz, people, entries);
    if (!best) continue;
    const start = hourStart(day, best.from, tz);
    const end = hourStart(day, best.to, tz);
    if (!soon(start)) continue;
    const covered = gatherings.some((g) => Date.parse(g.starts_at) < end.getTime() && Date.parse(g.ends_at) > start.getTime());
    if (covered) continue;

    const going = people.filter((p) => (freeHours.get(p.id) ?? []).includes(best.from));
    // Game: the one most picked for this day among those going, then by "want now" statuses.
    const score = new Map<number, number>();
    for (const p of going) entryFor(entries, p.id, day)?.game_ids.forEach((id) => score.set(id, (score.get(id) ?? 0) + 2));
    for (const w of wants) if (going.some((p) => p.id === w.user_id)) score.set(w.game_id, (score.get(w.game_id) ?? 0) + 1);
    const topId = [...score.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    const top = games.find((g) => g.id === topId);
    const ref = `${Math.floor(start.getTime() / 1000)}:${top?.id ?? 0}`;
    reminders.push({
      key: `window:${start.toISOString()}`,
      start,
      game: top?.name ?? "Катка",
      people: going,
      answer: { in: `w:in:${ref}`, out: `w:out:${ref}` },
      marked: false,
    });
  }

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  let sent = 0;
  for (const r of reminders) {
    if (!r.people.length) continue;
    // Mark as sent first: if the scheduler fires twice, the second run sends nothing.
    const { error } = await db.from("reminders_sent").insert({ key: r.key });
    if (error) continue;

    const names = r.people.map((p) => escapeHtml(p.name)).join(", ");
    for (const p of r.people) {
      if (!p.telegram_id) continue;
      const text = `<b>${escapeHtml(r.game)}</b> в ${formatTime(r.start, p.timezone)}\n${names}`;
      const day = gamingDay(r.start, p.timezone);
      const keyboard: Keyboard = [
        [
          { text: r.marked ? "✓ Иду" : "Иду", data: r.answer.in },
          { text: "Без меня", data: r.answer.out },
        ],
      ];
      if (site) keyboard.push([{ text: "Открыть", url: `${site}/?day=${day}` }]);
      if (await sendMessage(p.telegram_id, text, keyboard)) sent++;
    }
  }

  // Nudge the silent ones: once a day, privately only.
  let nudged = 0;
  for (const p of people) {
    if (!p.telegram_id) continue;
    const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: p.timezone, hour: "2-digit", hourCycle: "h23" }).format(now));
    if (hour !== NUDGE_HOUR) continue;
    const day = gamingDay(now, p.timezone);
    if (entryFor(entries, p.id, day)) continue;
    const marked = people.filter((o) => o.id !== p.id && entryFor(entries, o.id, day)?.status === "free");
    if (!marked.length) continue; // nobody is planning anything, so there's no point nudging

    const { error } = await db.from("reminders_sent").insert({ key: `nudge:${p.id}:${day}` });
    if (error) continue;
    const text = `Сегодня играем? Время на вечер ещё не отмечено.\nУже отметились: ${marked.map((o) => escapeHtml(o.name)).join(", ")}`;
    const keyboard: Keyboard = [[{ text: "Сегодня NO", data: `n:no:${day}` }]];
    if (site) keyboard.unshift([{ text: "Отметить время", url: `${site}/?day=${day}` }]);
    if (await sendMessage(p.telegram_id, text, keyboard)) nudged++;
  }

  return NextResponse.json({ ok: true, reminders: reminders.length, sent, nudged });
}
