import { Avatar, AvatarStack } from "@/components/Avatar";
import { Ambient, HeroArt } from "@/components/GameArt";
import { TopBar } from "@/components/TopBar";
import { DayActions } from "./DayActions";
import { memberColor } from "@/lib/colors";
import { MAX_DAY_GAMES } from "@/lib/limits";
import { DAY_HOURS } from "@/lib/time";
import { buildDay, type CrewData } from "@/lib/views";
import { ofTotal, people } from "@/lib/words";
import { HeaderCard } from "./HeaderCard";
import { AmbientTail } from "@/components/AmbientTail";

const pct = (i: number) => `${(i / DAY_HOURS) * 100}%`;

function runs(hours: number[]): [number, number][] {
  const out: [number, number][] = [];
  for (const h of [...hours].sort((a, b) => a - b)) {
    const last = out[out.length - 1];
    if (last && last[1] === h) last[1] = h + 1;
    else out.push([h, h + 1]);
  }
  return out;
}

export function DayView({ data, day }: { data: CrewData; day: string }) {
  const m = buildDay(data, day);
  const game = m.spotlightGame;

  return (
    <>
      <section className="relative isolate overflow-hidden">
        <Ambient game={game} />
        {game && <HeroArt key={game.id} game={game} className="anim-art absolute inset-0 -z-20 h-full w-full opacity-70" />}
        <div className="absolute inset-0 -z-10" style={{ background: "linear-gradient(to top, var(--color-ink) 0%, var(--color-ink) 12%, rgb(5 5 7 / 0.7) 55%, rgb(5 5 7 / 0.3) 100%)" }} />
        <AmbientTail edge="bottom" />
        <TopBar me={data.me} back />
        <div className="mx-auto w-full max-w-6xl px-4 pt-10 pb-8 sm:px-8 sm:pt-16">
          <p className="anim-rise text-[15px] text-dim">{m.date}</p>
          <h1 className="anim-rise mt-1 text-[clamp(44px,9vw,84px)] leading-[0.92] font-extrabold tracking-[-0.045em]" style={{ animationDelay: "0.08s" }}>
            {m.title}
          </h1>
          <p className="anim-rise mt-4 text-[17px]" style={{ animationDelay: "0.16s" }}>
            {m.best ? (
              <>
                Все вместе с <b className="font-semibold tabular-nums">{m.hourLabels[m.best.from]}</b> до{" "}
                <b className="font-semibold tabular-nums">{m.hourLabels[m.best.to]}</b>, свободны {people(m.best.count)} {ofTotal(m.total)}
              </>
            ) : (
              <span className="text-dim">Пока никто не совпал</span>
            )}
          </p>
          <div className="anim-rise mt-6" style={{ animationDelay: "0.24s" }}>
            <DayActions seed={m.editor} title={m.title} games={data.games} recent={data.recent} maxGames={MAX_DAY_GAMES} />
          </div>
        </div>
      </section>

      <main className="relative isolate mx-auto max-w-6xl space-y-14 px-4 pb-24 sm:px-8">
        <AmbientTail />
        {/* Шкала по часам */}
        <section className="rounded-[24px] bg-glass p-4 backdrop-blur-sm sm:p-6">
          <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-x-3 sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-x-5">
            <div />
            <div className="relative mb-3 h-4 text-[12px] text-faint tabular-nums">
              {m.hourLabels.map((label, i) =>
                i % 4 === 0 ? (
                  <span
                    key={i}
                    className={`absolute ${i === 0 ? "" : i === DAY_HOURS ? "-translate-x-full" : "-translate-x-1/2"}`}
                    style={{ left: pct(i) }}
                  >
                    {label}
                  </span>
                ) : null,
              )}
            </div>

            <div>
              {m.rows.map(({ member, state }) => (
                <div key={member.id} className={`flex h-12 items-center gap-2.5 ${state === "free" ? "" : "opacity-45"}`}>
                  <Avatar id={member.id} name={member.name} url={member.avatar_url} size={26} />
                  <span className="truncate text-[14px] font-medium">{member.id === data.me.id ? "Ты" : member.name}</span>
                </div>
              ))}
            </div>

            <div className="relative">
              {/* Сетка часов */}
              <div className="pointer-events-none absolute inset-0 flex" aria-hidden="true">
                {Array.from({ length: DAY_HOURS / 4 }, (_, i) => (
                  <div key={i} className="flex-1 border-l border-line first:border-l-0" />
                ))}
              </div>
              {m.best && (
                <div
                  className="pointer-events-none absolute -inset-y-1 rounded-xl bg-white/[0.06] shadow-[0_0_0_1.5px_#fff]"
                  style={{ left: pct(m.best.from), width: pct(m.best.to - m.best.from) }}
                />
              )}
              {m.rows.map(({ member, hours, state, note }, row) => (
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
                            animationDelay: `${0.1 + row * 0.05}s`,
                          }}
                          title={`${m.hourLabels[a]} – ${m.hourLabels[b]}`}
                        />
                      ))}
                    {state !== "free" && (
                      <span className={`absolute inset-y-0 left-0 flex items-center text-[13px] ${state === "silent" ? "text-faint italic" : "text-dim"}`}>
                        {state === "busy" ? "не может" : note}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Игры этого дня */}
        <section>
          <h2 className="mb-4 text-[22px] font-semibold tracking-tight">Игры на этот день</h2>
          {m.dayGames.length ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {m.dayGames.map(({ game, people: who }, i) => (
                <div key={game.id} className="anim-rise" style={{ animationDelay: `${i * 0.06}s` }}>
                  <HeaderCard game={game} />
                  <div className="mt-2.5 flex items-center justify-between gap-3">
                    <span className="truncate text-[15px] font-medium">{game.name}</span>
                    <AvatarStack people={who} size={24} max={5} />
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
