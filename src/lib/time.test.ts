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

// Все даты фиксированные и в UTC — результат не зависит ни от часового пояса машины, ни от «сегодня».
const MSK = "Europe/Moscow"; // +3, без перехода на летнее время
const BER = "Europe/Berlin"; // +1/+2, переходы 2026-03-29 и 2026-10-25 в 01:00 UTC
const IST = "Asia/Kolkata"; // +5:30
const NY = "America/New_York"; // −5/−4
const TYO = "Asia/Tokyo"; // +9
const ZONES = [MSK, BER, IST, NY, TYO];

const utc = (iso: string) => new Date(iso);
const iso = (d: Date) => d.toISOString();
const range = (from: number, to: number) => Array.from({ length: to - from }, (_, i) => from + i);

describe("константы", () => {
  it("игровой день — 24 часа с 08:00", () => {
    expect(DAY_START_HOUR).toBe(8);
    expect(DAY_HOURS).toBe(24);
  });
});

describe("offsetMinutes", () => {
  it("постоянные пояса", () => {
    expect(offsetMinutes(utc("2026-01-15T12:00:00Z"), MSK)).toBe(180);
    expect(offsetMinutes(utc("2026-07-15T12:00:00Z"), MSK)).toBe(180);
    expect(offsetMinutes(utc("2026-05-10T12:00:00Z"), IST)).toBe(330);
    expect(offsetMinutes(utc("2026-05-10T12:00:00Z"), TYO)).toBe(540);
    expect(offsetMinutes(utc("2026-05-10T12:00:00Z"), "UTC")).toBe(0);
  });

  it("летнее/зимнее время", () => {
    expect(offsetMinutes(utc("2026-01-15T12:00:00Z"), BER)).toBe(60);
    expect(offsetMinutes(utc("2026-07-15T12:00:00Z"), BER)).toBe(120);
    expect(offsetMinutes(utc("2026-01-15T12:00:00Z"), NY)).toBe(-300);
    expect(offsetMinutes(utc("2026-07-15T12:00:00Z"), NY)).toBe(-240);
  });

  it("Берлин: ровно на границе перехода", () => {
    expect(offsetMinutes(utc("2026-03-29T00:59:59Z"), BER)).toBe(60);
    expect(offsetMinutes(utc("2026-03-29T01:00:00Z"), BER)).toBe(120);
    expect(offsetMinutes(utc("2026-10-25T00:59:59Z"), BER)).toBe(120);
    expect(offsetMinutes(utc("2026-10-25T01:00:00Z"), BER)).toBe(60);
  });

  it("миллисекунды не сбивают смещение", () => {
    expect(offsetMinutes(utc("2026-06-01T00:00:00.999Z"), IST)).toBe(330);
    expect(offsetMinutes(utc("2026-06-01T00:00:00.500Z"), NY)).toBe(-240);
  });
});

describe("zonedToUtc", () => {
  it("обычные часы", () => {
    expect(iso(zonedToUtc("2026-05-10", 20, MSK))).toBe("2026-05-10T17:00:00.000Z");
    expect(iso(zonedToUtc("2026-05-10", 8, IST))).toBe("2026-05-10T02:30:00.000Z");
    expect(iso(zonedToUtc("2026-01-10", 8, NY))).toBe("2026-01-10T13:00:00.000Z");
    expect(iso(zonedToUtc("2026-07-10", 8, NY))).toBe("2026-07-10T12:00:00.000Z");
  });

  it("час ≥ 24 переходит на следующие сутки", () => {
    expect(iso(zonedToUtc("2026-05-10", 26, MSK))).toBe("2026-05-10T23:00:00.000Z");
    expect(zonedToUtc("2026-05-10", 32, MSK)).toEqual(zonedToUtc("2026-05-11", 8, MSK));
  });

  it("в UTC переходит через границу года", () => {
    expect(iso(zonedToUtc("2026-01-01", 8, TYO))).toBe("2025-12-31T23:00:00.000Z");
  });

  it("Берлин до и после перехода", () => {
    expect(iso(zonedToUtc("2026-03-28", 8, BER))).toBe("2026-03-28T07:00:00.000Z");
    expect(iso(zonedToUtc("2026-03-29", 8, BER))).toBe("2026-03-29T06:00:00.000Z");
    expect(iso(zonedToUtc("2026-10-24", 8, BER))).toBe("2026-10-24T06:00:00.000Z");
    expect(iso(zonedToUtc("2026-10-25", 8, BER))).toBe("2026-10-25T07:00:00.000Z");
  });
});

describe("calendarDay", () => {
  it("дата зависит от пояса", () => {
    const t = utc("2026-05-10T21:30:00Z");
    expect(calendarDay(t, MSK)).toBe("2026-05-11");
    expect(calendarDay(t, "UTC")).toBe("2026-05-10");
    expect(calendarDay(t, NY)).toBe("2026-05-10");
  });

  it("полчаса у Калькутты", () => {
    expect(calendarDay(utc("2026-05-10T18:29:00Z"), IST)).toBe("2026-05-10");
    expect(calendarDay(utc("2026-05-10T18:30:00Z"), IST)).toBe("2026-05-11");
  });
});

describe("gamingDay", () => {
  it("до 08:00 — ещё вчерашний игровой день, с 08:00 — новый", () => {
    expect(gamingDay(utc("2026-05-11T04:59:00Z"), MSK)).toBe("2026-05-10"); // 07:59 МСК
    expect(gamingDay(utc("2026-05-11T05:00:00Z"), MSK)).toBe("2026-05-11"); // 08:00 МСК
  });

  it("ночь после полуночи остаётся в том же игровом дне", () => {
    const t = utc("2026-05-10T21:30:00Z"); // 00:30 МСК 11 мая
    expect(calendarDay(t, MSK)).toBe("2026-05-11");
    expect(gamingDay(t, MSK)).toBe("2026-05-10");
    expect(gamingDay(utc("2026-05-10T20:30:00Z"), MSK)).toBe("2026-05-10"); // 23:30 МСК
  });

  it("один момент — разные игровые дни у разных поясов", () => {
    const t = utc("2026-05-11T03:00:00Z");
    expect(gamingDay(t, MSK)).toBe("2026-05-10"); // 06:00
    expect(gamingDay(t, TYO)).toBe("2026-05-11"); // 12:00
    expect(gamingDay(t, NY)).toBe("2026-05-10"); // 23:00 10 мая
  });

  it("через Новый год", () => {
    expect(gamingDay(utc("2025-12-31T22:00:00Z"), TYO)).toBe("2025-12-31"); // 07:00 1 января
    expect(gamingDay(utc("2025-12-31T23:00:00Z"), TYO)).toBe("2026-01-01"); // 08:00
  });

  it("каждый час окна игрового дня принадлежит этому дню (обычная дата)", () => {
    for (const tz of ZONES) {
      for (const i of range(0, DAY_HOURS)) {
        expect(gamingDay(hourStart("2026-06-15", i, tz), tz), `${tz} #${i}`).toBe("2026-06-15");
      }
    }
  });

  // БАГ: gamingDay вычитает 8 «настоящих» часов, а в день перевода часов местные сутки
  // длиннее/короче. Утро 29 марта в Берлине 08:00–09:00 CEST относится к 28-му.
  it.fails("Берлин, весенний переход: 08:30 CEST 29 марта — уже новый игровой день", () => {
    expect(gamingDay(utc("2026-03-29T06:30:00Z"), BER)).toBe("2026-03-29");
  });

  // БАГ: то же осенью — 07:00–08:00 CET 25 октября попадает в новый день раньше 08:00.
  it.fails("Берлин, осенний переход: 07:30 CET 25 октября — ещё вчерашний игровой день", () => {
    expect(gamingDay(utc("2026-10-25T06:30:00Z"), BER)).toBe("2026-10-24");
  });
});

describe("addDays", () => {
  it("границы месяцев и лет", () => {
    expect(addDays("2026-05-10", 0)).toBe("2026-05-10");
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2027-01-01", -1)).toBe("2026-12-31");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2026-05-10", 30)).toBe("2026-06-09");
  });

  it("день перевода часов не мешает", () => {
    expect(addDays("2026-03-28", 1)).toBe("2026-03-29");
    expect(addDays("2026-03-29", 1)).toBe("2026-03-30");
    expect(addDays("2026-10-25", -1)).toBe("2026-10-24");
  });
});

describe("weekdayIndex и weekStart", () => {
  it("0 — воскресенье, 6 — суббота", () => {
    expect(weekdayIndex("2026-10-05")).toBe(1); // пн
    expect(weekdayIndex("2026-10-09")).toBe(5); // пт
    expect(weekdayIndex("2026-10-10")).toBe(6); // сб
    expect(weekdayIndex("2026-10-11")).toBe(0); // вс
  });

  it("неделя начинается с понедельника", () => {
    expect(weekStart("2026-10-05")).toBe("2026-10-05");
    expect(weekStart("2026-10-09")).toBe("2026-10-05");
    expect(weekStart("2026-10-11")).toBe("2026-10-05"); // воскресенье — конец недели
    expect(weekStart("2026-11-01")).toBe("2026-10-26"); // через месяц
    expect(weekStart("2027-01-01")).toBe("2026-12-28"); // через год
  });
});

describe("dayWindow и hourStart", () => {
  it("Москва: 08:00 → 08:00, индекс 16 — полночь следующего дня", () => {
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

  it("Калькутта: окно со сдвигом на полчаса", () => {
    const w = dayWindow("2026-05-10", IST);
    expect(iso(w.start)).toBe("2026-05-10T02:30:00.000Z");
    expect(iso(w.end)).toBe("2026-05-11T02:30:00.000Z");
  });

  it("соседние дни стыкуются без зазоров, обычный день — 24 часа", () => {
    for (const tz of ZONES) {
      for (const d of ["2026-05-10", "2026-12-31", "2026-03-28", "2026-10-24"]) {
        expect(dayWindow(d, tz).end, `${tz} ${d}`).toEqual(dayWindow(addDays(d, 1), tz).start);
      }
      const w = dayWindow("2026-06-15", tz);
      expect(w.end.getTime() - w.start.getTime()).toBe(24 * 3600_000);
    }
  });

  it("Берлин: весной игровой день 23 часа, осенью — 25", () => {
    const spring = dayWindow("2026-03-28", BER);
    expect(iso(spring.start)).toBe("2026-03-28T07:00:00.000Z");
    expect(iso(spring.end)).toBe("2026-03-29T06:00:00.000Z");
    const fall = dayWindow("2026-10-24", BER);
    expect(iso(fall.start)).toBe("2026-10-24T06:00:00.000Z");
    expect(iso(fall.end)).toBe("2026-10-25T07:00:00.000Z");
  });

  it("Берлин, весна: несуществующий час 02:00 совпадает с 03:00", () => {
    expect(iso(hourStart("2026-03-28", 17, BER))).toBe("2026-03-29T00:00:00.000Z"); // 01:00 CET
    expect(iso(hourStart("2026-03-28", 18, BER))).toBe("2026-03-29T01:00:00.000Z"); // «02:00»
    expect(iso(hourStart("2026-03-28", 19, BER))).toBe("2026-03-29T01:00:00.000Z"); // 03:00 CEST
  });
});

describe("formatTime", () => {
  it("местное время в формате ЧЧ:ММ", () => {
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

  it("подряд идущие часы склеиваются в один слот", () => {
    expect(hoursToSlots(D, [12, 13, 14], MSK)).toEqual([
      { start: "2026-05-10T17:00:00.000Z", end: "2026-05-10T20:00:00.000Z" },
    ]);
  });

  it("порядок, дубли и выход за 0..23 не важны", () => {
    expect(hoursToSlots(D, [14, 12, 13, 13, -1, 24], MSK)).toEqual(hoursToSlots(D, [12, 13, 14], MSK));
    expect(hoursToSlots(D, [], MSK)).toEqual([]);
  });

  it("разрывы дают отдельные слоты", () => {
    expect(hoursToSlots(D, [0, 1, 5], MSK)).toEqual([
      { start: "2026-05-10T05:00:00.000Z", end: "2026-05-10T07:00:00.000Z" },
      { start: "2026-05-10T10:00:00.000Z", end: "2026-05-10T11:00:00.000Z" },
    ]);
  });

  it("отрезок через полночь — один слот", () => {
    // 22:00–03:00 МСК
    const slots = hoursToSlots(D, [14, 15, 16, 17, 18], MSK);
    expect(slots).toEqual([{ start: "2026-05-10T19:00:00.000Z", end: "2026-05-11T00:00:00.000Z" }]);
    expect(slotsToHours(D, slots, MSK)).toEqual([14, 15, 16, 17, 18]);
  });

  it("туда-обратно без потерь для разных поясов", () => {
    const sets = [[], [0], [23], range(0, 24), [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22], [3, 4, 15, 16, 17, 23]];
    for (const tz of ZONES) {
      for (const day of ["2026-05-10", "2026-12-31", "2026-01-01"]) {
        for (const h of sets) {
          expect(slotsToHours(day, hoursToSlots(day, h, tz), tz), `${tz} ${day} ${h}`).toEqual(h);
        }
      }
    }
  });

  it("час засчитывается, если свободна хотя бы половина", () => {
    const s = (start: string, end: string) => [{ start, end }];
    expect(slotsToHours(D, s("2026-05-10T17:00:00Z", "2026-05-10T17:30:00Z"), MSK)).toEqual([12]);
    expect(slotsToHours(D, s("2026-05-10T17:00:00Z", "2026-05-10T17:29:00Z"), MSK)).toEqual([]);
    expect(slotsToHours(D, s("2026-05-10T17:30:00Z", "2026-05-10T18:30:00Z"), MSK)).toEqual([12, 13]);
  });

  it("слоты вне игрового дня не видны", () => {
    const slots = hoursToSlots("2026-05-11", [0, 1], MSK);
    expect(slotsToHours(D, slots, MSK)).toEqual([]);
  });

  it("двое в разных поясах отмечают одни и те же часы — слоты совпадают", () => {
    // 17:00–20:00 UTC: Москва 20–23 (10 мая), Нью-Йорк 13–16 (10 мая), Токио 02–05 (ночь игрового 10 мая)
    const moscow = hoursToSlots(D, [12, 13, 14], MSK);
    const newYork = hoursToSlots(D, [5, 6, 7], NY);
    const tokyo = hoursToSlots(D, [18, 19, 20], TYO);
    expect(newYork).toEqual(moscow);
    expect(tokyo).toEqual(moscow);
    // и обратно: каждый видит чужие слоты в своих часах
    expect(slotsToHours(D, moscow, NY)).toEqual([5, 6, 7]);
    expect(slotsToHours(D, newYork, TYO)).toEqual([18, 19, 20]);
    expect(slotsToHours(D, tokyo, MSK)).toEqual([12, 13, 14]);
  });

  it("Калькутта видит московские часы со сдвигом на полчаса (оба края по полчаса)", () => {
    // 17:00–19:00 UTC = 22:30–00:30 IST; часы IST начинаются в :30 UTC
    const moscow = hoursToSlots(D, [12, 13], MSK);
    expect(slotsToHours(D, moscow, IST)).toEqual([14, 15, 16]);
  });

  describe("Берлин, весенний переход (игровой день 2026-03-28)", () => {
    const S = "2026-03-28";
    it("туда-обратно для существующих часов", () => {
      for (const h of [[16, 17], [17], [20, 21], [16, 17, 18, 19, 20], range(0, 24)]) {
        expect(slotsToHours(S, hoursToSlots(S, h, BER), BER), `${h}`).toEqual(h);
      }
    });

    // БАГ: часы 18 («02:00», которого нет) и 19 (03:00) начинаются в один момент UTC.
    // Выбор только 03:00 возвращается как [18, 19] — в сетке загорается и «02:00».
    it.fails("выбранный час 03:00 возвращается как есть", () => {
      expect(slotsToHours(S, hoursToSlots(S, [19], BER), BER)).toEqual([19]);
    });

    // БАГ: выбор только «02:00» сохраняет слот нулевой длины и пропадает при чтении.
    it.fails("несуществующий час 02:00 не даёт пустой слот", () => {
      const slots = hoursToSlots(S, [18], BER);
      expect(slots.every((s) => s.start !== s.end)).toBe(true);
    });
  });

  describe("Берлин, осенний переход (игровой день 2026-10-24)", () => {
    const F = "2026-10-24";
    it("туда-обратно", () => {
      for (const h of [[16, 17], [17], [18], [17, 18, 19], [16, 17, 18, 19, 20], range(0, 24)]) {
        expect(slotsToHours(F, hoursToSlots(F, h, BER), BER), `${h}`).toEqual(h);
      }
    });

    // БАГ: час 01:00 занимает два настоящих часа (23:00–01:00 UTC): первые «02:00 CEST»
    // не принадлежат ни одному индексу и молча прилипают к 01:00.
    it.fails("час 01:00 — ровно один час", () => {
      expect(hoursToSlots(F, [17], BER)).toEqual([
        { start: "2026-10-24T23:00:00.000Z", end: "2026-10-25T00:00:00.000Z" },
      ]);
    });
  });
});

describe("isValidTimezone", () => {
  it("настоящие пояса", () => {
    for (const tz of [...ZONES, "UTC"]) expect(isValidTimezone(tz), tz).toBe(true);
  });

  it("мусор отклоняется", () => {
    expect(isValidTimezone("Mars/Olympus")).toBe(false);
    expect(isValidTimezone("")).toBe(false);
    expect(isValidTimezone("Europe/Moskva")).toBe(false);
  });
});
