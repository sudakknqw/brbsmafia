import { describe, expect, it } from "vitest";
import {
  DAY_HOURS,
  DAY_START_HOUR,
  addDays,
  calendarDay,
  dayWindow,
  formatTime,
  gamingDay,
  hourStart,
  hoursToSlots,
  isValidTimezone,
  offsetMinutes,
  slotsToHours,
  weekStart,
  weekdayIndex,
  zonedToUtc,
} from "@/lib/time";

// All dates are fixed and in UTC: results depend neither on the machine's time zone nor on "today".
const MSK = "Europe/Moscow"; // +3, no daylight saving time
const BER = "Europe/Berlin"; // +1/+2, transitions on 2026-03-29 and 2026-10-25 at 01:00 UTC
const IST = "Asia/Kolkata"; // +5:30
const NY = "America/New_York"; // −5/−4
const TYO = "Asia/Tokyo"; // +9
const ZONES = [MSK, BER, IST, NY, TYO];

const utc = (iso: string) => new Date(iso);
const iso = (d: Date) => d.toISOString();
const range = (from: number, to: number) => Array.from({ length: to - from }, (_, i) => from + i);

describe("constants", () => {
  it("the gaming day is 24 hours starting at 08:00", () => {
    expect(DAY_START_HOUR).toBe(8);
    expect(DAY_HOURS).toBe(24);
  });
});

describe("offsetMinutes", () => {
  it("fixed-offset zones", () => {
    expect(offsetMinutes(utc("2026-01-15T12:00:00Z"), MSK)).toBe(180);
    expect(offsetMinutes(utc("2026-07-15T12:00:00Z"), MSK)).toBe(180);
    expect(offsetMinutes(utc("2026-05-10T12:00:00Z"), IST)).toBe(330);
    expect(offsetMinutes(utc("2026-05-10T12:00:00Z"), TYO)).toBe(540);
    expect(offsetMinutes(utc("2026-05-10T12:00:00Z"), "UTC")).toBe(0);
  });

  it("daylight saving time", () => {
    expect(offsetMinutes(utc("2026-01-15T12:00:00Z"), BER)).toBe(60);
    expect(offsetMinutes(utc("2026-07-15T12:00:00Z"), BER)).toBe(120);
    expect(offsetMinutes(utc("2026-01-15T12:00:00Z"), NY)).toBe(-300);
    expect(offsetMinutes(utc("2026-07-15T12:00:00Z"), NY)).toBe(-240);
  });

  it("Berlin: exactly at the transition boundary", () => {
    expect(offsetMinutes(utc("2026-03-29T00:59:59Z"), BER)).toBe(60);
    expect(offsetMinutes(utc("2026-03-29T01:00:00Z"), BER)).toBe(120);
    expect(offsetMinutes(utc("2026-10-25T00:59:59Z"), BER)).toBe(120);
    expect(offsetMinutes(utc("2026-10-25T01:00:00Z"), BER)).toBe(60);
  });

  it("milliseconds don't skew the offset", () => {
    expect(offsetMinutes(utc("2026-06-01T00:00:00.999Z"), IST)).toBe(330);
    expect(offsetMinutes(utc("2026-06-01T00:00:00.500Z"), NY)).toBe(-240);
  });
});

describe("zonedToUtc", () => {
  it("regular hours", () => {
    expect(iso(zonedToUtc("2026-05-10", 20, MSK))).toBe("2026-05-10T17:00:00.000Z");
    expect(iso(zonedToUtc("2026-05-10", 8, IST))).toBe("2026-05-10T02:30:00.000Z");
    expect(iso(zonedToUtc("2026-01-10", 8, NY))).toBe("2026-01-10T13:00:00.000Z");
    expect(iso(zonedToUtc("2026-07-10", 8, NY))).toBe("2026-07-10T12:00:00.000Z");
  });

  it("hour ≥ 24 rolls over to the next day", () => {
    expect(iso(zonedToUtc("2026-05-10", 26, MSK))).toBe("2026-05-10T23:00:00.000Z");
    expect(zonedToUtc("2026-05-10", 32, MSK)).toEqual(zonedToUtc("2026-05-11", 8, MSK));
  });

  it("in UTC it crosses the year boundary", () => {
    expect(iso(zonedToUtc("2026-01-01", 8, TYO))).toBe("2025-12-31T23:00:00.000Z");
  });

  it("Berlin before and after the transition", () => {
    expect(iso(zonedToUtc("2026-03-28", 8, BER))).toBe("2026-03-28T07:00:00.000Z");
    expect(iso(zonedToUtc("2026-03-29", 8, BER))).toBe("2026-03-29T06:00:00.000Z");
    expect(iso(zonedToUtc("2026-10-24", 8, BER))).toBe("2026-10-24T06:00:00.000Z");
    expect(iso(zonedToUtc("2026-10-25", 8, BER))).toBe("2026-10-25T07:00:00.000Z");
  });
});

describe("calendarDay", () => {
  it("the date depends on the time zone", () => {
    const t = utc("2026-05-10T21:30:00Z");
    expect(calendarDay(t, MSK)).toBe("2026-05-11");
    expect(calendarDay(t, "UTC")).toBe("2026-05-10");
    expect(calendarDay(t, NY)).toBe("2026-05-10");
  });

  it("Kolkata's half hour", () => {
    expect(calendarDay(utc("2026-05-10T18:29:00Z"), IST)).toBe("2026-05-10");
    expect(calendarDay(utc("2026-05-10T18:30:00Z"), IST)).toBe("2026-05-11");
  });
});

describe("gamingDay", () => {
  it("before 08:00 it's still yesterday's gaming day, from 08:00 a new one", () => {
    expect(gamingDay(utc("2026-05-11T04:59:00Z"), MSK)).toBe("2026-05-10"); // 07:59 MSK
    expect(gamingDay(utc("2026-05-11T05:00:00Z"), MSK)).toBe("2026-05-11"); // 08:00 MSK
  });

  it("the night after midnight stays in the same gaming day", () => {
    const t = utc("2026-05-10T21:30:00Z"); // 00:30 MSK May 11
    expect(calendarDay(t, MSK)).toBe("2026-05-11");
    expect(gamingDay(t, MSK)).toBe("2026-05-10");
    expect(gamingDay(utc("2026-05-10T20:30:00Z"), MSK)).toBe("2026-05-10"); // 23:30 MSK
  });

  it("one moment, different gaming days in different zones", () => {
    const t = utc("2026-05-11T03:00:00Z");
    expect(gamingDay(t, MSK)).toBe("2026-05-10"); // 06:00
    expect(gamingDay(t, TYO)).toBe("2026-05-11"); // 12:00
    expect(gamingDay(t, NY)).toBe("2026-05-10"); // 23:00 May 10
  });

  it("across New Year", () => {
    expect(gamingDay(utc("2025-12-31T22:00:00Z"), TYO)).toBe("2025-12-31"); // 07:00 January 1
    expect(gamingDay(utc("2025-12-31T23:00:00Z"), TYO)).toBe("2026-01-01"); // 08:00
  });

  it("every hour of a gaming day's window belongs to that day (regular date)", () => {
    for (const tz of ZONES) {
      for (const i of range(0, DAY_HOURS)) {
        expect(gamingDay(hourStart("2026-06-15", i, tz), tz), `${tz} #${i}`).toBe("2026-06-15");
      }
    }
  });

  // DST change day: the local day is longer/shorter, so the day is computed from wall-clock time,
  // not by subtracting 8 real hours (previously the morning of March 29, 08:00–09:00 CEST, fell on the 28th).
  it("Berlin, spring transition: 08:30 CEST on March 29 is already a new gaming day", () => {
    expect(gamingDay(utc("2026-03-29T06:30:00Z"), BER)).toBe("2026-03-29");
  });

  // Same in autumn: 07:00–08:00 CET on October 25 is still yesterday's gaming day.
  it("Berlin, autumn transition: 07:30 CET on October 25 is still yesterday's gaming day", () => {
    expect(gamingDay(utc("2026-10-25T06:30:00Z"), BER)).toBe("2026-10-24");
  });
});

describe("addDays", () => {
  it("month and year boundaries", () => {
    expect(addDays("2026-05-10", 0)).toBe("2026-05-10");
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2027-01-01", -1)).toBe("2026-12-31");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2026-05-10", 30)).toBe("2026-06-09");
  });

  it("a DST change day doesn't matter", () => {
    expect(addDays("2026-03-28", 1)).toBe("2026-03-29");
    expect(addDays("2026-03-29", 1)).toBe("2026-03-30");
    expect(addDays("2026-10-25", -1)).toBe("2026-10-24");
  });
});

describe("weekdayIndex and weekStart", () => {
  it("0 is Sunday, 6 is Saturday", () => {
    expect(weekdayIndex("2026-10-05")).toBe(1); // Mon
    expect(weekdayIndex("2026-10-09")).toBe(5); // Fri
    expect(weekdayIndex("2026-10-10")).toBe(6); // Sat
    expect(weekdayIndex("2026-10-11")).toBe(0); // Sun
  });

  it("the week starts on Monday", () => {
    expect(weekStart("2026-10-05")).toBe("2026-10-05");
    expect(weekStart("2026-10-09")).toBe("2026-10-05");
    expect(weekStart("2026-10-11")).toBe("2026-10-05"); // Sunday ends the week
    expect(weekStart("2026-11-01")).toBe("2026-10-26"); // across a month
    expect(weekStart("2027-01-01")).toBe("2026-12-28"); // across a year
  });
});

describe("dayWindow and hourStart", () => {
  it("Moscow: 08:00 → 08:00, index 16 is midnight of the next day", () => {
    const w = dayWindow("2026-05-10", MSK);
    expect(iso(w.start)).toBe("2026-05-10T05:00:00.000Z");
    expect(iso(w.end)).toBe("2026-05-11T05:00:00.000Z");
    expect(hourStart("2026-05-10", 0, MSK)).toEqual(w.start);
    const midnight = hourStart("2026-05-10", 16, MSK);
    expect(iso(midnight)).toBe("2026-05-10T21:00:00.000Z");
    expect(formatTime(midnight, MSK)).toBe("00:00");
    expect(calendarDay(midnight, MSK)).toBe("2026-05-11");
    expect(hourStart("2026-05-10", 24, MSK)).toEqual(w.end);
  });

  it("Kolkata: the window is shifted by half an hour", () => {
    const w = dayWindow("2026-05-10", IST);
    expect(iso(w.start)).toBe("2026-05-10T02:30:00.000Z");
    expect(iso(w.end)).toBe("2026-05-11T02:30:00.000Z");
  });

  it("neighbouring days join without gaps, a regular day is 24 hours", () => {
    for (const tz of ZONES) {
      for (const d of ["2026-05-10", "2026-12-31", "2026-03-28", "2026-10-24"]) {
        expect(dayWindow(d, tz).end, `${tz} ${d}`).toEqual(dayWindow(addDays(d, 1), tz).start);
      }
      const w = dayWindow("2026-06-15", tz);
      expect(w.end.getTime() - w.start.getTime()).toBe(24 * 3600_000);
    }
  });

  it("Berlin: the gaming day is 23 hours in spring and 25 in autumn", () => {
    const spring = dayWindow("2026-03-28", BER);
    expect(iso(spring.start)).toBe("2026-03-28T07:00:00.000Z");
    expect(iso(spring.end)).toBe("2026-03-29T06:00:00.000Z");
    const fall = dayWindow("2026-10-24", BER);
    expect(iso(fall.start)).toBe("2026-10-24T06:00:00.000Z");
    expect(iso(fall.end)).toBe("2026-10-25T07:00:00.000Z");
  });

  it("Berlin, spring: the nonexistent 02:00 hour coincides with 03:00", () => {
    expect(iso(hourStart("2026-03-28", 17, BER))).toBe("2026-03-29T00:00:00.000Z"); // 01:00 CET
    expect(iso(hourStart("2026-03-28", 18, BER))).toBe("2026-03-29T01:00:00.000Z"); // «02:00»
    expect(iso(hourStart("2026-03-28", 19, BER))).toBe("2026-03-29T01:00:00.000Z"); // 03:00 CEST
  });
});

describe("formatTime", () => {
  it("local time in HH:MM format", () => {
    const t = "2026-05-10T17:05:00Z";
    expect(formatTime(t, MSK)).toBe("20:05");
    expect(formatTime(t, IST)).toBe("22:35");
    expect(formatTime(t, NY)).toBe("13:05");
    expect(formatTime(t, TYO)).toBe("02:05");
    expect(formatTime(utc(t), BER)).toBe("19:05");
  });
});

describe("hoursToSlots ↔ slotsToHours", () => {
  const D = "2026-05-10";

  it("consecutive hours merge into one slot", () => {
    expect(hoursToSlots(D, [12, 13, 14], MSK)).toEqual([
      { start: "2026-05-10T17:00:00.000Z", end: "2026-05-10T20:00:00.000Z" },
    ]);
  });

  it("order, duplicates and values outside 0..23 don't matter", () => {
    expect(hoursToSlots(D, [14, 12, 13, 13, -1, 24], MSK)).toEqual(hoursToSlots(D, [12, 13, 14], MSK));
    expect(hoursToSlots(D, [], MSK)).toEqual([]);
  });

  it("gaps produce separate slots", () => {
    expect(hoursToSlots(D, [0, 1, 5], MSK)).toEqual([
      { start: "2026-05-10T05:00:00.000Z", end: "2026-05-10T07:00:00.000Z" },
      { start: "2026-05-10T10:00:00.000Z", end: "2026-05-10T11:00:00.000Z" },
    ]);
  });

  it("a range across midnight is a single slot", () => {
    // 22:00–03:00 MSK
    const slots = hoursToSlots(D, [14, 15, 16, 17, 18], MSK);
    expect(slots).toEqual([{ start: "2026-05-10T19:00:00.000Z", end: "2026-05-11T00:00:00.000Z" }]);
    expect(slotsToHours(D, slots, MSK)).toEqual([14, 15, 16, 17, 18]);
  });

  it("round trip without loss for various time zones", () => {
    const sets = [[], [0], [23], range(0, 24), [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22], [3, 4, 15, 16, 17, 23]];
    for (const tz of ZONES) {
      for (const day of ["2026-05-10", "2026-12-31", "2026-01-01"]) {
        for (const h of sets) {
          expect(slotsToHours(day, hoursToSlots(day, h, tz), tz), `${tz} ${day} ${h}`).toEqual(h);
        }
      }
    }
  });

  it("an hour counts if at least half of it is free", () => {
    const s = (start: string, end: string) => [{ start, end }];
    expect(slotsToHours(D, s("2026-05-10T17:00:00Z", "2026-05-10T17:30:00Z"), MSK)).toEqual([12]);
    expect(slotsToHours(D, s("2026-05-10T17:00:00Z", "2026-05-10T17:29:00Z"), MSK)).toEqual([]);
    expect(slotsToHours(D, s("2026-05-10T17:30:00Z", "2026-05-10T18:30:00Z"), MSK)).toEqual([12, 13]);
  });

  it("slots outside the gaming day are not visible", () => {
    const slots = hoursToSlots("2026-05-11", [0, 1], MSK);
    expect(slotsToHours(D, slots, MSK)).toEqual([]);
  });

  it("two people in different zones marking the same hours get matching slots", () => {
    // 17:00–20:00 UTC: Moscow 20–23 (May 10), New York 13–16 (May 10), Tokyo 02–05 (night of gaming day May 10)
    const moscow = hoursToSlots(D, [12, 13, 14], MSK);
    const newYork = hoursToSlots(D, [5, 6, 7], NY);
    const tokyo = hoursToSlots(D, [18, 19, 20], TYO);
    expect(newYork).toEqual(moscow);
    expect(tokyo).toEqual(moscow);
    // and back: everyone sees the others' slots in their own hours
    expect(slotsToHours(D, moscow, NY)).toEqual([5, 6, 7]);
    expect(slotsToHours(D, newYork, TYO)).toEqual([18, 19, 20]);
    expect(slotsToHours(D, tokyo, MSK)).toEqual([12, 13, 14]);
  });

  it("Kolkata sees Moscow hours shifted by half an hour (half an hour at each edge)", () => {
    // 17:00–19:00 UTC = 22:30–00:30 IST; IST hours start at :30 UTC
    const moscow = hoursToSlots(D, [12, 13], MSK);
    expect(slotsToHours(D, moscow, IST)).toEqual([14, 15, 16]);
  });

  describe("Berlin, spring transition (gaming day 2026-03-28)", () => {
    const S = "2026-03-28";
    it("round trip for existing hours", () => {
      for (const h of [[16, 17], [17], [20, 21], [16, 17, 18, 19, 20], range(0, 24)]) {
        expect(slotsToHours(S, hoursToSlots(S, h, BER), BER), `${h}`).toEqual(h);
      }
    });

    // Known limitation: the grid always has 24 hours, but this day has 23. Hours 18 (the nonexistent "02:00")
    // and 19 (03:00) start at the same UTC moment, so picking 03:00 also lights up "02:00".
    it.fails("a picked 03:00 hour comes back as is", () => {
      expect(slotsToHours(S, hoursToSlots(S, [19], BER), BER)).toEqual([19]);
    });

    // Picking only the nonexistent "02:00" doesn't save an empty zero-length range.
    it("the nonexistent 02:00 hour produces no empty slot", () => {
      const slots = hoursToSlots(S, [18], BER);
      expect(slots.every((s) => s.start !== s.end)).toBe(true);
    });
  });

  describe("Berlin, autumn transition (gaming day 2026-10-24)", () => {
    const F = "2026-10-24";
    it("round trip", () => {
      for (const h of [[16, 17], [17], [18], [17, 18, 19], [16, 17, 18, 19, 20], range(0, 24)]) {
        expect(slotsToHours(F, hoursToSlots(F, h, BER), BER), `${h}`).toEqual(h);
      }
    });

    // Known limitation: this day has 25 hours but the grid has 24. The 01:00 hour spans two real
    // hours (23:00–01:00 UTC): the first "02:00 CEST" sticks to it. Happens once a year at night.
    it.fails("the 01:00 hour is exactly one hour", () => {
      expect(hoursToSlots(F, [17], BER)).toEqual([
        { start: "2026-10-24T23:00:00.000Z", end: "2026-10-25T00:00:00.000Z" },
      ]);
    });
  });
});

describe("isValidTimezone", () => {
  it("real time zones", () => {
    for (const tz of [...ZONES, "UTC"]) expect(isValidTimezone(tz), tz).toBe(true);
  });

  it("garbage is rejected", () => {
    expect(isValidTimezone("Mars/Olympus")).toBe(false);
    expect(isValidTimezone("")).toBe(false);
    expect(isValidTimezone("Europe/Moskva")).toBe(false);
  });
});
