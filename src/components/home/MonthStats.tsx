import { HeroArt } from "@/components/GameArt";
import type { StatCard } from "@/lib/stats";

/** Monthly stats: number of sessions and the game of the month. */
export function MonthStats({ cards }: { cards: StatCard[] }) {
  if (!cards.length) return null;
  return (
    <section>
      <h2 className="mb-4 text-[22px] font-semibold tracking-tight">Итоги месяца</h2>
      <div className="grid grid-cols-2 gap-3 sm:max-w-3xl sm:grid-cols-3">
        {cards.map((c) => (
          <article key={c.label} className="relative isolate flex min-h-[150px] flex-col justify-between overflow-hidden rounded-2xl bg-glass p-4">
            {c.kind === "game" && c.game && (
              <>
                <HeroArt game={c.game} className="absolute inset-0 -z-20 h-full w-full opacity-60" />
                <div className="absolute inset-0 -z-10 bg-linear-to-t from-ink/90 to-ink/20" />
              </>
            )}
            <p className="text-[13px] text-dim">{c.label}</p>
            <div>
              {c.kind === "count" && <p className="text-[44px] leading-none font-extrabold tracking-tight tabular-nums">{c.value}</p>}
              {c.kind === "game" && <p className="text-[20px] leading-tight font-bold text-balance">{c.name}</p>}
              {c.kind === "text" && <p className="text-[28px] leading-none font-extrabold tracking-tight">{c.value}</p>}
              <p className="mt-2 text-[13px] text-dim">{c.note}</p>
            </div>
          </article>
        ))}
      </div>
      <p className="mt-3 text-[13px] text-faint">
        Считается с 1-го числа по сегодняшний день{cards.some((c) => c.kind === "text") ? ", лучший день — по последним 8 неделям" : ""}.
      </p>
    </section>
  );
}
