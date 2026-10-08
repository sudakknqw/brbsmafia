// Итоги месяца: сколько было сессий и в какую игру играли чаще всего.
// Считаются из сессий и отмеченного времени, без отдельной таблицы.
import type { DayEntry, Game, Gathering } from "./types";
import { plural } from "./words";

const MONTHS_IN = ["январе", "феврале", "марте", "апреле", "мае", "июне", "июле", "августе", "сентябре", "октябре", "ноябре", "декабре"];

export type StatCard =
  | { kind: "count"; label: string; value: number; note: string }
  | { kind: "game"; label: string; game: Game | null; name: string; note: string };

type Input = {
  games: Game[];
  entries: DayEntry[];
  gatherings: Gathering[];
  monthStart: string;
};

const times = (n: number) => `${n} ${plural(n, "раз", "раза", "раз")}`;

export function monthStats({ games, entries, gatherings, monthStart }: Input) {
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

  // Игра месяца: чаще всего играли в неё, а если сессий не было — чаще всего выбирали на день.
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

  return { month, cards };
}
