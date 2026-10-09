"use client";

import { useState } from "react";
import { Cover } from "@/components/GameArt";
import type { Game } from "@/lib/types";
import { usePresence } from "@/lib/usePresence";
import { wheelToX } from "@/lib/wheel";
import { duration, pct, type Range } from "./timeScale";

type Props = {
  open: boolean;
  range: Range | null;
  hourLabels: string[];
  choices: Game[];
  picked: number[];
  maxGames: number;
  onToggle: (id: number) => void;
  onSearch: () => void;
  onDone: (r: Range) => void;
  onRepick: (r: Range) => void;
  onRemove: () => void;
};

/** Окно выбора игр под моей полосой: плавает поверх строк друзей. */
export function GamesPopover({ open, range, hourLabels, choices, picked, maxGames, onToggle, onSearch, onDone, onRepick, onRemove }: Props) {
  // Окно с играми закрывается плавно; пока уходит — держим его последний отрезок
  // (при «Убрать время» сам отрезок обнуляется сразу).
  const pop = usePresence(open && !!range, 180);
  const [lastRange, setLastRange] = useState(range);
  if (range && lastRange !== range) setLastRange(range);
  const popRange = range ?? lastRange;

  if (!pop.mounted || !popRange) return null;
  return (
    // Плавает поверх строк друзей, прямо под моей полосой.
    <div className="absolute inset-x-0 top-[92px] z-20 sm:left-[170px]">
      <div
        className={`${pop.closing ? "anim-popover-out pointer-events-none" : "anim-popover"} w-full rounded-[20px] border border-line bg-[#1a1a1f] p-4 shadow-[0_24px_60px_rgba(0,0,0,0.55)] sm:ml-[var(--ml)] sm:w-[360px]`}
        style={{ ["--ml" as string]: `clamp(0px, calc(${pct((popRange[0] + popRange[1]) / 2)} - 180px), calc(100% - 360px))` }}
      >
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <span className="text-[15px] font-semibold tabular-nums">
            {hourLabels[popRange[0]]} – {hourLabels[popRange[1]]}
            <span className="ml-2 font-normal text-dim">{duration(popRange)}</span>
          </span>
          <span className="text-[13px] text-dim">во что хочешь, до {maxGames === 5 ? "пяти" : maxGames}</span>
        </div>
        <div ref={wheelToX} className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-1.5">
          {choices.map((g) => {
            const on = picked.includes(g.id);
            return (
              <button
                key={g.id}
                onClick={() => onToggle(g.id)}
                aria-pressed={on}
                aria-label={g.name}
                className={`tile w-[58px] shrink-0 rounded-[10px] ${on ? "tile-on" : "opacity-55"}`}
              >
                <Cover key={g.id} game={g} />
              </button>
            );
          })}
          <button
            onClick={onSearch}
            aria-label="Найти игру"
            className="tile flex aspect-[2/3] w-[58px] shrink-0 items-center justify-center rounded-[10px] bg-glass text-xl text-dim"
          >
            +
          </button>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => onDone(popRange)}
            className="flex-1 rounded-full bg-fg py-2.5 text-[15px] font-semibold text-ink transition active:scale-[0.98]"
          >
            Готово
          </button>
          <button onClick={() => onRepick(popRange)} className="rounded-full bg-glass px-4 py-2.5 text-[15px] transition hover:bg-glass2">
            Другое время
          </button>
          <button onClick={onRemove} className="rounded-full bg-glass px-4 py-2.5 text-[15px] text-dim transition hover:bg-glass2">
            Убрать
          </button>
        </div>
      </div>
    </div>
  );
}
