import "server-only";
import { createAdminClient } from "./supabase/admin";

/**
 * Вход для своих: если человек состоит на нашем Discord-сервере
 * (DISCORD_GUILD_ID), добавляем его в компанию без приглашения.
 * providerToken — токен Discord, который Supabase отдаёт один раз, сразу после входа.
 */
export async function joinIfInGuild(userId: string, providerToken: string | null | undefined): Promise<boolean> {
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!guildId || !providerToken) return false;

  const res = await fetch("https://discord.com/api/v10/users/@me/guilds", {
    headers: { Authorization: `Bearer ${providerToken}` },
    cache: "no-store",
  });
  if (!res.ok) return false;
  const guilds = (await res.json()) as { id: string }[];
  if (!guilds.some((g) => g.id === guildId)) return false;

  await createAdminClient()
    .from("members")
    .upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });
  return true;
}
