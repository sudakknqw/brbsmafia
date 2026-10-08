import "server-only";
import { createAdminClient } from "./supabase/admin";

const API = "https://api.steampowered.com";
const key = () => process.env.STEAM_API_KEY;

export const steamConfigured = () => !!key();

/**
 * Steam ID из того, что вставили: ссылка на профиль (/profiles/7656… или /id/ник),
 * сам 17-значный ID или просто ник из ссылки.
 */
export async function resolveSteamId(input: string): Promise<string | null> {
  const s = input.trim();
  const direct = s.match(/steamcommunity\.com\/profiles\/(\d{17})/)?.[1] ?? s.match(/^\d{17}$/)?.[0];
  if (direct) return direct;
  const vanity = s.match(/steamcommunity\.com\/id\/([^/?#\s]+)/)?.[1] ?? (/^[\w-]{2,32}$/.test(s) ? s : null);
  if (!vanity || !key()) return null;
  const res = await fetch(`${API}/ISteamUser/ResolveVanityURL/v1/?key=${key()}&vanityurl=${encodeURIComponent(vanity)}`, {
    cache: "no-store",
  });
  const data = (await res.json().catch(() => null)) as { response?: { success: number; steamid?: string } } | null;
  return data?.response?.success === 1 ? (data.response.steamid ?? null) : null;
}

type OwnedGame = { appid: number; playtime_forever: number; playtime_2weeks?: number; rtime_last_played?: number };

/**
 * Обновляет, во что и сколько человек играет. Хранятся только игры, в которые он запускал.
 * private — игровая информация в профиле скрыта (Steam тогда отдаёт пустой ответ).
 */
export async function syncSteamPlaytime(userId: string, steamId: string): Promise<"ok" | "private" | "error"> {
  if (!key()) return "error";
  const res = await fetch(
    `${API}/IPlayerService/GetOwnedGames/v1/?key=${key()}&steamid=${steamId}&include_played_free_games=1&format=json`,
    { cache: "no-store" },
  ).catch(() => null);
  if (!res?.ok) return "error";
  const data = (await res.json().catch(() => null)) as { response?: { game_count?: number; games?: OwnedGame[] } } | null;
  const response = data?.response;
  if (!response) return "error";
  if (response.game_count === undefined) return "private";

  const rows = (response.games ?? [])
    .filter((g) => g.playtime_forever > 0)
    .map((g) => ({
      user_id: userId,
      steam_appid: g.appid,
      recent_minutes: g.playtime_2weeks ?? 0,
      total_minutes: g.playtime_forever,
      last_played: g.rtime_last_played ? new Date(g.rtime_last_played * 1000).toISOString() : null,
    }));

  const db = createAdminClient();
  const { error } = await db.from("steam_playtime").delete().eq("user_id", userId);
  if (error) return "error";
  if (rows.length) {
    const { error: insertError } = await db.from("steam_playtime").insert(rows);
    if (insertError) return "error";
  }
  return "ok";
}

/** Раз в сутки: обновить всех, кто указал профиль. */
export async function syncAllSteam() {
  if (!key()) return 0;
  const { data } = await createAdminClient().from("profiles").select("id, steam_id").not("steam_id", "is", null);
  let synced = 0;
  for (const p of data ?? []) if ((await syncSteamPlaytime(p.id, p.steam_id)) === "ok") synced++;
  return synced;
}
