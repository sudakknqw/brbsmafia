import { describe, expect, it } from "vitest";
import { bestWindow, dayStats, entryFor } from "@/lib/overlap";
import { DAY_HOURS, hoursToSlots, type Slot } from "@/lib/time";
import type { DayEntry, Member } from "@/lib/types";

const member = (id: string, timezone: string): Member => ({ id, name: id, avatar_url: null, timezone });

const entry = (user_id: string, day: string, slots: Slot[], status: DayEntry["status"] = "free"): DayEntry => ({
  user_id,
  day,
  status,
  slots,
  game_ids: [],
});

const counts = (pairs: Record<number, number>) => {
  const out = new Array<number>(DAY_HOURS).fill(0);
  for (const [h, n] of Object.entries(pairs)) out[+h] = n;
  return out;
};

describe("bestWindow", () => {
  it("меньше двоих — окна нет", () => {
    expect(bestWindow([])).toBeNull();
    expect(bestWindow(counts({}))).toBeNull();
    expect(bestWindow(counts({ 3: 1, 4: 1, 5: 1 }))).toBeNull();
  });

  it("берёт часы с максимумом, а не самый длинный отрезок вообще", () => {
    expect(bestWindow([2, 2, 2, 3, 0])).toEqual({ from: 3, to: 4, count: 3 });
  });

  it("среди отрезков с максимумом — самый длинный", () => {
    expect(bestWindow([3, 0, 3, 3, 1])).toEqual({ from: 2, to: 4, count: 3 });
    expect(bestWindow([0, 2, 2, 0, 2])).toEqual({ from: 1, to: 3, count: 2 });
  });

  it("при равной длине побеждает более ранний", () => {
    expect(bestWindow([2, 0, 2])).toEqual({ from: 0, to: 1, count: 2 });
    expect(bestWindow([0, 4, 4, 1, 4, 4])).toEqual({ from: 1, to: 3, count: 4 });
  });

  it("отрезок до конца дня и весь день", () => {
    expect(bestWindow([0, 0, 2, 2])).toEqual({ from: 2, to: 4, count: 2 });
    expect(bestWindow(new Array(DAY_HOURS).fill(2))).toEqual({ from: 0, to: DAY_HOURS, count: 2 });
  });
});

describe("dayStats", () => {
  // Зритель — в Москве, игровой день 2026-05-10 = 05:00 UTC 10 мая … 05:00 UTC 11 мая.
  const D = "2026-05-10";
  const MSK = "Europe/Moscow";
  const TYO = "Asia/Tokyo";
  const NY = "America/New_York";
  const BER = "Europe/Berlin";

  const members = [member("a", MSK), member("b", TYO), member("c", NY), member("d", BER)];
  const entries: DayEntry[] = [
    // a: 20:00–23:00 МСК
    entry("a", D, hoursToSlots(D, [12, 13, 14], MSK)),
    // b, Токио: свой 10 мая 02:00–04:00 JST (= 20–22 МСК)…
    entry("b", D, hoursToSlots(D, [18, 19], TYO)),
    // …и свой СЛЕДУЮЩИЙ день 08:00–10:00 JST 11 мая (= 02:00–04:00 МСК, ещё наш 10-й)
    entry("b", "2026-05-11", hoursToSlots("2026-05-11", [0, 1], TYO)),
    // c, Нью-Йорк: хвост своего ПРЕДЫДУЩЕГО дня 05:00–07:00 EDT 10 мая (= 12:00–14:00 МСК)…
    entry("c", "2026-05-09", hoursToSlots("2026-05-09", [21, 22], NY)),
    // …и свой 10 мая 13:00–16:00 EDT (= 20–23 МСК)
    entry("c", D, hoursToSlots(D, [5, 6, 7], NY)),
    // d «Не может»: даже если слоты остались, они не считаются
    entry("d", D, hoursToSlots(D, [12, 13, 14], BER), "busy"),
    // чужой человек вне компании не влияет
    entry("zz", D, hoursToSlots(D, [12, 13, 14], MSK)),
  ];

  it("часы каждого — в поясе зрителя", () => {
    const { freeHours } = dayStats(D, MSK, members, entries);
    expect(freeHours.get("a")).toEqual([12, 13, 14]);
    expect(freeHours.get("b")).toEqual([12, 13, 18, 19]);
    expect(freeHours.get("c")).toEqual([4, 5, 12, 13, 14]);
    expect(freeHours.get("d")).toEqual([]);
    expect(freeHours.has("zz")).toBe(false);
  });

  it("счётчики и лучшее окно", () => {
    const { counts: c, best } = dayStats(D, MSK, members, entries);
    expect(c).toHaveLength(DAY_HOURS);
    expect(c).toEqual(counts({ 4: 1, 5: 1, 12: 3, 13: 3, 14: 2, 18: 1, 19: 1 }));
    expect(best).toEqual({ from: 12, to: 14, count: 3 });
  });

  it("тот же расклад глазами токийца", () => {
    const { freeHours, best } = dayStats(D, TYO, members, entries);
    // 17:00–20:00 UTC = 02:00–05:00 JST → индексы 18..20
    expect(freeHours.get("a")).toEqual([18, 19, 20]);
    // следующий день b (23:00 UTC 10 мая и позже) в токийский 10-й не попадает
    expect(freeHours.get("b")).toEqual([18, 19]);
    // 09:00–11:00 UTC = 18:00–20:00 JST → индексы 10, 11
    expect(freeHours.get("c")).toEqual([10, 11, 18, 19, 20]);
    expect(best).toEqual({ from: 18, to: 20, count: 3 });
  });

  it("никого свободного — пусто и без окна", () => {
    const { freeHours, counts: c, best } = dayStats(D, MSK, members, []);
    expect([...freeHours.values()].every((h) => h.length === 0)).toBe(true);
    expect(c.every((n) => n === 0)).toBe(true);
    expect(best).toBeNull();
  });
});

describe("entryFor", () => {
  const list = [
    entry("a", "2026-05-10", []),
    entry("a", "2026-05-11", [], "busy"),
    entry("b", "2026-05-10", []),
  ];

  it("ищет по человеку и дню", () => {
    expect(entryFor(list, "a", "2026-05-11")).toBe(list[1]);
    expect(entryFor(list, "b", "2026-05-10")).toBe(list[2]);
  });

  it("нет записи — undefined", () => {
    expect(entryFor(list, "b", "2026-05-11")).toBeUndefined();
    expect(entryFor([], "a", "2026-05-10")).toBeUndefined();
  });
});
