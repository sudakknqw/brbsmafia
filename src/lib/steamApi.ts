import "server-only";
import { createAdminClient } from "./supabase/admin";

const API = "https://api.steampowered.com";
const key = () => process.env.STEAM_API_KEY;

export const steamConfigured = () => !!key();

/**
 * Steam ID from whatever was pasted: a profile link (/profiles/7656… or /id/name),
 * the 17-digit ID itself, or just the vanity name from the link.
 */
export async function resolveSteamId(input: string): Promise<string | null> {
  const s = input.trim();
  const direct =
    s.match(/steamcommunity\.com\/profiles\/(\d{17})/)?.[1] ??
    s.match(/^\d{17}$/)?.[0];
  if (direct) return direct;
  const vanity =
    s.match(/steamcommunity\.com\/id\/([^/?#\s]+)/)?.[1] ??
    (/^[\w-]{2,32}$/.test(s) ? s : null);
  if (!vanity || !key()) return null;
  const res = await fetch(
    `${API}/ISteamUser/ResolveVanityURL/v1/?key=${key()}&vanityurl=${encodeURIComponent(vanity)}`,
    {
      cache: "no-store",
    },
  );
  const data = (await res.json().catch(() => null)) as {
    response?: { success: number; steamid?: string };
  } | null;
  return data?.response?.success === 1 ? (data.response.steamid ?? null) : null;
}

type OwnedGame = {
  appid: number;
  playtime_forever: number;
  playtime_2weeks?: number;
  rtime_last_played?: number;
};

/**
 * Refreshes which games a person owns and how much they play them.
 * private: game details are hidden in the profile (Steam then returns an empty response).
 */
export async function syncSteamPlaytime(
  userId: string,
  steamId: string,
): Promise<"ok" | "private" | "error"> {
  if (!key()) return "error";
  const res = await fetch(
    `${API}/IPlayerService/GetOwnedGames/v1/?key=${key()}&steamid=${steamId}&include_played_free_games=1&format=json`,
    { cache: "no-store" },
  ).catch(() => null);
  if (!res?.ok) return "error";
  const data = (await res.json().catch(() => null)) as {
    response?: { game_count?: number; games?: OwnedGame[] };
  } | null;
  const response = data?.response;
  if (!response) return "error";
  if (response.game_count === undefined) return "private";

  const rows = (response.games ?? []).map((g) => ({
    user_id: userId,
    steam_appid: g.appid,
    recent_minutes: g.playtime_2weeks ?? 0,
    total_minutes: g.playtime_forever,
    last_played: g.rtime_last_played
      ? new Date(g.rtime_last_played * 1000).toISOString()
      : null,
  }));

  const db = createAdminClient();
  const { error } = await db
    .from("steam_playtime")
    .delete()
    .eq("user_id", userId);
  if (error) return "error";
  if (rows.length) {
    const { error: insertError } = await db.from("steam_playtime").insert(rows);
    if (insertError) return "error";
  }
  return "ok";
}

/** Once a day: refresh everyone with a linked profile and add shared games. */
export async function syncAllSteam() {
  if (!key()) return 0;
  const { data } = await createAdminClient()
    .from("profiles")
    .select("id, steam_id")
    .not("steam_id", "is", null);
  let synced = 0;
  for (const p of data ?? [])
    if ((await syncSteamPlaytime(p.id, p.steam_id)) === "ok") synced++;
  await addSharedGames();
  return synced;
}

const DISMISSED = "steam_dismissed";

/** Steam games that are no longer auto-added to the library: removed by hand, or not a game. */
async function loadDismissed(
  db: ReturnType<typeof createAdminClient>,
): Promise<number[]> {
  const { data } = await db
    .from("app_state")
    .select("value")
    .eq("key", DISMISSED)
    .maybeSingle();
  return Array.isArray(data?.value) ? (data.value as number[]) : [];
}

export async function dismissSteamGame(appid: number) {
  const db = createAdminClient();
  const list = await loadDismissed(db);
  if (!list.includes(appid))
    await db
      .from("app_state")
      .upsert({ key: DISMISSED, value: [...list, appid] });
}

// How many new games to check per run: the Steam store rate-limits frequent requests.
const ADD_PER_RUN = 60;

/**
 * Games owned by at least two crew members are added to the library automatically.
 * Manually added ones are left alone; ones removed from the library are not brought back.
 */
export async function addSharedGames(): Promise<number> {
  const db = createAdminClient();
  const owners = new Map<number, number>();
  // There can be thousands of rows, and the database returns at most 1000 at a time.
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from("steam_playtime")
      .select("steam_appid")
      .range(from, from + 999);
    if (error || !data) return 0;
    for (const r of data)
      owners.set(r.steam_appid, (owners.get(r.steam_appid) ?? 0) + 1);
    if (data.length < 1000) break;
  }

  const [{ data: games }, dismissed] = await Promise.all([
    db.from("games").select("steam_appid"),
    loadDismissed(db),
  ]);
  const skip = new Set([
    ...(games ?? []).map((g) => g.steam_appid as number),
    ...dismissed,
  ]);
  const fresh = [...owners.entries()]
    .filter(([appid, n]) => n >= 2 && !skip.has(appid))
    .sort((a, b) => b[1] - a[1])
    .slice(0, ADD_PER_RUN)
    .map(([appid]) => appid);

  const notGames: number[] = [];
  let added = 0;
  for (const appid of fresh) {
    const res = await fetch(
      `https://store.steampowered.com/api/appdetails?appids=${appid}&filters=basic&cc=US&l=russian`,
      {
        cache: "no-store",
      },
    ).catch(() => null);
    if (!res?.ok) break; // Steam asked us to slow down: continue next time
    const info = (
      (await res.json().catch(() => null)) as Record<
        string,
        { success: boolean; data?: { type: string; name: string } }
      > | null
    )?.[appid];
    // Not in the store (delisted) or not a game: remember it so we don't ask again.
    if (!info?.success || !info.data || info.data.type !== "game") {
      notGames.push(appid);
      continue;
    }
    const { error } = await db
      .from("games")
      .upsert(
        { steam_appid: appid, name: info.data.name.slice(0, 80) },
        { onConflict: "steam_appid", ignoreDuplicates: true },
      );
    if (!error) added++;
  }
  if (notGames.length)
    await db
      .from("app_state")
      .upsert({ key: DISMISSED, value: [...dismissed, ...notGames] });
  return added;
}
