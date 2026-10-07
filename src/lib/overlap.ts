import { DAY_HOURS, slotsToHours } from "./time";
import type { BestWindow, DayEntry, Member } from "./types";

/**
 * Для игрового дня зрителя считает, кто в какие часы свободен.
 * Слоты берутся из всех записей человека (соседние дни тоже), потому что
 * у друзей в других поясах «их» день сдвинут относительно нашего.
 */
export function dayStats(day: string, tz: string, members: Member[], entries: DayEntry[]) {
  const freeHours = new Map<string, number[]>();
  const counts = new Array<number>(DAY_HOURS).fill(0);

  for (const m of members) {
    const slots = entries.filter((e) => e.user_id === m.id && e.status === "free").flatMap((e) => e.slots);
    const hours = slots.length ? slotsToHours(day, slots, tz) : [];
    freeHours.set(m.id, hours);
    hours.forEach((h) => counts[h]++);
  }

  return { freeHours, counts, best: bestWindow(counts) };
}

/** Самый длинный отрезок с максимальным числом свободных (минимум двое). */
export function bestWindow(counts: number[]): BestWindow | null {
  const max = Math.max(...counts);
  if (max < 2) return null;
  let best: BestWindow | null = null;
  for (let i = 0; i < counts.length; i++) {
    if (counts[i] !== max) continue;
    let j = i;
    while (j < counts.length && counts[j] === max) j++;
    if (!best || j - i > best.to - best.from) best = { from: i, to: j, count: max };
    i = j;
  }
  return best;
}

/** Запись человека именно на этот день (его «Не могу», его игры). */
export function entryFor(entries: DayEntry[], userId: string, day: string) {
  return entries.find((e) => e.user_id === userId && e.day === day);
}
