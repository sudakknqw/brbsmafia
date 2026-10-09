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
  // Свои картинки (003_game_art.sql); если пусто — берём из Steam.
  cover_url?: string | null;
  hero_url?: string | null;
  header_url?: string | null;
  logo_url?: string | null;
  // Сколько вся компания играла в неё в Steam, в минутах (006_steam.sql).
  played_recent?: number; // за последние 2 недели
  played_total?: number;
};

/**
 * Игры в твоём порядке: сначала из сохранённого списка, остальные (новые) — в конце,
 * между собой — по тому, во что компания больше играет.
 */
export function personalOrder(games: Game[], saved: number[] = []): Game[] {
  const pos = new Map(saved.map((id, i) => [Number(id), i]));
  const at = (g: Game) => pos.get(g.id) ?? Number.MAX_SAFE_INTEGER;
  return [...games].sort((a, b) => at(a) - at(b) || byPlaytime(a, b) || a.name.localeCompare(b.name));
}

/** Чаще запускаемые — выше: сначала по игре за последние 2 недели, потом за всё время. */
export const byPlaytime = (a: Game, b: Game) =>
  (b.played_recent ?? 0) - (a.played_recent ?? 0) || (b.played_total ?? 0) - (a.played_total ?? 0);

export type DayEntry = {
  user_id: string;
  day: string;
  status: "free" | "busy";
  slots: Slot[];
  game_ids: number[];
  /** Короткая заметка к дню, до 80 символов (010_day_notes.sql); до миграции поля нет. */
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
