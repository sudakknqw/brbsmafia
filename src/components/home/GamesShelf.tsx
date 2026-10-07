"use client";

import { useOptimistic, useState, useTransition } from "react";
import { deleteGame, toggleWant } from "@/app/actions";
import { AvatarStack } from "@/components/Avatar";
import { GameCover } from "@/components/GameCover";
import { GameSearch } from "@/components/GameSearch";
import { Sheet } from "@/components/Sheet";
import type { Game, Member, Want } from "@/lib/types";

const MAX_WANTS = 3;

export function GamesShelf({
  games,
  wants,
  members,
  meId,
}: {
  games: Game[];
  wants: Want[];
  members: Member[];
  meId: string;
}) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);
  const [, start] = useTransition();
  const [optimisticWants, toggleOptimistic] = useOptimistic(wants, (state, gameId: number) => {
    const mine = state.filter((w) => w.user_id === meId).sort((a, b) => a.created_at.localeCompare(b.created_at));
    if (mine.some((w) => w.game_id === gameId)) return state.filter((w) => !(w.user_id === meId && w.game_id === gameId));
    const drop = mine.length >= MAX_WANTS ? mine[0].game_id : null;
    return [
      ...state.filter((w) => !(w.user_id === meId && w.game_id === drop)),
      { user_id: meId, game_id: gameId, created_at: new Date().toISOString() },
    ];
  });

  const wantersOf = (gameId: number) =>
    optimisticWants
      .filter((w) => w.game_id === gameId)
      .map((w) => members.find((m) => m.id === w.user_id))
      .filter((m) => !!m);

  const sorted = [...games].sort((a, b) => wantersOf(b.id).length - wantersOf(a.id).length || a.name.localeCompare(b.name));
  const myCount = optimisticWants.filter((w) => w.user_id === meId).length;

  const toggle = (gameId: number) =>
    start(async () => {
      toggleOptimistic(gameId);
      await toggleWant(gameId);
    });

  const remove = (game: Game) => {
    if (!confirm(`Убрать «${game.name}» с полки у всех?`)) return;
    start(() => deleteGame(game.id));
  };

  return (
    <section className="mt-8">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-[20px] font-bold tracking-tight">Игры</h2>
        <div className="flex items-center gap-4 text-[15px]">
          {games.length > 0 && (
            <button onClick={() => setEditing((v) => !v)} className="text-accent">
              {editing ? "Готово" : "Изменить"}
            </button>
          )}
          <button onClick={() => setAdding(true)} className="text-accent">
            Добавить
          </button>
        </div>
      </div>
      <p className="mb-4 text-sm text-dim">
        Нажми на обложку, чтобы поставить игру в свой статус · {myCount} из {MAX_WANTS} · сбрасывается через сутки
      </p>

      {games.length === 0 ? (
        <button onClick={() => setAdding(true)} className="w-full rounded-3xl border border-dashed border-line py-12 text-dim hover:text-fg">
          Добавь первую игру
        </button>
      ) : (
        <div className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-5">
          {sorted.map((g) => {
            const wanters = wantersOf(g.id);
            const mine = wanters.some((m) => m.id === meId);
            return (
              <div key={g.id} className="relative">
                <button
                  onClick={() => (editing ? remove(g) : toggle(g.id))}
                  className={`block w-full rounded-xl transition active:scale-[0.97] ${mine ? "ring-2 ring-accent ring-offset-2 ring-offset-bg" : ""} ${
                    editing ? "animate-pulse" : ""
                  }`}
                  aria-pressed={mine}
                  aria-label={editing ? `Удалить ${g.name}` : g.name}
                >
                  <GameCover key={g.id} game={g} />
                </button>
                {editing && (
                  <span className="pointer-events-none absolute -top-2 -left-2 flex size-6 items-center justify-center rounded-full bg-elev2 text-fg ring-2 ring-bg">
                    <svg width="10" height="2" aria-hidden="true">
                      <rect width="10" height="2" rx="1" fill="currentColor" />
                    </svg>
                  </span>
                )}
                <p className="mt-2 truncate text-[13px]">{g.name}</p>
                <div className="mt-1 h-[22px]">
                  {wanters.length > 0 ? <AvatarStack people={wanters} size={20} /> : <span className="text-xs text-faint">пока никто</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Sheet open={adding} onClose={() => setAdding(false)} title="Добавить игру">
        <GameSearch recent={[]} onPick={() => setAdding(false)} />
      </Sheet>
    </section>
  );
}
