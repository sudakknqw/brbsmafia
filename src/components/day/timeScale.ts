// Small shared pieces of the day timeline: row types and stateless helpers.
import { DAY_HOURS } from "@/lib/time";
import type { Member } from "@/lib/types";
import { plural } from "@/lib/words";

export type Row = {
  member: Member;
  hours: number[];
  state: "free" | "busy" | "silent";
  /** Phrase shown for a silent or busy person (not their own words). */
  note: string | null;
  /** The person's own note for the day. */
  comment: string | null;
};
export type Range = [number, number];

export const pct = (i: number) => `${(i / DAY_HOURS) * 100}%`;
// On phones the timeline is narrow (about 10 px per hour), so time is picked on the dial there.
export const isPhone = () => window.matchMedia("(max-width: 639px)").matches;

export function runs(hours: number[]): Range[] {
  const out: Range[] = [];
  for (const h of [...hours].sort((a, b) => a - b)) {
    const last = out[out.length - 1];
    if (last && last[1] === h) last[1] = h + 1;
    else out.push([h, h + 1]);
  }
  return out;
}

export function duration([a, b]: Range) {
  const n = b - a;
  return `${n} ${plural(n, "час", "часа", "часов")}`;
}

/** One range per day: if the database has several, take from the first to the last hour. */
export function toRange(hours: number[]): Range | null {
  if (!hours.length) return null;
  return [Math.min(...hours), Math.max(...hours) + 1];
}

/** Day note as the server stores it: whitespace collapsed, trimmed. */
export const cleanNote = (text: string) => text.replace(/\s+/g, " ").trim();

// "08:00" → "8"; time zones with half-hour offsets keep the full label.
export const shortHour = (label: string) => (label.endsWith(":00") ? String(Number(label.slice(0, -3))) : label);
