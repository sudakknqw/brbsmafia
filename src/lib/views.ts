// Turns raw data into what the screens show. No database access,
// which is why the preview page with made-up data uses it too.
import { dayStats, entryFor } from "./overlap";
import { noMatchPhrase, personalPhrase, silentPhrase } from "./phrases";
import { addDays, dateLong, DAY_HOURS, dayNumber, dayWindow, formatTime, hourStart, weekdayLong, weekdayShort, weekStart } from "./time";
import type { DayEntry, Game, Gathering, Member, Want } from "./types";

export type CrewData = {
  me: Member;
  members: Member[];
  entries: DayEntry[];
  games: Game[];
  wants: Want[];
  recent: Game[];
  gatherings: Gathering[];
  /** Game for an empty header, picked randomly on the server (the browser doesn't recompute it). */
  fallbackGameId: number | null;
  now: Date;
  today: string;
};

export type Spotlight = {
  game: Game | null;
  /** The game was picked by people (rather than any game from the library). */
  picked: boolean;
  day: string;
  when: string | null; // "Today, 21:00 – 23:00"
  people: Member[];
  freeCount: number;
};

export type GatheringView = {
  id: number;
  day: string;
  when: string; // "21:00 – 23:00" in the viewer's time
  gameName: string;
  creator: Member | null;
  going: Member[];
  notGoing: Member[];
  myStatus: "in" | "out" | null;
  mine: boolean;
};

/**
 * The day's session, shaped for the screens. Matched by start time
 * within the VIEWER's gaming day: for a friend in another zone the same session may fall
 * on the neighbouring date. A finished session is not shown.
 */
export function gatheringView(data: CrewData, day: string): GatheringView | null {
  const { start, end } = dayWindow(day, data.me.timezone);
  const g = data.gatherings.find((x) => {
    const s = Date.parse(x.starts_at);
    return s >= start.getTime() && s < end.getTime();
  });
  if (!g || Date.parse(g.ends_at) <= data.now.getTime()) return null;
  const tz = data.me.timezone;
  const pick = (status: "in" | "out") =>
    g.members
      .filter((m) => m.status === status)
      .map((m) => data.members.find((x) => x.id === m.user_id))
      .filter((m): m is Member => !!m);
  return {
    id: g.id,
    day,
    when: `${formatTime(g.starts_at, tz)} – ${formatTime(g.ends_at, tz)}`,
    gameName: g.game_name,
    creator: data.members.find((m) => m.id === g.created_by) ?? null,
    going: pick("in"),
    notGoing: pick("out"),
    myStatus: g.members.find((m) => m.user_id === data.me.id)?.status ?? null,
    mine: g.created_by === data.me.id,
  };
}

export type EditorSeed = {
  day: string;
  hourLabels: string[];
  initialHours: number[];
  initialGames: number[];
  busy: boolean;
};

function dayName(day: string, today: string) {
  if (day === today) return "Сегодня";
  if (day === addDays(today, 1)) return "Завтра";
  return weekdayLong(day);
}

function hourLabels(day: string, tz: string) {
  return Array.from({ length: DAY_HOURS + 1 }, (_, i) => formatTime(hourStart(day, i, tz), tz));
}

/** The most popular game among people (by picks for the day, then by statuses). */
function leadingGame(data: CrewData, day: string, peopleIds: string[]): Game | null {
  const score = new Map<number, number>();
  for (const id of peopleIds) {
    entryFor(data.entries, id, day)?.game_ids.forEach((g) => score.set(g, (score.get(g) ?? 0) + 2));
  }
  for (const w of data.wants) {
    if (!peopleIds.length || peopleIds.includes(w.user_id)) score.set(w.game_id, (score.get(w.game_id) ?? 0) + 1);
  }
  const best = [...score.entries()].sort((a, b) => b[1] - a[1])[0];
  return data.games.find((g) => g.id === best?.[0]) ?? null;
}

/** If nobody picked anything, a random game from the library (picked on the server). */
function anyGame(data: CrewData): Game | null {
  return data.games.find((g) => g.id === data.fallbackGameId) ?? data.games[0] ?? null;
}

export function editorSeed(data: CrewData, day: string): EditorSeed {
  const tz = data.me.timezone;
  const { freeHours } = dayStats(day, tz, [data.me], data.entries);
  const mine = entryFor(data.entries, data.me.id, day);
  return {
    day,
    hourLabels: hourLabels(day, tz),
    initialHours: freeHours.get(data.me.id) ?? [],
    initialGames: mine?.game_ids ?? [],
    busy: mine?.status === "busy",
  };
}

export function buildHome(data: CrewData) {
  const tz = data.me.timezone;
  // The week is always Monday to Sunday; today "moves" within it.
  const monday = weekStart(data.today);
  const week = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const days = week.map((day) => ({ day, ...dayStats(day, tz, data.members, data.entries) }));

  // Spotlight: the nearest day where someone overlaps; otherwise what people want right now.
  // Today's window that has already passed doesn't count; look further into the week.
  const lit = days.find(
    (d) =>
      d.day >= data.today &&
      d.best &&
      !(d.day === data.today && hourStart(d.day, d.best.to, tz).getTime() <= data.now.getTime()),
  );
  let spotlight: Spotlight;
  if (lit?.best) {
    const inWindow = data.members.filter((m) => (lit.freeHours.get(m.id) ?? []).includes(lit.best!.from));
    const chosen = leadingGame(data, lit.day, inWindow.map((m) => m.id));
    spotlight = {
      game: chosen ?? anyGame(data),
      picked: !!chosen,
      day: lit.day,
      when: `${dayName(lit.day, data.today)}, ${formatTime(hourStart(lit.day, lit.best.from, tz), tz)} – ${formatTime(
        hourStart(lit.day, lit.best.to, tz),
        tz,
      )}`,
      people: inWindow,
      freeCount: lit.best.count,
    };
  } else {
    const chosen = leadingGame(data, data.today, []);
    const game = chosen ?? anyGame(data);
    spotlight = {
      game,
      picked: !!chosen,
      day: data.today,
      when: null,
      people: game ? data.members.filter((m) => data.wants.some((w) => w.user_id === m.id && w.game_id === game.id)) : [],
      freeCount: 0,
    };
  }

  return {
    spotlight,
    gathering: gatheringView(data, spotlight.day),
    total: data.members.length,
    week: days.map((d) => ({
      day: d.day,
      weekday: weekdayShort(d.day),
      num: dayNumber(d.day),
      counts: d.counts,
      peak: Math.max(...d.counts),
      isToday: d.day === data.today,
      isPast: d.day < data.today,
      mine: entryFor(data.entries, data.me.id, d.day)?.status ?? null,
    })),
    statuses: data.members
      .map((m) => ({
        member: m,
        games: data.wants
          .filter((w) => w.user_id === m.id)
          .sort((a, b) => a.created_at.localeCompare(b.created_at))
          .map((w) => data.games.find((g) => g.id === w.game_id))
          .filter((g): g is Game => !!g),
      }))
      .sort(
        (a, b) =>
          Number(b.member.id === data.me.id) - Number(a.member.id === data.me.id) || b.games.length - a.games.length,
      ),
    today: editorSeed(data, data.today),
  };
}

export type HomeModel = ReturnType<typeof buildHome>;

export function buildDay(data: CrewData, day: string) {
  const tz = data.me.timezone;
  const { freeHours, best } = dayStats(day, tz, data.members, data.entries);
  const order = { free: 0, busy: 1, silent: 2 } as const;

  const rows = data.members
    .map((m) => {
      const entry = entryFor(data.entries, m.id, day);
      const hours = freeHours.get(m.id) ?? [];
      const state: keyof typeof order = hours.length ? "free" : entry?.status === "busy" ? "busy" : "silent";
      const note = state === "silent" ? silentPhrase(m.id, day) : state === "busy" ? personalPhrase(m.id) : null;
      // The person's own note for the day ("no mic after 11pm"), only next to marked time.
      const comment = state === "free" ? entry?.note?.trim() || null : null;
      return { member: m, hours, state, note, comment };
    })
    .sort((a, b) => order[a.state] - order[b.state]);

  const dayGames = data.games
    .map((g) => ({
      game: g,
      people: data.members.filter((m) => entryFor(data.entries, m.id, day)?.game_ids.includes(g.id)),
    }))
    .filter((x) => x.people.length)
    .sort((a, b) => b.people.length - a.people.length);

  const editor = editorSeed(data, day);
  return {
    day,
    title: dayName(day, data.today),
    noMatch: noMatchPhrase(day),
    date: `${weekdayLong(day)}, ${dateLong(day)}`,
    hourLabels: editor.hourLabels,
    best,
    total: data.members.length,
    rows,
    dayGames,
    spotlightGame: dayGames[0]?.game ?? null,
    gathering: gatheringView(data, day),
    editor,
  };
}

export type DayModel = ReturnType<typeof buildDay>;
