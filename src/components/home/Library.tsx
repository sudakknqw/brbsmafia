"use client";

import { useOptimistic, useState, useTransition } from "react";
import { deleteGame, toggleWant } from "@/app/actions";
import { AvatarStack } from "@/components/Avatar";
import { Cover } from "@/components/GameArt";
import { GameSearch } from "@/components/GameSearch";
import { Sheet } from "@/components/Sheet";
import type { Game, Member, Want } from "@/lib/types";

const MAX_WANTS = 3;

/** Общая библиотека. Нажатие на обложку ставит игру в твой статус на сутки. */
export function Library({ games, wants, members, meId }: { games: Game[]; wants: Want[]; members: Member[]; meId: string }) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);
  const [hidden, setHidden] = useState<number[]>([]);
  const [, start] = useTransition();
  const [live, toggleOptimistic] = useOptimistic(wants, (state, gameId: number) => {
    const mine = state.filter((w) => w.user_id === meId).sort((a, b) => a.created_at.localeCompare(b.created_at));
    if (mine.some((w) => w.game_id === gameId)) return state.filter((w) => !(w.user_id === meId && w.game_id === gameId));
    const drop = mine.length >= MAX_WANTS ? mine[0].game_id : null;
    return [
      ...state.filter((w) => !(w.user_id === meId && w.game_id === drop)),
      { user_id: meId, game_id: gameId, created_at: new Date().toISOString() },
    ];
  });

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
        wants.filter((w) => w.game_id === b.id).length - wants.filter((w) => w.game_id === a.id).length ||
        a.name.localeCompare(b.name),
    );

  const toggle = (gameId: number) =>
    start(async () => {
      toggleOptimistic(gameId);
      await toggleWant(gameId);
    });

  const remove = (game: Game) => {
    if (!confirm(`Убрать «${game.name}» из библиотеки у всех?`)) return;
    setHidden((h) => [...h, game.id]);
    start(() => deleteGame(game.id));
  };

  return (
    <section>
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
          ? "Нажми на игру, чтобы убрать её у всех."
          : "Нажми на обложку, и игра встанет в твой статус на сутки. Можно выбрать до трёх."}
      </p>

      {order.length === 0 ? (
        <button
          onClick={() => setAdding(true)}
          className="tile flex aspect-[2/3] w-[140px] items-center justify-center rounded-[10px] border border-dashed border-line text-[15px] text-dim"
        >
          Первая игра
        </button>
      ) : (
        <div className="grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-4 lg:grid-cols-6">
          {order.map((g) => {
            const wanters = wantersOf(g.id);
            const mine = wanters.some((m) => m.id === meId);
            return (
              <div key={g.id}>
                <button
                  onClick={() => (editing ? remove(g) : toggle(g.id))}
                  aria-pressed={editing ? undefined : mine}
                  aria-label={editing ? `Убрать ${g.name}` : g.name}
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
                    <span className="anim-pop absolute top-2 right-2 flex size-6 items-center justify-center rounded-full bg-bad text-white">
                      <svg width="10" height="2" aria-hidden="true">
                        <rect width="10" height="2" rx="1" fill="currentColor" />
                      </svg>
                    </span>
                  )}
                </button>
                <p className="mt-2.5 truncate text-[14px] font-medium">{g.name}</p>
                <div className="mt-1.5 h-[22px]">
                  {wanters.length > 0 ? <AvatarStack people={wanters} size={22} /> : <span className="text-[13px] text-faint">пока никто</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Sheet open={adding} onClose={() => setAdding(false)} title="Добавить игру">
        <GameSearch onPick={() => setAdding(false)} />
      </Sheet>
    </section>
  );
}
