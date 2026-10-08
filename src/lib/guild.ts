import "server-only";
import { createAdminClient } from "./supabase/admin";

/** Чем кончилась проверка сервера — экран входа объясняет это человеку. */
export type GuildCheck = "joined" | "member" | "no-guild-id" | "no-token" | "discord-error" | "not-in-guild";

/**
 * Вход для своих: если человек состоит на нашем Discord-сервере
 * (DISCORD_GUILD_ID), добавляем его в компанию без приглашения.
 * providerToken — токен Discord, который Supabase отдаёт один раз, сразу после входа.
 */
export async function joinIfInGuild(userId: string, providerToken: string | null | undefined): Promise<GuildCheck> {
  const db = createAdminClient();
  const { data: already } = await db.from("members").select("user_id").eq("user_id", userId).maybeSingle();
  if (already) return "member";

  const guildId = process.env.DISCORD_GUILD_ID?.trim();
  if (!guildId) return "no-guild-id";
  if (!providerToken) return "no-token";

  const res = await fetch("https://discord.com/api/v10/users/@me/guilds?limit=200", {
    headers: { Authorization: `Bearer ${providerToken}` },
    cache: "no-store",
  });
  if (!res.ok) {
    console.error("Discord guilds request failed", res.status, await res.text());
    return "discord-error";
  }
  const guilds = (await res.json()) as { id: string }[];
  if (!guilds.some((g) => g.id === guildId)) return "not-in-guild";

  await db.from("members").upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });
  return "joined";
}
