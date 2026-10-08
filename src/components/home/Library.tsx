"use client";

import { useLayoutEffect, useOptimistic, useRef, useState, useSyncExternalStore, useTransition, type CSSProperties, type ReactNode } from "react";
import {
  closestCenter,
  DndContext,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove, rectSortingStrategy, SortableContext, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { deleteGame, saveLibraryOrder } from "@/app/actions";
import { GameArtEditor } from "@/components/GameArtEditor";
import { AvatarStack } from "@/components/Avatar";
import { NamesHint } from "@/components/NamesHint";
import { Cover } from "@/components/GameArt";
import { GameSearch } from "@/components/GameSearch";
import { Sheet } from "@/components/Sheet";
import { haptic } from "@/lib/tg";
import type { Game, Member, Want } from "@/lib/types";

// Колонок в сетке: 3 на телефоне, 4 на планшете (sm), 6 на компьютере (lg).
// Нужно знать в коде: свёрнутая библиотека — это ровно два ряда.
const COLUMN_QUERIES = ["(min-width: 1024px)", "(min-width: 640px)"] as const;
function subscribeColumns(onChange: () => void) {
  const lists = COLUMN_QUERIES.map((q) => window.matchMedia(q));
  lists.forEach((l) => l.addEventListener("change", onChange));
  return () => lists.forEach((l) => l.removeEventListener("change", onChange));
}
// Разворачивание: высота плавно меняется, а за край сетки ничего не вылезает
// (снизу обрезаем, по бокам и сверху — нет, чтобы не резать белую рамку и тень обложек).
const EASE = "cubic-bezier(0.32, 0.72, 0, 1)";
const CLIP = "inset(-16px -16px 0 -16px)";
const GAP_Y = 24; // gap-y-6
const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const columnsNow = () => (window.matchMedia(COLUMN_QUERIES[0]).matches ? 6 : window.matchMedia(COLUMN_QUERIES[1]).matches ? 4 : 3);

/**
 * Общая библиотека. Нажатие на обложку ставит игру в твой статус на сутки.
 * Порядок у каждого свой: игры перетаскиваются (на телефоне — зажать обложку),
 * а выбранные почаще сами понемногу поднимаются (см. bumpGames).
 * Хотелки «живые» (меняются сразу при нажатии) и общие со всей главной — см. HomeLive.
 */
export function Library({
  games,
  wants,
  members,
  meId,
  onToggle,
}: {
  games: Game[];
  wants: Want[];
  members: Member[];
  meId: string;
  onToggle: (gameId: number) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);
  const [artGameId, setArtGameId] = useState<number | null>(null);
  const [hidden, setHidden] = useState<number[]>([]);
  const [expanded, setExpanded] = useState(false);
  const section = useRef<HTMLElement>(null);
  const justDragged = useRef(false);
  const [, start] = useTransition();
  const columns = useSyncExternalStore(subscribeColumns, columnsNow, () => 3);

  // Порядок с сервера уже твой; после перетаскивания показываем новый сразу, не дожидаясь ответа.
  const [orderIds, applyOrder] = useOptimistic(
    games.map((g) => g.id),
    (_: number[], next: number[]) => next,
  );
  const order = orderIds
    .map((id) => games.find((g) => g.id === id))
    .filter((g): g is Game => !!g && !hidden.includes(g.id));
  const collapsedCount = columns * 2;
  const shown = expanded ? order : order.slice(0, collapsedCount);

  const sensors = useSensors(
    // Мышью — потянуть на несколько пикселей; пальцем — зажать, чтобы не мешать прокрутке.
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 280, tolerance: 8 } }),
  );

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    // Отпущенная после перетаскивания обложка не должна ещё и нажаться.
    justDragged.current = true;
    setTimeout(() => (justDragged.current = false), 50);
    if (!over || active.id === over.id) return;
    const ids = order.map((g) => g.id);
    const next = arrayMove(ids, ids.indexOf(Number(active.id)), ids.indexOf(Number(over.id)));
    haptic("select");
    start(async () => {
      applyOrder(next);
      // Не сохранилось (нет сети) — порядок сам вернётся к прежнему, когда переход закончится.
      await saveLibraryOrder(next).catch(() => undefined);
    });
  };

  const box = useRef<HTMLDivElement>(null);
  const grownFrom = useRef<number | null>(null);
  const shrinking = useRef<Animation | null>(null);
  const shrinkTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // После разворачивания сетка уже полная: растим её высоту от прежней до новой.
  useLayoutEffect(() => {
    shrinking.current?.cancel(); // свернули — держать высоту анимацией больше не нужно
    shrinking.current = null;
    clearTimeout(shrinkTimer.current);
    const el = box.current;
    const from = grownFrom.current;
    grownFrom.current = null;
    if (!el || from === null || reduceMotion()) return;
    const to = el.offsetHeight;
    el.animate([{ height: `${from}px`, clipPath: CLIP }, { height: `${to}px`, clipPath: CLIP }], {
      duration: Math.min(800, 420 + (to - from) * 0.25),
      easing: EASE,
    });
  }, [expanded]);

  const toggleExpanded = () => {
    if (shrinking.current) return; // уже сворачивается
    const el = box.current;
    if (!expanded) {
      grownFrom.current = el?.offsetHeight ?? null;
      setExpanded(true);
      return;
    }
    // Свернули, стоя внизу длинного списка, — возвращаемся к началу библиотеки.
    const top = section.current;
    if (top && top.getBoundingClientRect().top < 0) top.scrollIntoView({ block: "start", behavior: "smooth" });
    const firstHidden = el?.querySelector<HTMLElement>(`[data-i="${collapsedCount}"]`);
    if (!el || !firstHidden || reduceMotion()) {
      setExpanded(false);
      return;
    }
    // Лишние обложки тают, сетка сжимается до двух рядов — и только потом они убираются.
    const target = firstHidden.getBoundingClientRect().top - el.getBoundingClientRect().top - GAP_Y;
    el.querySelectorAll<HTMLElement>("[data-i]").forEach((tile) => {
      if (Number(tile.dataset.i) >= collapsedCount) tile.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, fill: "forwards" });
    });
    const anim = el.animate([{ height: `${el.offsetHeight}px`, clipPath: CLIP }, { height: `${target}px`, clipPath: CLIP }], {
      duration: 460,
      easing: EASE,
      fill: "forwards",
    });
    shrinking.current = anim;
    anim.onfinish = () => setExpanded(false);
    // Страховка: в фоновой вкладке браузер может не доиграть анимацию.
    shrinkTimer.current = setTimeout(() => setExpanded(false), 700);
  };

  const artGame = games.find((g) => g.id === artGameId) ?? null;

  const wantersOf = (gameId: number) =>
    wants
      .filter((w) => w.game_id === gameId)
      .map((w) => members.find((m) => m.id === w.user_id))
      .filter((m): m is Member => !!m);

  const remove = (game: Game) => {
    if (!confirm(`Убрать «${game.name}» из библиотеки у всех?`)) return;
    setArtGameId(null);
    setHidden((h) => [...h, game.id]);
    start(() => deleteGame(game.id));
  };

  return (
    <section ref={section} className="scroll-mt-6">
      <div className="mb-1 flex items-end justify-between gap-4">
        <h2 className="text-[22px] font-semibold tracking-tight">Библиотека</h2>
        <div className="flex gap-2">
          {games.length > 0 && (
            <button
              onClick={() => setEditing((v) => !v)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${editing ? "bg-fg text-ink" : "bg-glass hover:bg-glass2"}`}
            >
              {editing ? "Готово" : "Изменить"}
            </button>
          )}
          <button onClick={() => setAdding(true)} className="rounded-full bg-glass px-3.5 py-1.5 text-sm font-medium transition hover:bg-glass2">
            Добавить
          </button>
        </div>
      </div>
      <p className="mb-5 text-[15px] text-dim">
        {editing
          ? "Нажми на игру, чтобы поменять её картинки или убрать из библиотеки."
          : "Нажми на обложку, и игра встанет в твой статус на сутки. Порядок свой: перетаскивай игры, зажав обложку."}
      </p>

      {order.length === 0 ? (
        <button
          onClick={() => setAdding(true)}
          aria-label="Добавить игру"
          className="tile flex aspect-[2/3] w-[140px] items-center justify-center rounded-[10px] border border-dashed border-line text-[40px] font-light text-dim"
        >
          +
        </button>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={() => haptic("tap")} onDragEnd={onDragEnd}>
          <SortableContext items={shown.map((g) => g.id)} strategy={rectSortingStrategy}>
            <div ref={box} className="grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-4 lg:grid-cols-6">
              {shown.map((g, i) => {
                const wanters = wantersOf(g.id);
                const mine = wanters.some((m) => m.id === meId);
                return (
                  <SortableTile
                    key={g.id}
                    id={g.id}
                    index={i}
                    // Открывшиеся при разворачивании — появляются волной, по порядку.
                    reveal={expanded && i >= collapsedCount ? Math.min((i - collapsedCount) * 35, 420) : null}
                  >
                    <button
                      onClick={() => {
                        if (justDragged.current) return;
                        if (editing) setArtGameId(g.id);
                        else onToggle(g.id);
                      }}
                      aria-pressed={editing ? undefined : mine}
                      aria-label={editing ? `Изменить ${g.name}` : g.name}
                      className={`tile relative block w-full rounded-[10px] ${mine && !editing ? "tile-on" : ""} ${editing ? "opacity-70" : ""}`}
                    >
                      <Cover key={g.id} game={g} />
                      {mine && !editing && (
                        <span className="anim-pop absolute top-2 right-2 flex size-6 items-center justify-center rounded-full bg-fg text-ink">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M5 12l5 5L19 7" />
                          </svg>
                        </span>
                      )}
                      {editing && (
                        <span className="anim-pop absolute top-2 right-2 flex size-7 items-center justify-center rounded-full bg-fg text-ink">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4" />
                          </svg>
                        </span>
                      )}
                    </button>
                    <p className="mt-2.5 truncate text-[14px] font-medium">{g.name}</p>
                    <div className="mt-1.5 h-[22px]">
                      {wanters.length > 0 ? (
                        <NamesHint names={wanters.map((m) => m.name)}>
                          <AvatarStack people={wanters} size={22} />
                        </NamesHint>
                      ) : (
                        <span className="text-[13px] text-faint">пока никто</span>
                      )}
                    </div>
                  </SortableTile>
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      )}
      {order.length > collapsedCount && (
        <button onClick={toggleExpanded} className="mt-6 w-full rounded-full bg-glass py-3 text-[15px] font-medium transition hover:bg-glass2">
          {expanded ? "Свернуть" : `Показать все (${order.length})`}
        </button>
      )}

      <Sheet open={adding} onClose={() => setAdding(false)} title="Добавить игру">
        <GameSearch
          onPick={(id, fromSteam) => {
            setAdding(false);
            if (!fromSteam) setArtGameId(id);
          }}
        />
      </Sheet>

      <Sheet open={!!artGame} onClose={() => setArtGameId(null)} title={artGame?.name ?? ""}>
        {artGame && <GameArtEditor key={artGame.id} game={artGame} onRemove={() => remove(artGame)} />}
      </Sheet>
    </section>
  );
}

/** Ячейка, которую можно перетаскивать. Поднятая — чуть крупнее и поверх остальных. */
function SortableTile({ id, index, reveal, children }: { id: number; index: number; reveal: number | null; children: ReactNode }) {
  const { setNodeRef, listeners, transform, transition, isDragging } = useSortable({ id });
  const style: CSSProperties = { transform: CSS.Translate.toString(transform), transition };
  if (reveal !== null) style.animationDelay = `${reveal}ms`;
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      data-i={index}
      style={style}
      className={`touch-manipulation select-none [-webkit-touch-callout:none] ${reveal !== null ? "anim-tile-in" : ""} ${isDragging ? "relative z-20 scale-105 opacity-90 drop-shadow-[0_18px_30px_rgba(0,0,0,0.6)]" : ""}`}
    >
      {children}
    </div>
  );
}
