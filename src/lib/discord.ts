import "server-only";
import { crewTimezone } from "./crewTime";
import { createAdminClient } from "./supabase/admin";
import { dayStats, entryFor } from "./overlap";
import { busyPhrase, noMatchPhrase, silentPhrase } from "./phrases";
import { gameArt } from "./steam";
import { addDays, dateLong, gamingDay, hourStart, weekdayLong } from "./time";
import type { DayEntry, Game, Member } from "./types";

// Discord renders <t:…:t> in each reader's own time zone.
const ts = (d: Date) => `<t:${Math.floor(d.getTime() / 1000)}:t>`;

/**
 * One message per gaming day: if today's already exists, edit it,
 * otherwise post a new one. Called after every change and by the cron job.
 */
export async function syncDiscord() {
  const webhook = process.env.DISCORD_WEBHOOK_URL;
  if (!webhook) return;

  const tz = crewTimezone();
  const day = gamingDay(new Date(), tz);
  const db = createAdminClient();

  const [{ data: memberRows }, { data: entryRows }, { data: gameRows }, { data: state }] = await Promise.all([
    db.from("members").select("joined_at, profiles!members_user_id_fkey(id, name, avatar_url, timezone)").order("joined_at"),
    // "*": includes day notes (010_day_notes.sql) once that migration has run.
    db.from("day_entries").select("*").gte("day", addDays(day, -1)).lte("day", addDays(day, 1)),
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
    if (entry?.status === "busy") return `○ **${m.name}** — ${busyPhrase(m.id, day)}`;
    if (!hours.length) return `○ **${m.name}** — ${silentPhrase(m.id, day)}`;
    const ranges = toRanges(hours)
      .map(([a, b]) => `${ts(hourStart(day, a, tz))}–${ts(hourStart(day, b, tz))}`)
      .join(", ");
    const wants = (entry?.game_ids ?? []).map((id) => games.get(id)).filter(Boolean);
    const note = entry?.note?.trim();
    return `● **${m.name}** — ${ranges}${wants.length ? ` · ${wants.join(", ")}` : ""}${note ? ` · ${escapeMarkdown(note)}` : ""}`;
  });

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const headline = best
    ? `Лучшее окно: ${ts(hourStart(day, best.from, tz))}–${ts(hourStart(day, best.to, tz))} · свободны ${best.count}`
    : noMatchPhrase(day);

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

/** Notes are written by people: asterisks and underscores must not break the message markdown. */
const escapeMarkdown = (text: string) => text.replace(/[\\*_~`|>]/g, "\\$&");

function toRanges(hours: number[]): [number, number][] {
  const out: [number, number][] = [];
  for (const h of [...hours].sort((a, b) => a - b)) {
    const last = out[out.length - 1];
    if (last && last[1] === h) last[1] = h + 1;
    else out.push([h, h + 1]);
  }
  return out;
}

// ——— Sessions ———

type GatheringRow = {
  id: number;
  starts_at: string;
  ends_at: string;
  game_id: number | null;
  game_name: string;
  created_by: string | null;
  discord_message_id: string | null;
  members: { user_id: string; status: "in" | "out" }[];
};

/**
 * Session message: posted on creation, mentioning everyone free
 * in that window; then the same message is edited when someone answers In or Out.
 */
export async function syncGatheringMessage(gatheringId: number, mentionIds: string[] = []) {
  const webhook = process.env.DISCORD_WEBHOOK_URL;
  if (!webhook) return;
  const db = createAdminClient();

  const { data: g } = await db
    .from("gatherings")
    .select("id, starts_at, ends_at, game_id, game_name, created_by, discord_message_id, members:gathering_members(user_id, status)")
    .eq("id", gatheringId)
    .maybeSingle<GatheringRow>();
  if (!g) return;

  const ids = [...new Set([g.created_by, ...g.members.map((m) => m.user_id), ...mentionIds].filter(Boolean))] as string[];
  const [{ data: profiles }, { data: game }] = await Promise.all([
    // "*" rather than a column list: discord_id doesn't exist in every database (older setups); without it there are simply no mentions.
    db.from("profiles").select("*").in("id", ids),
    g.game_id ? db.from("games").select("*").eq("id", g.game_id).maybeSingle<Game>() : Promise.resolve({ data: null }),
  ]);
  const byId = new Map((profiles ?? []).map((p) => [p.id as string, p as { id: string; name: string; discord_id?: string | null }]));
  const names = (status: "in" | "out") =>
    g.members.filter((m) => m.status === status).map((m) => byId.get(m.user_id)?.name).filter(Boolean).join(", ");

  const start = new Date(g.starts_at);
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const pings = mentionIds.map((id) => byId.get(id)?.discord_id).filter(Boolean) as string[];

  const body = {
    // Only mentions of free people, so they get a notification; everything else is in the embed.
    // Edits carry no mentions, and Discord keeps the previous content as is.
    content: pings.length ? pings.map((d) => `<@${d}>`).join(" ") : undefined,
    embeds: [
      {
        title: g.game_name,
        url: site || undefined,
        color: 0xf4f4f6,
        description:
          `${ts(start)} – ${ts(new Date(g.ends_at))}, <t:${Math.floor(start.getTime() / 1000)}:R>\n\n` +
          `**В деле:** ${names("in") || "пока никого"}` +
          (names("out") ? `\n**Не пойдут:** ${names("out")}` : ""),
        image: game && gameArt(game).header[0] ? { url: gameArt(game).header[0] } : undefined,
      },
    ],
    // Ping only on creation; edits don't notify anyone.
    allowed_mentions: g.discord_message_id ? { parse: [] } : { parse: [], users: pings },
  };

  if (g.discord_message_id) {
    await fetch(`${webhook}/messages/${g.discord_message_id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return;
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
  await db.from("gatherings").update({ discord_message_id: message.id }).eq("id", g.id);
}

/** Session cancelled: remove its message from the channel. */
export async function deleteGatheringMessage(messageId: string | null) {
  const webhook = process.env.DISCORD_WEBHOOK_URL;
  if (!webhook || !messageId) return;
  await fetch(`${webhook}/messages/${messageId}`, { method: "DELETE" });
}
