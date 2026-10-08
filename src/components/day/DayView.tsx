import { AvatarStack } from "@/components/Avatar";
import { Ambient, HeroArt } from "@/components/GameArt";
import { TopBar } from "@/components/TopBar";
import { JumpToMine } from "./JumpToMine";
import { GatheringInfo, StartGathering } from "@/components/Gathering";
import { Timeline } from "./Timeline";
import { MAX_DAY_GAMES } from "@/lib/limits";
import { buildDay, type CrewData } from "@/lib/views";
import { who } from "@/lib/words";
import { NamesHint } from "@/components/NamesHint";
import { HeaderCard } from "./HeaderCard";
import { AmbientTail } from "@/components/AmbientTail";
import { CloseBar } from "./CloseBar";

/**
 * Экран дня. Отдельной страницей (/day/…) или внутри раскрывающейся панели
 * на главной — тогда вместо «Главная» кнопка закрытия (onClose).
 */
export function DayView({ data, day, onClose, invite }: { data: CrewData; day: string; onClose?: () => void; invite?: boolean }) {
  const m = buildDay(data, day);
  const game = m.spotlightGame;
  const bestNames = m.best
    ? m.rows.filter((r) => r.hours.includes(m.best!.from)).map((r) => (r.member.id === data.me.id ? "ты" : r.member.name))
    : [];

  return (
    <>
      <section className="relative isolate overflow-hidden">
        <Ambient game={game} />
        {game && <HeroArt key={game.id} game={game} className="anim-art absolute inset-0 -z-20 h-full w-full opacity-70" />}
        <div className="absolute inset-0 -z-10" style={{ background: "linear-gradient(to top, var(--color-ink) 0%, var(--color-ink) 12%, rgb(5 5 7 / 0.7) 55%, rgb(5 5 7 / 0.3) 100%)" }} />
        <AmbientTail edge="bottom" />
        {onClose ? <CloseBar onClose={onClose} /> : <TopBar me={data.me} back />}
        <div className="mx-auto w-full max-w-6xl px-4 pt-10 pb-8 sm:px-8 sm:pt-16">
          <p className="anim-rise text-[15px] text-dim" style={{ animationDelay: "var(--base, 0s)" }}>
            {m.date}
          </p>
          <h1 className="anim-rise mt-1 text-[clamp(44px,9vw,84px)] leading-[0.92] font-extrabold tracking-[-0.045em]" style={{ animationDelay: "calc(var(--base, 0s) + 0.08s)" }}>
            {m.title}
          </h1>
          <p className="anim-rise mt-4 text-[17px]" style={{ animationDelay: "calc(var(--base, 0s) + 0.16s)" }}>
            {m.best ? (
              <>
                Все вместе с <b className="font-semibold tabular-nums">{m.hourLabels[m.best.from]}</b> до{" "}
                <b className="font-semibold tabular-nums">{m.hourLabels[m.best.to]}</b>,{" "}
                <NamesHint names={bestNames}>{who(bestNames, "свободен", "свободны")}</NamesHint>
              </>
            ) : (
              <span className="text-dim">Пока никто не совпал</span>
            )}
          </p>
          <div className="anim-rise mt-6" style={{ animationDelay: "calc(var(--base, 0s) + 0.24s)" }}>
            {m.gathering ? (
              <GatheringInfo key={m.gathering.id} gathering={m.gathering} meId={data.me.id} />
            ) : (
              <div className="flex flex-wrap gap-2.5">
                <JumpToMine marked={m.editor.initialHours.length > 0} />
                {m.best && game && <StartGathering day={day} gameId={game.id} gameName={game.name} />}
              </div>
            )}
          </div>
        </div>
      </section>

      <main className="relative isolate mx-auto max-w-6xl space-y-14 px-4 pb-24 sm:px-8">
        <AmbientTail />
        <Timeline
          key={day}
          day={day}
          hourLabels={m.hourLabels}
          rows={m.rows}
          meId={data.me.id}
          initialGames={m.editor.initialGames}
          games={data.games}
          recent={data.recent}
          maxGames={MAX_DAY_GAMES}
          invite={invite}
          viewerTz={data.me.timezone}
        />

        {/* Игры этого дня */}
        <section>
          <h2 className="mb-4 text-[22px] font-semibold tracking-tight">Игры на этот день</h2>
          {m.dayGames.length ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {m.dayGames.map(({ game, people: fans }, i) => (
                <div key={game.id} className="anim-rise" style={{ animationDelay: `calc(var(--base, 0s) + ${0.3 + i * 0.06}s)` }}>
                  <HeaderCard game={game} />
                  <div className="mt-2.5 flex items-center justify-between gap-3">
                    <span className="truncate text-[15px] font-medium">{game.name}</span>
                    <NamesHint names={fans.map((p) => p.name)}>
                      <AvatarStack people={fans} size={24} max={5} />
                    </NamesHint>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[15px] text-dim">Никто ещё не выбрал. Игры выбираются там же, где время.</p>
          )}
        </section>
      </main>
    </>
  );
}
