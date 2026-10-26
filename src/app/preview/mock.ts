// A made-up crew for design previews. Development only.
import { addDays, gamingDay, hoursToSlots } from "@/lib/time";
import type { CrewData } from "@/lib/views";
import type { DayEntry, Game, Member, Want } from "@/lib/types";

export function mockCrew(variant: "full" | "empty" = "full"): CrewData {
  const me: Member = { id: "u-kirill", name: "Кирилл", avatar_url: "https://cdn.discordapp.com/embed/avatars/0.png", timezone: "Europe/Moscow" };
  const members: Member[] = [
    me,
    { id: "u-lesha", name: "Лёша", avatar_url: null, timezone: "Asia/Yekaterinburg" },
    { id: "u-masha", name: "Маша", avatar_url: null, timezone: "Asia/Novosibirsk" },
    { id: "u-dima", name: "Дима", avatar_url: null, timezone: "Europe/Berlin" },
    { id: "u-sasha", name: "Саша", avatar_url: null, timezone: "Europe/Moscow" },
    { id: "u-anya", name: "Аня", avatar_url: null, timezone: "Europe/Moscow" },
    { id: "u-zhenya", name: "Женя", avatar_url: null, timezone: "Asia/Almaty" },
    { id: "u-oleg", name: "Олег", avatar_url: null, timezone: "Europe/Moscow" },
  ];
  const now = new Date();
  const today = gamingDay(now, me.timezone);
  if (variant === "empty") return { me, members: members.slice(0, 3), entries: [], games: [], wants: [], recent: [], gatherings: [], fallbackGameId: null, now, today };

  const games: Game[] = [
    { id: 1, steam_appid: 548430, name: "Deep Rock Galactic" },
    { id: 2, steam_appid: 892970, name: "Valheim" },
    { id: 3, steam_appid: 730, name: "Counter-Strike 2" },
    { id: 4, steam_appid: 1966720, name: "Lethal Company" },
    { id: 5, steam_appid: 553850, name: "HELLDIVERS 2" },
    { id: 6, steam_appid: null, name: "Minecraft" },
    // A big shelf, as after a Steam sync (to test "Show all").
    { id: 7, steam_appid: 108600, name: "Project Zomboid" },
    { id: 8, steam_appid: 3241660, name: "R.E.P.O." },
    { id: 9, steam_appid: 105600, name: "Terraria" },
    { id: 10, steam_appid: 413150, name: "Stardew Valley" },
    { id: 11, steam_appid: 252490, name: "Rust" },
    { id: 12, steam_appid: 381210, name: "Dead by Daylight" },
    { id: 13, steam_appid: 1172470, name: "Apex Legends" },
    { id: 14, steam_appid: 1086940, name: "Baldur's Gate 3" },
  ];

  const tz = "Europe/Moscow";
  const free = (user: string, day: string, hours: number[], game_ids: number[] = []): DayEntry => ({
    user_id: user,
    day,
    status: "free",
    slots: hoursToSlots(day, hours, tz),
    game_ids,
  });
  const range = (a: number, b: number) => Array.from({ length: b - a }, (_, i) => a + i);
  const entries: DayEntry[] = [
    free("u-kirill", today, range(11, 16), [1, 5]),
    { ...free("u-lesha", today, range(12, 18), [1]), note: "после 23 без микрофона" },
    { ...free("u-masha", today, range(13, 16), [2, 1]), note: "могу опоздать на полчаса" },
    free("u-dima", today, range(10, 15), [3, 1]),
    free("u-sasha", today, range(13, 17), [5]),
    { user_id: "u-anya", day: today, status: "busy", slots: [], game_ids: [] },
    free("u-kirill", addDays(today, 1), range(12, 15)),
    free("u-dima", addDays(today, 1), range(13, 16)),
    free("u-masha", addDays(today, 2), range(14, 16)),
    free("u-lesha", addDays(today, 3), range(11, 16)),
    free("u-sasha", addDays(today, 3), range(12, 14)),
    free("u-oleg", addDays(today, 3), range(12, 15)),
  ];
  const ago = (h: number) => new Date(now.getTime() - h * 3600_000).toISOString();
  const wants: Want[] = [
    { user_id: "u-kirill", game_id: 1, created_at: ago(3) },
    { user_id: "u-kirill", game_id: 5, created_at: ago(2) },
    { user_id: "u-lesha", game_id: 1, created_at: ago(5) },
    { user_id: "u-masha", game_id: 2, created_at: ago(1) },
    { user_id: "u-dima", game_id: 3, created_at: ago(8) },
    { user_id: "u-dima", game_id: 1, created_at: ago(7) },
    { user_id: "u-sasha", game_id: 5, created_at: ago(4) },
    { user_id: "u-zhenya", game_id: 4, created_at: ago(6) },
  ];
  const gatherings = [
    {
      id: 1,
      day: today,
      starts_at: hoursToSlots(today, [13], tz)[0].start,
      ends_at: hoursToSlots(today, [14], tz)[0].end,
      game_id: 1,
      game_name: "Deep Rock Galactic",
      created_by: "u-lesha",
      members: [
        { user_id: "u-lesha", status: "in" as const },
        { user_id: "u-masha", status: "in" as const },
        { user_id: "u-anya", status: "out" as const },
      ],
    },
  ];
  return { me, members, entries, games, wants, recent: [games[0], games[4]], gatherings, fallbackGameId: 6, now, today };
}
