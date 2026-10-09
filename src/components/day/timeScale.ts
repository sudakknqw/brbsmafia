// Общие мелочи шкалы дня: типы строк и вычисления без состояния.
import { DAY_HOURS } from "@/lib/time";
import type { Member } from "@/lib/types";
import { plural } from "@/lib/words";

export type Row = { member: Member; hours: number[]; state: "free" | "busy" | "silent"; note: string | null };
export type Range = [number, number];

export const pct = (i: number) => `${(i / DAY_HOURS) * 100}%`;
// На телефоне шкала узкая (час — около 10 px), поэтому время там выбирается на циферблате.
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

/** Один промежуток на день: если в базе их несколько, берём от первого до последнего часа. */
export function toRange(hours: number[]): Range | null {
  if (!hours.length) return null;
  return [Math.min(...hours), Math.max(...hours) + 1];
}

// «08:00» → «8»; у часовых поясов со сдвигом в полчаса оставляем как есть.
export const shortHour = (label: string) => (label.endsWith(":00") ? String(Number(label.slice(0, -3))) : label);
