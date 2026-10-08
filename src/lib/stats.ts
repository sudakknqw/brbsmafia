// Итоги месяца: считаются из сборов и отмеченного времени, без отдельной таблицы.
import { addDays } from "./time";
import type { DayEntry, Game, Gathering, Member } from "./types";
import { plural } from "./words";

const MONTHS_IN = ["январе", "феврале", "марте", "апреле", "мае", "июне", "июле", "августе", "сентябре", "октябре", "ноябре", "декабре"];

export type StatCard =
  | { kind: "count"; label: string; value: number; note: string }
  | { kind: "game"; label: string; game: Game | null; name: string; note: string }
  | { kind: "person"; label: string; member: Member; note: string };

type Input = {
  members: Member[];
  games: Game[];
  entries: DayEntry[];
  gatherings: Gathering[];
  monthStart: string;
  today: string;
};

const days = (n: number) => `${n} ${plural(n, "день", "дня", "дней")}`;
const times = (n: number) => `${n} ${plural(n, "раз", "раза", "раз")}`;

/** Кто набрал больше всех (ничьи — по порядку в компании). Ноль — не победа. */
function leader(members: Member[], score: (m: Member) => number) {
  let best: { member: Member; value: number } | null = null;
  for (const m of members) {
    const value = score(m);
    if (value > 0 && (!best || value > best.value)) best = { member: m, value };
  }
  return best;
}

/** Во сколько человек обычно заканчивает (по своим часам; ночь считаем после полуночи). */
function lateness(entries: DayEntry[], m: Member) {
  const ends = entries
    .filter((e) => e.user_id === m.id && e.status === "free")
    .flatMap((e) => e.slots.map((s) => s.end))
    .map((iso) => {
      const h = Number(new Intl.DateTimeFormat("en-GB", { timeZone: m.timezone, hour: "2-digit", hourCycle: "h23" }).format(new Date(iso)));
      return h < 8 ? h + 24 : h;
    });
  return ends.length ? ends.reduce((a, b) => a + b, 0) / ends.length : 0;
}

export function monthStats({ members, games, entries, gatherings, monthStart, today }: Input) {
  const month = MONTHS_IN[Number(monthStart.slice(5, 7)) - 1];
  const cards: StatCard[] = [];

  cards.push({
    kind: "count",
    label: `Сходок в ${month}`,
    value: gatherings.length,
    note: gatherings.length ? `в деле в среднем ${Math.round(gatherings.reduce((n, g) => n + g.members.filter((m) => m.status === "in").length, 0) / gatherings.length)}` : "первую можно собрать в шапке",
  });

  // Игра месяца: чаще всего собирались в неё, а если сборов нет — чаще всего выбирали на день.
  const tally = new Map<string, number>();
  if (gatherings.length) gatherings.forEach((g) => tally.set(g.game_name, (tally.get(g.game_name) ?? 0) + 1));
  else entries.forEach((e) => e.game_ids.forEach((id) => {
    const name = games.find((g) => g.id === id)?.name;
    if (name) tally.set(name, (tally.get(name) ?? 0) + 1);
  }));
  const top = [...tally.entries()].sort((a, b) => b[1] - a[1])[0];
  if (top) {
    cards.push({
      kind: "game",
      label: "Игра месяца",
      game: games.find((g) => g.name === top[0]) ?? null,
      name: top[0],
      note: gatherings.length ? `собирались ${times(top[1])}` : `выбирали ${times(top[1])}`,
    });
  }

  const freeDays = (m: Member) => entries.filter((e) => e.user_id === m.id && e.status === "free" && e.slots.length).length;
  const free = leader(members, freeDays);
  if (free) cards.push({ kind: "person", label: "Всегда на связи", member: free.member, note: `${free.value} ${plural(free.value, "свободный день", "свободных дня", "свободных дней")}` });

  const organizer = leader(members, (m) => gatherings.filter((g) => g.created_by === m.id).length);
  if (organizer) cards.push({ kind: "person", label: "Душа компании", member: organizer.member, note: `${organizer.value} ${plural(organizer.value, "сбор", "сбора", "сборов")}` });

  const reliable = leader(members, (m) => {
    const mine = gatherings.flatMap((g) => g.members.filter((x) => x.user_id === m.id));
    return mine.some((x) => x.status === "out") ? 0 : mine.length;
  });
  if (reliable) cards.push({ kind: "person", label: "Без сливов", member: reliable.member, note: `${times(reliable.value)} в деле` });

  const owl = leader(members, (m) => lateness(entries, m));
  if (owl && owl.value >= 24) {
    const h = Math.round(owl.value) % 24;
    cards.push({ kind: "person", label: "Главная сова", member: owl.member, note: `обычно до ${String(h).padStart(2, "0")}:00` });
  }

  // Молчун: дни с начала месяца, когда человек ничего не отметил.
  const total = Math.round((Date.parse(today) - Date.parse(monthStart)) / 86400000) + 1;
  const silent = leader(members, (m) => {
    let quiet = 0;
    for (let i = 0; i < total; i++) {
      const d = addDays(monthStart, i);
      if (!entries.some((e) => e.user_id === m.id && e.day === d)) quiet++;
    }
    return quiet;
  });
  if (silent && members.length > 1) cards.push({ kind: "person", label: "Молчун месяца", member: silent.member, note: `${days(silent.value)} тишины` });

  return { month, cards };
}
