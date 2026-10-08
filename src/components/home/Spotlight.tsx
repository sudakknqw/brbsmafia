"use client";

import { DayLink } from "@/components/day/DayLink";
import { useOpenDay } from "@/components/day/DayOverlay";
import { useState, useTransition } from "react";
import { clearDay, setBusy } from "@/app/actions";
import { AvatarStack } from "@/components/Avatar";
import { Ambient, HeroArt, Logo } from "@/components/GameArt";
import { TopBar } from "@/components/TopBar";
import { AmbientTail } from "@/components/AmbientTail";
import { who } from "@/lib/words";
import { NamesHint } from "@/components/NamesHint";
import type { Member } from "@/lib/types";
import type { EditorSeed, GatheringView, Spotlight as SpotlightModel } from "@/lib/views";
import { GatheringInfo, StartGathering } from "@/components/Gathering";

type Props = {
  me: Member;
  spotlight: SpotlightModel;
  gathering: GatheringView | null;
  today: EditorSeed;
};

/** Первый экран: арт игры, которую сейчас хотят больше всего, и ближайшее окно. */
export function Spotlight({ me, spotlight, gathering, today }: Props) {
  const openDay = useOpenDay();
  const [busy, setBusyOptimistic] = useState(today.busy);
  const [, start] = useTransition();
  const { game, when } = spotlight;
  const marked = today.initialHours.length > 0;

  const toggleBusy = () => {
    setBusyOptimistic(!busy);
    start(() => (busy ? clearDay(today.day) : setBusy(today.day)));
  };

  const names = spotlight.people.map((p) => (p.id === me.id ? "ты" : p.name));
  const caption = when
    ? game && spotlight.picked
      ? `${who(names, "Свободен", "Свободны")}, больше всего хотят сюда`
      : `${who(names, "Свободен", "Свободны")}. Осталось выбрать игру`
    : game && spotlight.picked && names.length
      ? `${who(names, "Хочет", "Хотят", "Хочешь")}. Осталось совпасть по времени`
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
        <div className="anim-rise mb-6" style={{ animationDelay: "0.2s" }}>
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

        {/* Идёт сбор — он главнее всего остального */}
        {gathering ? (
          <div style={{ animationDelay: "0.32s" }}>
            <GatheringInfo key={gathering.id} gathering={gathering} meId={me.id} />
            <DayLink day={spotlight.day} className="mt-3 inline-block py-1 text-[15px] font-medium text-dim transition hover:text-fg">
              Расписание дня
            </DayLink>
          </div>
        ) : (
          <>
            {/* Когда и кто — одним блоком под логотипом */}
            <div className="anim-rise" style={{ animationDelay: "0.32s" }}>
              <NamesHint names={spotlight.people.map((p) => p.name)} className="gap-3">
                {spotlight.people.length > 0 && <AvatarStack people={spotlight.people} size={34} max={8} />}
                <span className="flex flex-col leading-tight">
                  {when && <span className="text-[17px] font-semibold tabular-nums">{when}</span>}
                  <span className="mt-0.5 text-[15px] text-dim">{caption}</span>
                </span>
              </NamesHint>
            </div>

            <div className="anim-rise mt-7 flex flex-wrap gap-2.5" style={{ animationDelay: "0.45s" }}>
              <button
                onClick={(e) => openDay?.(today.day, e.currentTarget, true)}
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
              {when && game && <StartGathering day={spotlight.day} gameId={game.id} gameName={game.name} />}
              <DayLink day={spotlight.day} className="rounded-full px-4 py-3 text-[16px] font-medium text-dim transition hover:text-fg">
                Расписание дня
              </DayLink>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
