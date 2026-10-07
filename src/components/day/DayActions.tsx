"use client";

import { useState } from "react";
import { EditorSheet } from "@/components/EditorSheet";
import type { Game } from "@/lib/types";
import type { EditorSeed } from "@/lib/views";

export function DayActions({
  seed,
  title,
  games,
  recent,
  maxGames,
}: {
  seed: EditorSeed;
  title: string;
  games: Game[];
  recent: Game[];
  maxGames: number;
}) {
  const [open, setOpen] = useState(false);
  const marked = seed.initialHours.length > 0;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-full bg-fg px-6 py-3 text-[16px] font-semibold text-ink transition hover:scale-[1.03] active:scale-[0.97]"
      >
        {marked ? "Изменить моё время" : seed.busy ? "Всё-таки смогу" : "Отметить моё время"}
      </button>
      <EditorSheet
        open={open}
        onClose={() => setOpen(false)}
        seed={seed}
        title={`${title}: моё время`}
        games={games}
        recent={recent}
        maxGames={maxGames}
      />
    </>
  );
}
