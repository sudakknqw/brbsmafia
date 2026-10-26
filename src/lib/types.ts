import type { Slot } from "./time";

export type Member = {
  id: string;
  name: string;
  avatar_url: string | null;
  timezone: string;
};

export type Game = {
  id: number;
  steam_appid: number | null;
  name: string;
  // Custom art (003_game_art.sql); empty means use Steam's.
  cover_url?: string | null;
  hero_url?: string | null;
  header_url?: string | null;
  logo_url?: string | null;
  // How much the whole crew played it on Steam, in minutes (006_steam.sql).
  played_recent?: number; // over the last 2 weeks
  played_total?: number;
};

/**
 * Games in your order: saved ones first, the rest (new ones) at the end,
 * ordered among themselves by what the crew plays most.
 */
export function personalOrder(games: Game[], saved: number[] = []): Game[] {
  const pos = new Map(saved.map((id, i) => [Number(id), i]));
  const at = (g: Game) => pos.get(g.id) ?? Number.MAX_SAFE_INTEGER;
  return [...games].sort((a, b) => at(a) - at(b) || byPlaytime(a, b) || a.name.localeCompare(b.name));
}

/** Most launched first: by playtime over the last 2 weeks, then all time. */
export const byPlaytime = (a: Game, b: Game) =>
  (b.played_recent ?? 0) - (a.played_recent ?? 0) || (b.played_total ?? 0) - (a.played_total ?? 0);

export type DayEntry = {
  user_id: string;
  day: string;
  status: "free" | "busy";
  slots: Slot[];
  game_ids: number[];
  /** Short day note, up to 80 characters (010_day_notes.sql); absent before that migration. */
  note?: string | null;
};

export type Want = {
  user_id: string;
  game_id: number;
  created_at: string;
};

export type BestWindow = { from: number; to: number; count: number };

export type Gathering = {
  id: number;
  day: string;
  starts_at: string;
  ends_at: string;
  game_id: number | null;
  game_name: string;
  created_by: string | null;
  members: { user_id: string; status: "in" | "out" }[];
};
