import { describe, expect, it } from "vitest";
import { people, plural, who } from "@/lib/words";

describe("plural", () => {
  const p = (n: number) => plural(n, "игра", "игры", "игр");

  it("1, 21, 101 — «одна»", () => {
    for (const n of [1, 21, 101, 1001]) expect(p(n), String(n)).toBe("игра");
  });

  it("2–4, 22–24 — «несколько»", () => {
    for (const n of [2, 3, 4, 22, 23, 24, 102]) expect(p(n), String(n)).toBe("игры");
  });

  it("0, 5–20, 11–14 и 111–114 — «много»", () => {
    for (const n of [0, 5, 9, 10, 11, 12, 13, 14, 15, 20, 25, 100, 111, 112, 114]) expect(p(n), String(n)).toBe("игр");
  });
});

describe("people", () => {
  it("собирательные числительные", () => {
    expect(people(0)).toBe("никто");
    expect(people(1)).toBe("один");
    expect(people(2)).toBe("двое");
    expect(people(4)).toBe("четверо");
    expect(people(8)).toBe("восьмеро");
    expect(people(10)).toBe("десятеро");
  });

  it("больше десяти — числом", () => {
    expect(people(11)).toBe("11 человек");
    expect(people(25)).toBe("25 человек");
  });
});

describe("who", () => {
  it("один — по нику", () => {
    expect(who(["Лёша"], "Хочет", "Хотят")).toBe("Хочет Лёша");
  });

  it("только ты — глагол на «ты»", () => {
    expect(who(["ты"], "Хочет", "Хотят", "Хочешь")).toBe("Хочешь только ты");
    // без отдельной формы берётся форма для одного
    expect(who(["ты"], "Хочет", "Хотят")).toBe("Хочет только ты");
  });

  it("двое — оба ника", () => {
    expect(who(["Лёша", "Маша"], "Хочет", "Хотят")).toBe("Хотят Лёша и Маша");
    expect(who(["ты", "Маша"], "Хочет", "Хотят", "Хочешь")).toBe("Хотят ты и Маша");
  });

  it("трое и больше — числом", () => {
    expect(who(["a", "b", "c"], "Хочет", "Хотят")).toBe("Хотят трое");
    expect(who(["a", "b", "c", "d", "e", "f", "g", "h"], "Хочет", "Хотят")).toBe("Хотят восьмеро");
  });
});
