import "server-only";
import { createAdminClient } from "./supabase/admin";
import { dayStats, entryFor } from "./overlap";
import { silentJoke } from "./jokes";
import { addDays, dateLong, gamingDay, hourStart, weekdayLong } from "./time";
import type { DayEntry, Game, Member } from "./types";

// Discord сам показывает <t:…:t> по часам того, кто читает.
const ts = (d: Date) => `<t:${Math.floor(d.getTime() / 1000)}:t>`;

/**
 * Одно сообщение на игровой день: если сегодняшнее уже есть — правим его,
 * иначе публикуем новое. Вызывается после каждого изменения и по крону.
 */
export async function syncDiscord() {
  const webhook = process.env.DISCORD_WEBHOOK_URL;
  if (!webhook) return;

  const tz = process.env.CREW_TIMEZONE || "Europe/Moscow";
  const day = gamingDay(new Date(), tz);
  const db = createAdminClient();

  const [{ data: memberRows }, { data: entryRows }, { data: gameRows }, { data: state }] = await Promise.all([
    db.from("members").select("joined_at, profiles!members_user_id_fkey(id, name, avatar_url, timezone)").order("joined_at"),
    db.from("day_entries").select("user_id, day, status, slots, game_ids").gte("day", addDays(day, -1)).lte("day", addDays(day, 1)),
    db.from("games").select("id, steam_appid, name"),
    db.from("app_state").select("value").eq("key", "discord_message").maybeSingle(),
  ]);

  const members = (memberRows ?? []).map((r) => r.profiles as unknown as Member);
  const entries = (entryRows ?? []) as DayEntry[];
  const games = new Map(((gameRows ?? []) as Game[]).map((g) => [g.id, g.name]));
  const { freeHours, best } = dayStats(day, tz, members, entries);

  const lines = members.map((m) => {
    const entry = entryFor(entries, m.id, day);
    const hours = freeHours.get(m.id) ?? [];
    if (entry?.status === "busy") return `○ **${m.name}** — сегодня не может`;
    if (!hours.length) return `○ **${m.name}** — ${silentJoke(m.id, day)}`;
    const ranges = toRanges(hours)
      .map(([a, b]) => `${ts(hourStart(day, a, tz))}–${ts(hourStart(day, b, tz))}`)
      .join(", ");
    const wants = (entry?.game_ids ?? []).map((id) => games.get(id)).filter(Boolean);
    return `● **${m.name}** — ${ranges}${wants.length ? ` · ${wants.join(", ")}` : ""}`;
  });

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const headline = best
    ? `Лучшее окно: ${ts(hourStart(day, best.from, tz))}–${ts(hourStart(day, best.to, tz))} · свободны ${best.count}`
    : "Пока никто не совпал";

  const body = {
    embeds: [
      {
        title: `${weekdayLong(day)}, ${dateLong(day)}`,
        url: site ? `${site}/day/${day}` : undefined,
        color: best ? 0x30d158 : 0x3a3a3c,
        description: [headline, "", ...lines, "", site ? `[Открыть brbs mafia](${site})` : ""].join("\n"),
        footer: { text: "Время показано по твоим часам" },
      },
    ],
    allowed_mentions: { parse: [] },
  };

  const saved = state?.value as { day: string; id: string } | null;
  if (saved?.day === day) {
    const res = await fetch(`${webhook}/messages/${saved.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok || res.status !== 404) return;
  }

  const res = await fetch(`${webhook}?wait=true`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    console.error("Discord webhook failed", res.status, await res.text());
    return;
  }
  const message = (await res.json()) as { id: string };
  await db.from("app_state").upsert({ key: "discord_message", value: { day, id: message.id } });
}

function toRanges(hours: number[]): [number, number][] {
  const out: [number, number][] = [];
  for (const h of [...hours].sort((a, b) => a - b)) {
    const last = out[out.length - 1];
    if (last && last[1] === h) last[1] = h + 1;
    else out.push([h, h + 1]);
  }
  return out;
}
