"use client";

import { useRef, useState, useTransition } from "react";
import { clearDay, saveDay, setBusy } from "@/app/actions";
import { GameCover } from "@/components/GameCover";
import { GameSearch } from "@/components/GameSearch";
import { Sheet } from "@/components/Sheet";
import type { Game } from "@/lib/types";

// Часы игрового дня: 0 = 08:00.
const PRESETS = [
  { label: "Вечер", hours: [11, 12, 13, 14, 15] },
  { label: "Ночь", hours: [14, 15, 16, 17, 18] },
  { label: "Весь день", hours: Array.from({ length: 18 }, (_, i) => i + 2) },
];

type Props = {
  day: string;
  hourLabels: string[];
  initialHours: number[];
  initialGames: number[];
  busy: boolean;
  games: Game[];
  recent: Game[];
  maxGames: number;
};

export function DayEditor({ day, hourLabels, initialHours, initialGames, busy, games, recent, maxGames }: Props) {
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [hours, setHours] = useState<Set<number>>(new Set(initialHours));
  const [picked, setPicked] = useState<number[]>(initialGames);
  const [pending, start] = useTransition();
  const drag = useRef<{ on: boolean } | null>(null);

  const reset = () => {
    setHours(new Set(initialHours));
    setPicked(initialGames);
    setOpen(true);
  };

  const paint = (h: number) =>
    setHours((prev) => {
      const next = new Set(prev);
      if (drag.current?.on) next.add(h);
      else next.delete(h);
      return next;
    });

  const hourFromPoint = (x: number, y: number) => {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-h]");
    return el ? Number(el.dataset.h) : null;
  };

  const togglePick = (id: number) =>
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= maxGames ? prev : [...prev, id]));

  const finish = (fn: () => Promise<void>) =>
    start(async () => {
      await fn();
      setOpen(false);
    });

  // Сначала недавние, потом остальная полка.
  const choices = [...recent, ...games.filter((g) => !recent.some((r) => r.id === g.id))];
  const hasTime = initialHours.length > 0;

  return (
    <>
      <button onClick={reset} className="rounded-full bg-accent px-5 py-2.5 text-[15px] font-semibold text-white">
        {hasTime ? "Изменить своё время" : busy ? "Всё-таки могу" : "Отметить своё время"}
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title="Когда ты свободен">
        <div className="mb-3 flex gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => setHours((prev) => new Set([...prev, ...p.hours]))}
              className="rounded-full bg-elev px-3.5 py-1.5 text-sm hover:bg-elev2"
            >
              {p.label}
            </button>
          ))}
          <button onClick={() => setHours(new Set())} className="ml-auto px-1 text-sm text-dim hover:text-fg">
            Сбросить
          </button>
        </div>

        <div
          className="grid touch-none select-none grid-cols-4 gap-1.5"
          onPointerDown={(e) => {
            const h = hourFromPoint(e.clientX, e.clientY);
            if (h === null) return;
            drag.current = { on: !hours.has(h) };
            paint(h);
          }}
          onPointerMove={(e) => {
            if (!drag.current) return;
            const h = hourFromPoint(e.clientX, e.clientY);
            if (h !== null) paint(h);
          }}
          onPointerUp={() => (drag.current = null)}
          onPointerLeave={() => (drag.current = null)}
        >
          {hourLabels.slice(0, -1).map((label, h) => (
            <div
              key={h}
              data-h={h}
              className={`rounded-lg py-2 text-center text-sm tabular-nums transition-colors ${
                hours.has(h) ? "bg-accent font-semibold text-white" : "bg-elev text-dim"
              }`}
            >
              {label}
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-dim">Проведи пальцем или мышкой по часам. Время — твоё местное.</p>

        <div className="mt-6 mb-2 flex items-baseline justify-between">
          <h3 className="text-[15px] font-semibold">Во что хочешь</h3>
          <span className="text-xs text-dim">
            {picked.length} из {maxGames}
          </span>
        </div>
        <div className="no-scrollbar -mx-5 flex gap-2.5 overflow-x-auto px-5 pb-1">
          {choices.map((g) => {
            const on = picked.includes(g.id);
            return (
              <button
                key={g.id}
                onClick={() => togglePick(g.id)}
                className={`w-[72px] shrink-0 rounded-xl transition ${on ? "ring-2 ring-accent ring-offset-2 ring-offset-card" : "opacity-70 hover:opacity-100"}`}
                aria-pressed={on}
                aria-label={g.name}
              >
                <GameCover key={g.id} game={g} />
              </button>
            );
          })}
          <button
            onClick={() => setSearching(true)}
            className="flex aspect-[2/3] w-[72px] shrink-0 items-center justify-center rounded-xl border border-dashed border-line text-2xl text-dim hover:text-fg"
            aria-label="Найти игру"
          >
            +
          </button>
        </div>

        <button
          disabled={pending || !hours.size}
          onClick={() => finish(() => saveDay(day, [...hours], picked))}
          className="mt-6 w-full rounded-xl bg-accent py-3 text-[15px] font-semibold text-white disabled:opacity-50"
        >
          {pending ? "Сохраняем…" : hours.size ? "Сохранить" : "Выбери часы"}
        </button>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button disabled={pending} onClick={() => finish(() => setBusy(day))} className="rounded-xl bg-elev py-3 text-[15px] disabled:opacity-50">
            Не могу в этот день
          </button>
          <button disabled={pending} onClick={() => finish(() => clearDay(day))} className="rounded-xl bg-elev py-3 text-[15px] text-dim disabled:opacity-50">
            Очистить
          </button>
        </div>
      </Sheet>

      <Sheet open={searching} onClose={() => setSearching(false)} title="Найти игру">
        <GameSearch
          recent={[]}
          onPick={(id) => {
            togglePick(id);
            setSearching(false);
          }}
        />
      </Sheet>
    </>
  );
}
