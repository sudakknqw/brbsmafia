"use client";

import { DayLink } from "@/components/day/DayLink";
import { useState, useTransition } from "react";
import { clearDay, setBusy } from "@/app/actions";
import { AvatarStack } from "@/components/Avatar";
import { EditorSheet } from "@/components/EditorSheet";
import { Ambient, HeroArt, Logo } from "@/components/GameArt";
import { TopBar } from "@/components/TopBar";
import { AmbientTail } from "@/components/AmbientTail";
import { people } from "@/lib/words";
import type { Game, Member } from "@/lib/types";
import type { EditorSeed, Spotlight as SpotlightModel } from "@/lib/views";

type Props = {
  me: Member;
  spotlight: SpotlightModel;
  today: EditorSeed;
  games: Game[];
  recent: Game[];
  maxGames: number;
};

/** Первый экран: арт игры, которую сейчас хотят больше всего, и ближайшее окно. */
export function Spotlight({ me, spotlight, today, games, recent, maxGames }: Props) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusyOptimistic] = useState(today.busy);
  const [, start] = useTransition();
  const { game, when, freeCount } = spotlight;
  const marked = today.initialHours.length > 0;

  const toggleBusy = () => {
    setBusyOptimistic(!busy);
    start(() => (busy ? clearDay(today.day) : setBusy(today.day)));
  };

  const caption = when
    ? game
      ? `Свободны ${people(freeCount)}, больше всего хотят сюда`
      : `Свободны ${people(freeCount)}. Осталось выбрать игру`
    : game && spotlight.people.length
      ? `Хотят ${people(spotlight.people.length)}. Осталось совпасть по времени`
      : "Отметь, когда свободен, и выбери, во что хочешь";

  return (
    <section className="relative isolate flex min-h-[min(78svh,720px)] flex-col overflow-hidden">
      <Ambient game={game} />
      {game && <HeroArt key={game.id} game={game} className="anim-art absolute inset-x-0 top-0 bottom-1 -z-20 h-[calc(100%-4px)] w-full" />}
      <div className="absolute inset-0 -z-10" style={{ background: "linear-gradient(to top, var(--color-ink) 0%, var(--color-ink) 10%, rgb(5 5 7 / 0.6) 50%, rgb(5 5 7 / 0.15) 100%)" }} />
      <div className="absolute inset-0 -z-10 bg-linear-to-r from-ink/70 to-transparent sm:to-60%" />
      <AmbientTail edge="bottom" />

      <TopBar me={me} />

      <div className="mx-auto mt-auto w-full max-w-6xl px-4 pb-10 sm:px-8 sm:pb-14">
        <p className="anim-rise text-[17px] font-semibold" style={{ animationDelay: "0.15s" }}>
          {when ?? (game ? "Сейчас в статусах" : "Пока тихо")}
        </p>

        <div className="anim-rise mt-3 mb-5" style={{ animationDelay: "0.25s" }}>
          {game ? (
            <Logo key={game.id} game={game} className="max-h-[130px] w-auto max-w-[min(80vw,560px)] sm:max-h-[190px]" />
          ) : (
            <p className="text-[clamp(40px,9vw,80px)] leading-[0.92] font-extrabold tracking-[-0.04em]">
              Когда
              <br />
              собираемся?
            </p>
          )}
        </div>

        <div className="anim-rise flex items-center gap-3" style={{ animationDelay: "0.35s" }}>
          {spotlight.people.length > 0 && <AvatarStack people={spotlight.people} size={28} max={8} />}
          <p className="text-[15px] text-dim">{caption}</p>
        </div>

        <div className="anim-rise mt-7 flex flex-wrap gap-2.5" style={{ animationDelay: "0.45s" }}>
          <button
            onClick={() => setEditing(true)}
            className="rounded-full bg-fg px-6 py-3 text-[16px] font-semibold text-ink transition hover:scale-[1.03] active:scale-[0.97]"
          >
            {marked ? "Изменить доступное время" : "Я свободен сегодня"}
          </button>
          {!marked && (
            <button
              onClick={toggleBusy}
              className="rounded-full bg-glass2 px-5 py-3 text-[16px] font-medium backdrop-blur-md transition hover:bg-white/20 active:scale-[0.97]"
            >
              {busy ? "Всё-таки могу" : "Сегодня не могу"}
            </button>
          )}
          <DayLink day={spotlight.day} className="rounded-full px-4 py-3 text-[16px] font-medium text-dim transition hover:text-fg">
            Расписание дня
          </DayLink>
        </div>
      </div>

      <EditorSheet
        open={editing}
        onClose={() => setEditing(false)}
        seed={today}
        title="Сегодня я свободен"
        games={games}
        recent={recent}
        maxGames={maxGames}
      />
    </section>
  );
}
