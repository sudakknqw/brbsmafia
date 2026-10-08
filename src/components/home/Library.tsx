"use client";

import { useRef, useState, useTransition } from "react";
import { deleteGame } from "@/app/actions";
import { GameArtEditor } from "@/components/GameArtEditor";
import { AvatarStack } from "@/components/Avatar";
import { NamesHint } from "@/components/NamesHint";
import { Cover } from "@/components/GameArt";
import { GameSearch } from "@/components/GameSearch";
import { Sheet } from "@/components/Sheet";
import { byPlaytime, type Game, type Member, type Want } from "@/lib/types";


/**
 * Общая библиотека. Нажатие на обложку ставит игру в твой статус на сутки.
 * Хотелки «живые» (меняются сразу при нажатии) и общие со всей главной — см. HomeLive.
 */
// Свёрнутая библиотека — два ряда: 3, 4 или 6 колонок в зависимости от ширины экрана.
const ROWS2 = { phone: 6, tablet: 8, desktop: 12 };
const collapsedClass = (i: number) =>
  i < ROWS2.phone ? "" : i < ROWS2.tablet ? "hidden sm:block" : i < ROWS2.desktop ? "hidden lg:block" : "hidden";

export function Library({
  games,
  wants,
  serverWants,
  members,
  meId,
  onToggle,
}: {
  games: Game[];
  wants: Want[];
  serverWants: Want[];
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

  const toggleExpanded = () => {
    // Свернули, стоя внизу длинного списка, — возвращаемся к началу библиотеки.
    // Прокручиваем уже после сворачивания: иначе укоротившаяся страница обрывает прокрутку.
    setExpanded(!expanded);
    if (!expanded) return;
    setTimeout(() => {
      const el = section.current;
      if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  };
  const [, start] = useTransition();
  const live = wants;
  const artGame = games.find((g) => g.id === artGameId) ?? null;

  const wantersOf = (gameId: number) =>
    live
      .filter((w) => w.game_id === gameId)
      .map((w) => members.find((m) => m.id === w.user_id))
      .filter((m): m is Member => !!m);

  // Порядок не прыгает при каждом нажатии: сортируем по серверным данным.
  const order = [...games]
    .filter((g) => !hidden.includes(g.id))
    .sort(
      (a, b) =>
        serverWants.filter((w) => w.game_id === b.id).length - serverWants.filter((w) => w.game_id === a.id).length ||
        byPlaytime(a, b) ||
        a.name.localeCompare(b.name),
    );

  const toggle = onToggle;

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
          : "Нажми на обложку, и игра встанет в твой статус на сутки. Можно выбрать до трёх."}
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
        <div className="grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-4 lg:grid-cols-6">
          {order.map((g, i) => {
            const wanters = wantersOf(g.id);
            const mine = wanters.some((m) => m.id === meId);
            return (
              <div key={g.id} className={expanded ? "" : collapsedClass(i)}>
                <button
                  onClick={() => (editing ? setArtGameId(g.id) : toggle(g.id))}
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
              </div>
            );
          })}
        </div>
      )}
      {order.length > ROWS2.phone && (
        <button
          onClick={toggleExpanded}
          className={`mt-6 w-full rounded-full bg-glass py-3 text-[15px] font-medium transition hover:bg-glass2 ${order.length <= ROWS2.tablet ? "sm:hidden" : ""} ${order.length <= ROWS2.desktop ? "lg:hidden" : ""}`}
        >
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
