// Всё время в базе — UTC. Здесь перевод в местное время конкретного человека.
// «Игровой день» идёт с 08:00 до 08:00 следующего дня, чтобы ночные
// посиделки не разрывались на два дня.

export const DAY_START_HOUR = 8;
export const DAY_HOURS = 24;
const HOUR = 3600_000;

export type Slot = { start: string; end: string };

/** Смещение часового пояса от UTC в минутах на данный момент. */
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

/** Местные дата + час (час может быть ≥ 24) → момент в UTC. */
export function zonedToUtc(day: string, hour: number, tz: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d, hour);
  const first = offsetMinutes(new Date(guess), tz);
  const second = offsetMinutes(new Date(guess - first * 60000), tz);
  return new Date(guess - second * 60000);
}

/** Календарная дата YYYY-MM-DD в часовом поясе. */
export function calendarDay(date: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(date);
}

/** Игровой день, в который попадает момент. */
export function gamingDay(date: Date, tz: string): string {
  return calendarDay(new Date(date.getTime() - DAY_START_HOUR * HOUR), tz);
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

/** Начало i-го часа игрового дня. */
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

/** Номер дня недели: 0 — вс, 6 — сб. */
export function weekdayIndex(day: string): number {
  return utcDate(day).getUTCDay();
}

/** Понедельник недели, в которую попадает день. */
export function weekStart(day: string): string {
  return addDays(day, -((weekdayIndex(day) + 6) % 7));
}

/** Набор часов игрового дня (индексы 0..23) → слоты UTC. */
export function hoursToSlots(day: string, hours: number[], tz: string): Slot[] {
  const sorted = [...new Set(hours)].filter((h) => h >= 0 && h < DAY_HOURS).sort((a, b) => a - b);
  const slots: Slot[] = [];
  let runStart = -1;
  sorted.forEach((h, i) => {
    if (runStart < 0) runStart = h;
    if (sorted[i + 1] !== h + 1) {
      slots.push({
        start: hourStart(day, runStart, tz).toISOString(),
        end: hourStart(day, h + 1, tz).toISOString(),
      });
      runStart = -1;
    }
  });
  return slots;
}

/** Слоты UTC → часы игрового дня, где человек свободен хотя бы полчаса. */
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
