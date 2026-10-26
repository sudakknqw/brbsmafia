import { describe, expect, it } from "vitest";
import { people, plural, who } from "@/lib/words";

describe("plural", () => {
  const p = (n: number) => plural(n, "игра", "игры", "игр");

  it("1, 21, 101: singular", () => {
    for (const n of [1, 21, 101, 1001]) expect(p(n), String(n)).toBe("игра");
  });

  it("2–4, 22–24: 'few' form", () => {
    for (const n of [2, 3, 4, 22, 23, 24, 102]) expect(p(n), String(n)).toBe("игры");
  });

  it("0, 5–20, 11–14 and 111–114: 'many' form", () => {
    for (const n of [0, 5, 9, 10, 11, 12, 13, 14, 15, 20, 25, 100, 111, 112, 114]) expect(p(n), String(n)).toBe("игр");
  });
});

describe("people", () => {
  it("collective numerals", () => {
    expect(people(0)).toBe("никто");
    expect(people(1)).toBe("один");
    expect(people(2)).toBe("двое");
    expect(people(4)).toBe("четверо");
    expect(people(8)).toBe("восьмеро");
    expect(people(10)).toBe("десятеро");
  });

  it("more than ten: as a number", () => {
    expect(people(11)).toBe("11 человек");
    expect(people(25)).toBe("25 человек");
  });
});

describe("who", () => {
  it("one: by name", () => {
    expect(who(["Лёша"], "Хочет", "Хотят")).toBe("Хочет Лёша");
  });

  it("only you: second-person verb", () => {
    expect(who(["ты"], "Хочет", "Хотят", "Хочешь")).toBe("Хочешь только ты");
    // with no separate form, the singular form is used
    expect(who(["ты"], "Хочет", "Хотят")).toBe("Хочет только ты");
  });

  it("two: both names", () => {
    expect(who(["Лёша", "Маша"], "Хочет", "Хотят")).toBe("Хотят Лёша и Маша");
    expect(who(["ты", "Маша"], "Хочет", "Хотят", "Хочешь")).toBe("Хотят ты и Маша");
  });

  it("three or more: as a number", () => {
    expect(who(["a", "b", "c"], "Хочет", "Хотят")).toBe("Хотят трое");
    expect(who(["a", "b", "c", "d", "e", "f", "g", "h"], "Хочет", "Хотят")).toBe("Хотят восьмеро");
  });
});
