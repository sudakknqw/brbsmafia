// Everything in the database is UTC. This converts it to a specific person's local time.
// A "gaming day" runs from 08:00 to 08:00 the next day, so late-night
// sessions aren't split across two days.

export const DAY_START_HOUR = 8;
export const DAY_HOURS = 24;
const HOUR = 3600_000;

export type Slot = { start: string; end: string };

/** Time zone offset from UTC in minutes at the given moment. */
export function offsetMinutes(date: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return (asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000;
}

/** Local date + hour (the hour may be ≥ 24) → a UTC moment. */
export function zonedToUtc(day: string, hour: number, tz: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d, hour);
  const first = offsetMinutes(new Date(guess), tz);
  const second = offsetMinutes(new Date(guess - first * 60000), tz);
  return new Date(guess - second * 60000);
}

/** Calendar date YYYY-MM-DD in a time zone. */
export function calendarDay(date: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(date);
}

/**
 * The gaming day a moment belongs to. Computed from wall-clock time in that zone:
 * before 08:00 local time it's still the previous day. (Subtracting 8 real hours doesn't work:
 * on DST change days it's off by an hour.)
 */
export function gamingDay(date: Date, tz: string): string {
  const wall = date.getTime() + offsetMinutes(date, tz) * 60000;
  return new Date(wall - DAY_START_HOUR * HOUR).toISOString().slice(0, 10);
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export function dayWindow(day: string, tz: string) {
  return {
    start: zonedToUtc(day, DAY_START_HOUR, tz),
    end: zonedToUtc(day, DAY_START_HOUR + DAY_HOURS, tz),
  };
}

/** Start of the i-th hour of the gaming day. */
export function hourStart(day: string, i: number, tz: string): Date {
  return zonedToUtc(day, DAY_START_HOUR + i, tz);
}

export function formatTime(date: Date | string, tz: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

function utcDate(day: string) {
  return new Date(day + "T12:00:00Z");
}

export function weekdayShort(day: string): string {
  const s = new Intl.DateTimeFormat("ru-RU", { weekday: "short", timeZone: "UTC" }).format(
    utcDate(day),
  );
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function weekdayLong(day: string): string {
  const s = new Intl.DateTimeFormat("ru-RU", { weekday: "long", timeZone: "UTC" }).format(
    utcDate(day),
  );
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function dateLong(day: string): string {
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", timeZone: "UTC" }).format(
    utcDate(day),
  );
}

export function dayNumber(day: string): number {
  return Number(day.slice(8, 10));
}

/** Day of the week: 0 is Sunday, 6 is Saturday. */
export function weekdayIndex(day: string): number {
  return utcDate(day).getUTCDay();
}

/** Monday of the week the day belongs to. */
export function weekStart(day: string): string {
  return addDays(day, -((weekdayIndex(day) + 6) % 7));
}

/** Set of gaming-day hours (indices 0..23) → UTC slots. */
export function hoursToSlots(day: string, hours: number[], tz: string): Slot[] {
  const sorted = [...new Set(hours)].filter((h) => h >= 0 && h < DAY_HOURS).sort((a, b) => a - b);
  const slots: Slot[] = [];
  let runStart = -1;
  sorted.forEach((h, i) => {
    if (runStart < 0) runStart = h;
    if (sorted[i + 1] !== h + 1) {
      const start = hourStart(day, runStart, tz);
      const end = hourStart(day, h + 1, tz);
      // On the spring-forward night there is no 02:00 hour: don't save an empty range.
      if (end > start) slots.push({ start: start.toISOString(), end: end.toISOString() });
      runStart = -1;
    }
  });
  return slots;
}

/** UTC slots → gaming-day hours in which the person is free for at least half an hour. */
export function slotsToHours(day: string, slots: Slot[], tz: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < DAY_HOURS; i++) {
    const a = hourStart(day, i, tz).getTime();
    const b = a + HOUR;
    const covered = slots.reduce((sum, s) => {
      const lo = Math.max(a, new Date(s.start).getTime());
      const hi = Math.min(b, new Date(s.end).getTime());
      return sum + Math.max(0, hi - lo);
    }, 0);
    if (covered >= HOUR / 2) out.push(i);
  }
  return out;
}

export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
