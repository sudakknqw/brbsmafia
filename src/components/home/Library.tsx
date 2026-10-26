"use client";

import { useEffect, useLayoutEffect, useOptimistic, useRef, useState, useSyncExternalStore, useTransition, type CSSProperties, type ReactNode } from "react";
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
import { gameArt } from "@/lib/steam";
import { haptic } from "@/lib/tg";
import type { Game, Member, Want } from "@/lib/types";

// Grid columns: 3 on phones, 4 on tablets (sm), 6 on desktop (lg).
// The code needs to know this: the collapsed library is exactly two rows.
const COLUMN_QUERIES = ["(min-width: 1024px)", "(min-width: 640px)"] as const;
function subscribeColumns(onChange: () => void) {
  const lists = COLUMN_QUERIES.map((q) => window.matchMedia(q));
  lists.forEach((l) => l.addEventListener("change", onChange));
  return () => lists.forEach((l) => l.removeEventListener("change", onChange));
}
// Expanding: the height changes smoothly and nothing spills past the grid
// (clipped at the bottom only, not at the sides or top, so cover outlines and shadows aren't cut).
const EASE = "cubic-bezier(0.32, 0.72, 0, 1)";
const CLIP = "inset(-16px -16px 0 -16px)";
const GAP_Y = 24; // gap-y-6
const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const columnsNow = () => (window.matchMedia(COLUMN_QUERIES[0]).matches ? 6 : window.matchMedia(COLUMN_QUERIES[1]).matches ? 4 : 3);

/**
 * Shared library. Tapping a cover puts the game into your status for a day.
 * Everyone has their own order: games can be dragged (long-press the cover on phones),
 * and the ones you pick more often gradually move up by themselves (see bumpGames).
 * Wants are live (they change instantly on tap) and shared across the home page; see HomeLive.
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

  // The server already sends your order; after a drag the new order shows immediately, without waiting.
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
    // Mouse: drag a few pixels; finger: long-press, so scrolling isn't blocked.
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 280, tolerance: 8 } }),
  );

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    // A cover released after a drag must not also register as a tap.
    justDragged.current = true;
    setTimeout(() => (justDragged.current = false), 50);
    if (!over || active.id === over.id) return;
    const ids = order.map((g) => g.id);
    const next = arrayMove(ids, ids.indexOf(Number(active.id)), ids.indexOf(Number(over.id)));
    haptic("select");
    start(async () => {
      applyOrder(next);
      // Not saved (no network): the order reverts by itself when the transition ends.
      await saveLibraryOrder(next).catch(() => undefined);
    });
  };

  // Covers hidden under "Show all" are preloaded when the browser is idle,
  // so on expand they appear ready instead of popping in one by one.
  const hiddenCovers = order.slice(collapsedCount).map((g) => gameArt(g).portrait[0]).filter(Boolean).join("|");
  useEffect(() => {
    if (!hiddenCovers) return;
    const load = () => hiddenCovers.split("|").forEach((src) => (new Image().src = src));
    const idle = window.requestIdleCallback?.(load) ?? window.setTimeout(load, 1500);
    return () => (window.cancelIdleCallback ? window.cancelIdleCallback(idle) : clearTimeout(idle));
  }, [hiddenCovers]);

  const box = useRef<HTMLDivElement>(null);
  const grownFrom = useRef<number | null>(null);
  const shrinking = useRef<Animation | null>(null);
  const shrinkTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // After expanding the grid is already full: animate its height from the old value to the new one.
  useLayoutEffect(() => {
    shrinking.current?.cancel(); // collapsed: no need to hold the height with the animation anymore
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
    if (shrinking.current) return; // already collapsing
    const el = box.current;
    if (!expanded) {
      grownFrom.current = el?.offsetHeight ?? null;
      setExpanded(true);
      return;
    }
    // Collapsed while at the bottom of a long list: scroll back to the top of the library.
    const top = section.current;
    if (top && top.getBoundingClientRect().top < 0) top.scrollIntoView({ block: "start", behavior: "smooth" });
    const firstHidden = el?.querySelector<HTMLElement>(`[data-i="${collapsedCount}"]`);
    if (!el || !firstHidden || reduceMotion()) {
      setExpanded(false);
      return;
    }
    // Extra covers fade out and the grid shrinks to two rows; only then are they removed.
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
    // Safety net: a background tab may never finish the animation.
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
                    // Covers revealed by expanding appear in a wave, in order.
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

/** A draggable cell. While lifted it's slightly bigger and above the others. */
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
