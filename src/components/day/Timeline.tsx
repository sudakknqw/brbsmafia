"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { clearDay, saveDay, setBusy } from "@/app/actions";
import { Avatar } from "@/components/Avatar";
import { Cover } from "@/components/GameArt";
import { GameSearch } from "@/components/GameSearch";
import { Sheet } from "@/components/Sheet";
import { memberColor } from "@/lib/colors";
import { bestWindow } from "@/lib/overlap";
import { DAY_HOURS } from "@/lib/time";
import { wheelToX } from "@/lib/wheel";
import { byPlaytime, type Game, type Member } from "@/lib/types";
import { plural, who } from "@/lib/words";
import { busyPhrase, noMatchPhrase } from "@/lib/phrases";
import { NamesHint } from "@/components/NamesHint";
import { FriendTime } from "@/components/FriendTime";
import { haptic } from "@/lib/tg";

type Row = { member: Member; hours: number[]; state: "free" | "busy" | "silent"; note: string | null };
type Range = [number, number];

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

const pct = (i: number) => `${(i / DAY_HOURS) * 100}%`;
const LOUPE = 12; // сколько часов в увеличенной полосе на телефоне

function runs(hours: number[]): Range[] {
  const out: Range[] = [];
  for (const h of [...hours].sort((a, b) => a - b)) {
    const last = out[out.length - 1];
    if (last && last[1] === h) last[1] = h + 1;
    else out.push([h, h + 1]);
  }
  return out;
}

function duration([a, b]: Range) {
  const n = b - a;
  return `${n} ${plural(n, "час", "часа", "часов")}`;
}

/** Красный кружок «NO»: не смогу в этот день. */
function NoButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      aria-label={active ? "Всё-таки смогу" : "Не смогу в этот день"}
      title={active ? "Всё-таки смогу" : "Не смогу"}
      className={`flex size-7 shrink-0 items-center justify-center rounded-full text-[9px] font-extrabold tracking-wide transition active:scale-90 ${
        active ? "bg-bad text-white" : "text-faint ring-1 ring-white/20 hover:bg-bad/20 hover:text-bad hover:ring-bad/60"
      }`}
    >
      NO
    </button>
  );
}

/** Один промежуток на день: если в базе их несколько, берём от первого до последнего часа. */
function toRange(hours: number[]): Range | null {
  if (!hours.length) return null;
  return [Math.min(...hours), Math.max(...hours) + 1];
}

/**
 * Шкала дня. В своей строке время отмечается прямо здесь: нажал начало,
 * нажал конец — появляется окно с выбором игр. Общее окно пересчитывается сразу.
 */
export function Timeline({ day, hourLabels, rows, meId, initialGames, games, recent, maxGames, invite, viewerTz }: Props) {
  const mine = rows.find((r) => r.member.id === meId)!;
  const others = rows.filter((r) => r.member.id !== meId);

  const [range, setRange] = useState<Range | null>(toRange(mine.hours));
  const [busy, setBusyState] = useState(mine.state === "busy");
  const [anchor, setAnchor] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [zoomAt, setZoomAt] = useState<number | null>(null); // телефон: куда ткнули, чтобы выбрать начало крупно
  const [picked, setPicked] = useState<number[]>(initialGames);
  const [popover, setPopover] = useState(false);
  const [searching, setSearching] = useState(false);
  const [grown, setGrown] = useState(0); // перезапуск анимации полосы
  const [, start] = useTransition();
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

  // Сбой сети не должен ронять шкалу: время останется на экране, а данные подтянутся при обновлении.
  const run = (fn: () => Promise<void>) =>
    start(async () => {
      try {
        await fn();
      } catch (e) {
        console.error(e);
      }
    });

  const save = (r: Range, g: number[]) => run(() => saveDay(day, Array.from({ length: r[1] - r[0] }, (_, i) => r[0] + i), g));

  const pick = (h: number, fromLoupe = false) => {
    // На телефоне ячейки шкалы по ~10 px: первое касание лишь открывает крупные кнопки рядом.
    if (anchor === null && !fromLoupe && window.matchMedia("(max-width: 639px)").matches) {
      setZoomAt(h);
      return;
    }
    setZoomAt(null);
    haptic(anchor === null ? "select" : "success");
    if (anchor === null) {
      setAnchor(h);
      setHover(h);
      return;
    }
    const r: Range = [Math.min(anchor, h), Math.max(anchor, h) + 1];
    setRange(r);
    setBusyState(false);
    setAnchor(null);
    setHover(null);
    setPopover(true);
    setGrown((n) => n + 1);
    save(r, picked); // время сохраняется сразу, игры — по «Готово»
  };

  const remove = () => {
    setRange(null);
    setPopover(false);
    run(() => clearDay(day));
  };

  const markBusy = (value: boolean) => {
    setBusyState(value);
    setAnchor(null);
    if (value) {
      setRange(null);
      setPopover(false);
    }
    run(() => (value ? setBusy(day) : clearDay(day)));
  };

  const togglePick = (id: number) =>
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= maxGames ? prev : [...prev, id]));

  // Сначала недавно выбранные тобой, дальше — во что компания чаще играет в Steam.
  const choices = [...recent, ...games.filter((g) => !recent.some((r) => r.id === g.id)).sort(byPlaytime)];
  const preview: Range | null = anchor !== null ? [Math.min(anchor, hover ?? anchor), Math.max(anchor, hover ?? anchor) + 1] : null;

  const hint = range
    ? "Нажми на свою полосу, чтобы поменять игры или убрать время"
    : anchor !== null
      ? `${hourLabels[preview![0]]} – ${hourLabels[preview![1]]}, ${duration(preview!)}. Нажми, до какого часа`
      : busy
        ? "Ты отметил, что не сможешь. Нажми на шкалу, если планы поменялись"
        : "Нажми в своей строке, с какого часа ты свободен";

  // Для конца — 12 часов от начала; для начала — 12 часов вокруг места касания.
  const loupeStart =
    anchor !== null
      ? Math.min(anchor, DAY_HOURS - LOUPE)
      : Math.max(0, Math.min((zoomAt ?? 0) - LOUPE / 2 + 1, DAY_HOURS - LOUPE));
  const loupeOpen = anchor !== null || zoomAt !== null;

  return (
    <section className="rounded-[24px] bg-glass p-4 backdrop-blur-sm sm:p-6">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className={`text-[15px] ${anchor !== null || (invite && !range && !busy) ? "font-medium text-fg" : "text-dim"}`}>{hint}</p>
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
        <div className="relative mb-3 h-4 text-[12px] text-faint tabular-nums">
          {hourLabels.map((label, i) =>
            i % 4 === 0 ? (
              <span
                key={i}
                className={`absolute ${i === 0 ? "" : i === DAY_HOURS ? "-translate-x-full" : "-translate-x-1/2"} ${i % 8 ? "hidden sm:block" : ""}`}
                style={{ left: pct(i) }}
              >
                {label}
              </span>
            ) : null,
          )}
        </div>

        {/* Своя строка: одна сплошная подсветка на обе колонки, без стыка посередине */}
        <div className="pointer-events-none absolute -inset-x-2 top-7 h-14 rounded-2xl bg-white/[0.06]" aria-hidden="true" />
        <div ref={myRow} id="my-row" className="relative flex h-14 items-center gap-2 pr-1">
          <Avatar id={mine.member.id} name={mine.member.name} url={mine.member.avatar_url} size={26} />
          <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">Ты</span>
          <NoButton active={busy} onClick={() => markBusy(!busy)} />
        </div>
        <div className="relative h-14">
          <div className={`relative h-full transition-opacity ${busy && !range && anchor === null ? "opacity-40" : ""}`}>
            <div className="absolute inset-x-0 top-1/2 h-4 -translate-y-1/2 rounded-full bg-white/10" />
            {range && (
              <button
                key={grown}
                onClick={() => setPopover((v) => !v)}
                aria-label={`Моё время ${hourLabels[range[0]]} – ${hourLabels[range[1]]}. Изменить`}
                className="anim-grow absolute top-1/2 h-4 -translate-y-1/2 rounded-full bg-fg transition hover:h-5"
                style={{ left: pct(range[0]), width: pct(range[1] - range[0]) }}
              />
            )}
            {preview && (
              <>
                <div
                  className="pointer-events-none absolute top-1/2 h-4 -translate-y-1/2 rounded-full bg-white/35 transition-all duration-100"
                  style={{ left: pct(preview[0]), width: pct(preview[1] - preview[0]) }}
                />
                <div
                  className="pointer-events-none absolute top-1/2 h-5 -translate-y-1/2 animate-pulse rounded-full bg-fg"
                  style={{ left: pct(anchor!), width: pct(1) }}
                />
              </>
            )}
            {!range && (
              <div className="absolute inset-0 grid grid-cols-24" onPointerLeave={() => anchor !== null && setHover(anchor)}>
                {hourLabels.slice(0, -1).map((label, h) => (
                  <button
                    key={h}
                    onClick={() => pick(h)}
                    onPointerEnter={() => anchor !== null && setHover(h)}
                    aria-label={anchor === null ? `Свободен с ${label}` : `До ${hourLabels[h + 1]}`}
                    className="h-full rounded-md transition-colors hover:bg-white/10"
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Увеличенная полоса для пальца — только на узком экране */}
        {loupeOpen && (
          <div className="anim-fade col-span-2 mt-2 sm:hidden">
            <p className="mb-2 text-[13px] text-dim">{anchor === null ? "С какого часа?" : "До какого часа?"}</p>
            <div className="grid grid-cols-6 gap-1.5">
              {Array.from({ length: Math.min(LOUPE, DAY_HOURS - loupeStart) }, (_, i) => loupeStart + i).map((h) => {
                const inRange = preview && h >= preview[0] && h < preview[1];
                return (
                  <button
                    key={h}
                    onClick={() => pick(h, true)}
                    className={`rounded-xl py-2.5 text-center text-[13px] tabular-nums transition ${
                      h === anchor || h === zoomAt ? "bg-fg font-semibold text-ink" : inRange ? "bg-white/30" : "bg-glass"
                    }`}
                  >
                    {anchor === null ? `с ${hourLabels[h]}` : `до ${hourLabels[h + 1]}`}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => {
                setAnchor(null);
                setZoomAt(null);
              }}
              className="mt-2 text-[13px] text-dim"
            >
              Отмена
            </button>
          </div>
        )}

        {/* Остальные */}
        <div className="mt-1">
          {others.map(({ member, state }) => (
            <div key={member.id} className="flex h-12 items-center gap-2 pr-1">
              <FriendTime name={member.name} timezone={member.timezone} viewerTz={viewerTz} className="flex-1">
                <span className={`flex min-w-0 items-center gap-2 ${state === "free" ? "" : "opacity-45"}`}>
                  <Avatar id={member.id} name={member.name} url={member.avatar_url} size={26} />
                  <span className="truncate text-[14px] font-medium">{member.name}</span>
                </span>
              </FriendTime>
              {state === "busy" && (
                <span title={busyPhrase(member.id, day)} className="flex size-7 shrink-0 items-center justify-center rounded-full bg-bad text-[9px] font-extrabold tracking-wide text-white">
                  NO
                </span>
              )}
            </div>
          ))}
        </div>
        <div className="relative mt-1">
          <div className="pointer-events-none absolute inset-0 flex" aria-hidden="true">
            {Array.from({ length: DAY_HOURS / 4 }, (_, i) => (
              <div key={i} className="flex-1 border-l border-line first:border-l-0" />
            ))}
          </div>
          {others.map(({ member, hours, state, note }, row) => (
            <div key={member.id} className="flex h-12 items-center">
              <div className="relative h-4 w-full">
                {state === "free" &&
                  runs(hours).map(([a, b]) => (
                    <div
                      key={a}
                      className="anim-grow absolute inset-y-0 rounded-full"
                      style={{
                        left: pct(a),
                        width: pct(b - a),
                        background: memberColor(member.id),
                        animationDelay: `calc(var(--base, 0s) + ${0.1 + row * 0.05}s)`,
                      }}
                      title={`${hourLabels[a]} – ${hourLabels[b]}`}
                    />
                  ))}
                {state === "silent" && <span className="absolute inset-y-0 left-0 flex items-center text-[13px] text-faint italic">{note}</span>}
              </div>
            </div>
          ))}
        </div>

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
        {popover && range && (
          // Плавает поверх строк друзей, прямо под моей полосой.
          <div className="absolute inset-x-0 top-[92px] z-20 sm:left-[170px]">
            <div
              className="anim-popover w-full rounded-[20px] border border-line bg-[#1a1a1f]/95 p-4 shadow-[0_24px_60px_rgba(0,0,0,0.55)] backdrop-blur-xl sm:ml-[var(--ml)] sm:w-[360px]"
              style={{ ["--ml" as string]: `clamp(0px, calc(${pct((range[0] + range[1]) / 2)} - 180px), calc(100% - 360px))` }}
            >
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <span className="text-[15px] font-semibold tabular-nums">
                  {hourLabels[range[0]]} – {hourLabels[range[1]]}
                  <span className="ml-2 font-normal text-dim">{duration(range)}</span>
                </span>
                <span className="text-[13px] text-dim">во что хочешь, до {maxGames === 5 ? "пяти" : maxGames}</span>
              </div>
              <div ref={wheelToX} className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-1.5">
                {choices.map((g) => {
                  const on = picked.includes(g.id);
                  return (
                    <button
                      key={g.id}
                      onClick={() => togglePick(g.id)}
                      aria-pressed={on}
                      aria-label={g.name}
                      className={`tile w-[58px] shrink-0 rounded-[10px] ${on ? "tile-on" : "opacity-55"}`}
                    >
                      <Cover key={g.id} game={g} />
                    </button>
                  );
                })}
                <button
                  onClick={() => setSearching(true)}
                  aria-label="Найти игру"
                  className="tile flex aspect-[2/3] w-[58px] shrink-0 items-center justify-center rounded-[10px] bg-glass text-xl text-dim"
                >
                  +
                </button>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => {
                    setPopover(false);
                    save(range, picked);
                  }}
                  className="flex-1 rounded-full bg-fg py-2.5 text-[15px] font-semibold text-ink transition active:scale-[0.98]"
                >
                  Готово
                </button>
                <button
                  onClick={() => {
                    setPopover(false);
                    setAnchor(range[0]);
                    setHover(range[1] - 1);
                    setRange(null);
                  }}
                  className="rounded-full bg-glass px-4 py-2.5 text-[15px] transition hover:bg-glass2"
                >
                  Другое время
                </button>
                <button onClick={remove} className="rounded-full bg-glass px-4 py-2.5 text-[15px] text-dim transition hover:bg-glass2">
                  Убрать
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <Sheet open={searching} onClose={() => setSearching(false)} title="Найти игру">
        <GameSearch
          onPick={(id) => {
            togglePick(id);
            setSearching(false);
          }}
        />
      </Sheet>
    </section>
  );
}
