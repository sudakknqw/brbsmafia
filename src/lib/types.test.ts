import { describe, expect, it } from "vitest";
import { byPlaytime, personalOrder, type Game } from "@/lib/types";

const game = (id: number, name: string, played_recent?: number, played_total?: number): Game => ({
  id,
  steam_appid: null,
  name,
  played_recent,
  played_total,
});

const ids = (games: Game[]) => games.map((g) => g.id);

describe("byPlaytime", () => {
  it("last two weeks first, then all time", () => {
    const a = game(1, "A", 100, 0);
    const b = game(2, "B", 50, 10_000);
    const c = game(3, "C", 50, 20_000);
    expect(ids([a, b, c].sort(byPlaytime))).toEqual([1, 3, 2]);
  });

  it("no data counts as zero", () => {
    expect(byPlaytime(game(1, "A"), game(2, "B", 0, 0))).toBe(0);
    expect(byPlaytime(game(1, "A"), game(2, "B", 1))).toBeGreaterThan(0);
  });
});

describe("personalOrder", () => {
  const games = [
    game(1, "Dota", 10, 100),
    game(2, "Apex", 0, 500),
    game(3, "CS", 300, 300),
    game(4, "Bang", 0, 0),
    game(5, "Among", 0, 0),
  ];

  it("without a saved order: by crew playtime, ties by name", () => {
    expect(ids(personalOrder(games))).toEqual([3, 1, 2, 5, 4]);
  });

  it("saved ones first in their order, new ones at the end", () => {
    expect(ids(personalOrder(games, [4, 2]))).toEqual([4, 2, 3, 1, 5]);
  });

  it("unknown ids in the saved list are ignored", () => {
    expect(ids(personalOrder(games, [99, 5, 42]))).toEqual([5, 3, 1, 2, 4]);
  });

  it("string ids (as from JSON) work too", () => {
    const saved = ["5", "1"] as unknown as number[];
    expect(ids(personalOrder(games, saved))).toEqual([5, 1, 3, 2, 4]);
  });

  it("doesn't mutate the input array", () => {
    const copy = [...games];
    personalOrder(games, [5, 4, 3, 2, 1]);
    expect(games).toEqual(copy);
  });
});
