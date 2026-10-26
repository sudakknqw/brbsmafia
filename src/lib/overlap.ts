import { DAY_HOURS, slotsToHours } from "./time";
import type { BestWindow, DayEntry, Member } from "./types";

/**
 * For the viewer's gaming day, computes who is free in which hours.
 * Slots are taken from all of a person's entries (neighbouring days too), because
 * for friends in other time zones "their" day is shifted relative to ours.
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

/** The longest run with the maximum number of free people (at least two). */
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

/** A person's entry for exactly this day (their NO, their games). */
export function entryFor(entries: DayEntry[], userId: string, day: string) {
  return entries.find((e) => e.user_id === userId && e.day === day);
}
