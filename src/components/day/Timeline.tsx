"use client";

import { useEffect, useRef, useState } from "react";
import { GameSearch } from "@/components/GameSearch";
import { NamesHint } from "@/components/NamesHint";
import { Sheet } from "@/components/Sheet";
import { bestWindow } from "@/lib/overlap";
import { noMatchPhrase } from "@/lib/phrases";
import { DAY_HOURS } from "@/lib/time";
import type { Game } from "@/lib/types";
import { who } from "@/lib/words";
import { FriendRows } from "./FriendRows";
import { GamesPopover } from "./GamesPopover";
import { MyRow } from "./MyRow";
import { TimeDial } from "./TimeDial";
import { duration, pct, shortHour, type Row } from "./timeScale";
import { useMyTime } from "./useMyTime";

type Props = {
  day: string;
  hourLabels: string[];
  rows: Row[];
  meId: string;
  initialGames: number[];
  games: Game[];
  recent: Game[];
  maxGames: number;
  /** Подсказка «нажми в своей строке» сразу при открытии. */
  invite?: boolean;
  viewerTz: string;
};

/**
 * Шкала дня. В своей строке время отмечается прямо здесь: нажал начало,
 * нажал конец — появляется окно с выбором игр. Общее окно пересчитывается сразу.
 */
export function Timeline({ day, hourLabels, rows, meId, initialGames, games, recent, maxGames, invite, viewerTz }: Props) {
  const mine = rows.find((r) => r.member.id === meId)!;
  const others = rows.filter((r) => r.member.id !== meId);

  const t = useMyTime({ day, mine, others, initialGames, maxGames });
  const { range, busy, anchor, preview } = t;
  const [searching, setSearching] = useState(false);
  const myRow = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (invite) myRow.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [invite]);

  // Общее окно — с учётом моего ещё не сохранённого времени.
  const counts = new Array<number>(DAY_HOURS).fill(0);
  others.forEach((r) => r.hours.forEach((h) => counts[h]++));
  if (range) for (let h = range[0]; h < range[1]; h++) counts[h]++;
  const best = bestWindow(counts);
  const bestNames = best
    ? [
        ...(range && range[0] <= best.from && best.from < range[1] ? ["ты"] : []),
        ...others.filter((r) => r.hours.includes(best.from)).map((r) => r.member.name),
      ]
    : [];

  // Сначала недавно выбранные тобой, дальше — в твоём порядке из библиотеки.
  const choices = [...recent, ...games.filter((g) => !recent.some((r) => r.id === g.id))];

  const hint = range
    ? "Нажми на свою полосу, чтобы поменять игры или убрать время"
    : anchor !== null
      ? `${hourLabels[preview![0]]} – ${hourLabels[preview![1]]}, ${duration(preview!)}. Нажми, до какого часа`
      : busy
        ? "Ты отметил, что не сможешь. Нажми на шкалу, если планы поменялись"
        : "Нажми в своей строке, с какого часа ты свободен";
  // На телефоне время выбирается на циферблате — подсказка другая.
  const phoneHint = !range && anchor === null && !busy ? "Нажми на свою строку, чтобы отметить время" : null;

  return (
    <section className="rounded-[24px] bg-glass p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className={`text-[15px] ${anchor !== null || (invite && !range && !busy) ? "font-medium text-fg" : "text-dim"}`}>
          {phoneHint ? (
            <>
              <span className="sm:hidden">{phoneHint}</span>
              <span className="hidden sm:inline">{hint}</span>
            </>
          ) : (
            hint
          )}
        </p>
        <p className="text-[13px] text-dim tabular-nums">
          {best ? (
            <>
              Все вместе {hourLabels[best.from]} – {hourLabels[best.to]},{" "}
              <NamesHint names={bestNames}>{who(bestNames, "свободен", "свободны")}</NamesHint>
            </>
          ) : (
            noMatchPhrase(day)
          )}
        </p>
      </div>

      <div className="relative grid grid-cols-[104px_minmax(0,1fr)] gap-x-3 sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-x-5">
        {/* Ось часов */}
        <div />
        {/* Подписи — просто часы («18»): на компьютере каждый час, на телефоне — каждые три (иначе слипаются). */}
        <div className="relative mb-3 h-4 text-[11px] text-faint tabular-nums sm:text-[12px]">
          {hourLabels.map((label, i) => (
            <span key={i} className={`absolute -translate-x-1/2 ${i % 3 ? "hidden sm:block" : ""}`} style={{ left: pct(i) }}>
              {shortHour(label)}
            </span>
          ))}
        </div>

        <MyRow
          rowRef={myRow}
          member={mine.member}
          hourLabels={hourLabels}
          range={range}
          busy={busy}
          anchor={anchor}
          preview={preview}
          grown={t.grown}
          onBusy={t.markBusy}
          onBar={t.togglePopover}
          onPick={t.pick}
          onHover={t.hoverHour}
        />

        {/* Остальные */}
        <FriendRows day={day} rows={others} hourLabels={hourLabels} viewerTz={viewerTz} />

        {/* Общее окно поверх всех строк */}
        {best && (
          <div className="pointer-events-none absolute top-7 bottom-0 left-[116px] right-0 sm:left-[170px]" aria-hidden="true">
            <div
              className="absolute -inset-y-1 rounded-xl bg-white/[0.05] shadow-[0_0_0_1.5px_#fff] transition-all duration-300"
              style={{ left: pct(best.from), width: pct(best.to - best.from) }}
            />
          </div>
        )}

        {/* Окно выбора игр под моей полосой */}
        <GamesPopover
          open={t.popover}
          range={range}
          hourLabels={hourLabels}
          choices={choices}
          picked={t.picked}
          maxGames={maxGames}
          onToggle={t.togglePick}
          onSearch={() => setSearching(true)}
          onDone={t.done}
          onRepick={t.repick}
          onRemove={t.remove}
        />
      </div>

      <Sheet open={t.dial} onClose={t.closeDial} title="Когда свободен">
        <p className="-mt-3 mb-3 text-[14px] text-dim">Тяни точки по кругу. Светлые деления внутри — когда свободны остальные.</p>
        <TimeDial value={t.dialValue} onChange={t.setDialValue} hourLabels={hourLabels} others={t.othersCounts} />
        <button
          onClick={t.confirmDial}
          className="mt-5 w-full rounded-full bg-fg py-3.5 text-[16px] font-semibold text-ink transition active:scale-[0.98]"
        >
          Дальше: игры
        </button>
        {range && (
          <button
            onClick={() => {
              t.closeDial();
              t.remove();
            }}
            className="mt-2 w-full rounded-full py-3 text-[15px] text-dim transition hover:text-fg"
          >
            Убрать время
          </button>
        )}
      </Sheet>

      <Sheet open={searching} onClose={() => setSearching(false)} title="Найти игру">
        <GameSearch
          onPick={(id) => {
            t.togglePick(id);
            setSearching(false);
          }}
        />
      </Sheet>
    </section>
  );
}
