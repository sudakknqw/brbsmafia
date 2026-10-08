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
};

export type DayEntry = {
  user_id: string;
  day: string;
  status: "free" | "busy";
  slots: Slot[];
  game_ids: number[];
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
