"use client";

import { useRef, useState, useTransition } from "react";
import { clearDay, saveDay, setBusy } from "@/app/actions";
import { Cover } from "./GameArt";
import { GameSearch } from "./GameSearch";
import { Sheet } from "./Sheet";
import type { Game } from "@/lib/types";
import type { EditorSeed } from "@/lib/views";

// Часы игрового дня: 0 = 08:00.
const PRESETS = [
  { label: "Вечер", hours: [11, 12, 13, 14, 15] },
  { label: "Ночь", hours: [14, 15, 16, 17, 18] },
  { label: "Весь день", hours: Array.from({ length: 18 }, (_, i) => i + 2) },
];

type Props = {
  open: boolean;
  onClose: () => void;
  seed: EditorSeed;
  title: string;
  games: Game[];
  recent: Game[];
  maxGames: number;
};

/** Отметить своё время и игры на день. Монтируется заново при каждом открытии. */
export function EditorSheet(props: Props) {
  if (!props.open) return null;
  return <EditorBody {...props} />;
}

function EditorBody({ onClose, seed, title, games, recent, maxGames }: Props) {
  const [hours, setHours] = useState<Set<number>>(new Set(seed.initialHours));
  const [picked, setPicked] = useState<number[]>(seed.initialGames);
  const [searching, setSearching] = useState(false);
  const [, start] = useTransition();
  const drag = useRef<boolean | null>(null);

  const paint = (h: number) =>
    setHours((prev) => {
      const next = new Set(prev);
      if (drag.current) next.add(h);
      else next.delete(h);
      return next;
    });

  const hourAt = (x: number, y: number) => {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-h]");
    return el ? Number(el.dataset.h) : null;
  };

  const togglePick = (id: number) =>
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= maxGames ? prev : [...prev, id]));

  // Закрываем сразу, сохранение идёт в фоне — без ожидания сервера.
  const commit = (fn: () => Promise<void>) => {
    onClose();
    start(fn);
  };

  const choices = [...recent, ...games.filter((g) => !recent.some((r) => r.id === g.id))];

  return (
    <>
      <Sheet open onClose={onClose} title={title}>
        <div className="mb-3 flex items-center gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => setHours((prev) => new Set([...prev, ...p.hours]))}
              className="rounded-full bg-glass px-3.5 py-1.5 text-sm font-medium transition hover:bg-glass2 active:scale-95"
            >
              {p.label}
            </button>
          ))}
          {hours.size > 0 && (
            <button onClick={() => setHours(new Set())} className="ml-auto px-1 text-sm text-dim transition hover:text-fg">
              Сбросить
            </button>
          )}
        </div>

        <div
          className="grid touch-none grid-cols-4 gap-1.5 select-none sm:grid-cols-6"
          onPointerDown={(e) => {
            const h = hourAt(e.clientX, e.clientY);
            if (h === null) return;
            drag.current = !hours.has(h);
            paint(h);
          }}
          onPointerMove={(e) => {
            if (drag.current === null) return;
            const h = hourAt(e.clientX, e.clientY);
            if (h !== null) paint(h);
          }}
          onPointerUp={() => (drag.current = null)}
          onPointerLeave={() => (drag.current = null)}
        >
          {seed.hourLabels.slice(0, -1).map((label, h) => (
            <div
              key={h}
              data-h={h}
              className={`rounded-xl py-2.5 text-center text-sm tabular-nums transition duration-150 ${
                hours.has(h) ? "scale-[1.03] bg-fg font-semibold text-ink" : "bg-glass text-dim"
              }`}
            >
              {label}
            </div>
          ))}
        </div>
        <p className="mt-2.5 text-[13px] text-faint">Проведи по часам пальцем или мышкой. Время твоё, местное.</p>

        <div className="mt-7 mb-3 flex items-baseline justify-between">
          <h3 className="text-[17px] font-semibold">Во что хочешь</h3>
          <span className="text-[13px] text-dim tabular-nums">
            {picked.length} из {maxGames}
          </span>
        </div>
        <div className="no-scrollbar -mx-5 flex gap-3 overflow-x-auto px-5 py-1.5">
          {choices.map((g) => {
            const on = picked.includes(g.id);
            return (
              <button
                key={g.id}
                onClick={() => togglePick(g.id)}
                aria-pressed={on}
                aria-label={g.name}
                className={`tile w-[76px] shrink-0 rounded-[10px] ${on ? "tile-on" : "opacity-60"}`}
              >
                <Cover key={g.id} game={g} />
              </button>
            );
          })}
          <button
            onClick={() => setSearching(true)}
            aria-label="Найти игру"
            className="tile flex aspect-[2/3] w-[76px] shrink-0 items-center justify-center rounded-[10px] bg-glass text-2xl text-dim"
          >
            +
          </button>
        </div>

        <button
          disabled={!hours.size}
          onClick={() => commit(() => saveDay(seed.day, [...hours], picked))}
          className="mt-7 w-full rounded-full bg-fg py-3.5 text-[16px] font-semibold text-ink transition active:scale-[0.98] disabled:opacity-40"
        >
          {hours.size ? "Сохранить" : "Выбери часы"}
        </button>
        <div className="mt-2.5 grid grid-cols-2 gap-2.5">
          <button onClick={() => commit(() => setBusy(seed.day))} className="rounded-full bg-glass py-3 text-[15px] font-medium transition hover:bg-glass2">
            Не смогу
          </button>
          <button onClick={() => commit(() => clearDay(seed.day))} className="rounded-full bg-glass py-3 text-[15px] text-dim transition hover:bg-glass2">
            Очистить
          </button>
        </div>
      </Sheet>

      <Sheet open={searching} onClose={() => setSearching(false)} title="Найти игру">
        <GameSearch
          onPick={(id) => {
            togglePick(id);
            setSearching(false);
          }}
        />
      </Sheet>
    </>
  );
}
