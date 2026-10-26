// Monthly stats: how many sessions there were and which game was played most.
// Computed from sessions and marked time, without a separate table.
import { dayStats } from "./overlap";
import { addDays, formatTime, hourStart, weekdayIndex, weekdayLong } from "./time";
import type { DayEntry, Game, Gathering, Member } from "./types";
import { people, plural } from "./words";

const MONTHS_IN = ["январе", "феврале", "марте", "апреле", "мае", "июне", "июле", "августе", "сентябре", "октябре", "ноябре", "декабре"];

export type StatCard =
  | { kind: "count"; label: string; value: number; note: string }
  | { kind: "game"; label: string; game: Game | null; name: string; note: string }
  | { kind: "text"; label: string; value: string; note: string };

type Input = {
  games: Game[];
  entries: DayEntry[];
  gatherings: Gathering[];
  monthStart: string;
  best?: StatCard | null;
};

const times = (n: number) => `${n} ${plural(n, "раз", "раза", "раз")}`;

export function monthStats({ games, entries, gatherings, monthStart, best }: Input) {
  const month = MONTHS_IN[Number(monthStart.slice(5, 7)) - 1];
  const going = gatherings.reduce((n, g) => n + g.members.filter((m) => m.status === "in").length, 0);
  const cards: StatCard[] = [
    {
      kind: "count",
      label: `Сессий в ${month}`,
      value: gatherings.length,
      note: gatherings.length ? `в деле в среднем ${Math.round(going / gatherings.length)}` : "первую можно начать в шапке",
    },
  ];

  // Game of the month: the most played one, or if there were no sessions, the most picked for a day.
  const tally = new Map<string, number>();
  if (gatherings.length) gatherings.forEach((g) => tally.set(g.game_name, (tally.get(g.game_name) ?? 0) + 1));
  else
    entries.forEach((e) =>
      e.game_ids.forEach((id) => {
        const name = games.find((g) => g.id === id)?.name;
        if (name) tally.set(name, (tally.get(name) ?? 0) + 1);
      }),
    );
  const top = [...tally.entries()].sort((a, b) => b[1] - a[1])[0];
  if (top) {
    cards.push({
      kind: "game",
      label: "Игра месяца",
      game: games.find((g) => g.name === top[0]) ?? null,
      name: top[0],
      note: gatherings.length ? `играли ${times(top[1])}` : `выбирали ${times(top[1])}`,
    });
  }

  if (best) cards.push(best);
  return { month, cards };
}

export const HISTORY_DAYS = 56; // eight weeks

/**
 * Best weekday: the weekday on which, over the last 8 weeks, the most people were free together
 * (averaged over all those days, including ones with no overlap). Time is in the viewer's zone.
 */
export function bestWeekday({ members, entries, today, tz }: { members: Member[]; entries: DayEntry[]; today: string; tz: string }): StatCard | null {
  const byWeekday = Array.from({ length: 7 }, () => ({ days: 0, people: 0, met: 0, starts: new Map<string, number>() }));
  let met = 0;
  for (let i = 1; i <= HISTORY_DAYS; i++) {
    const day = addDays(today, -i);
    const w = byWeekday[weekdayIndex(day)];
    w.days++;
    const { best } = dayStats(day, tz, members, entries);
    if (!best) continue;
    met++;
    w.met++;
    w.people += best.count;
    const start = formatTime(hourStart(day, best.from, tz), tz);
    w.starts.set(start, (w.starts.get(start) ?? 0) + 1);
  }
  if (met < 3) return null; // not enough history yet: don't guess

  const score = (w: (typeof byWeekday)[number]) => (w.days ? w.people / w.days : 0);
  const top = byWeekday.indexOf([...byWeekday].sort((a, b) => score(b) - score(a) || b.met - a.met)[0]);
  const w = byWeekday[top];
  if (!w.met) return null;
  // Any date with the right weekday, only to get its name.
  const sample = Array.from({ length: 7 }, (_, i) => addDays(today, -i)).find((d) => weekdayIndex(d) === top)!;
  const usual = [...w.starts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  return {
    kind: "text",
    label: "Лучший день",
    value: weekdayLong(sample),
    note: `обычно с ${usual}, свободны ${people(Math.round(w.people / w.met))}`,
  };
}
