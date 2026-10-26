import { DayLink } from "@/components/day/DayLink";
import { ScrollToToday } from "./ScrollToToday";
import { QuickFill } from "./QuickFill";
import type { HomeModel } from "@/lib/views";

/**
 * The week from Monday to Sunday. Today is outlined
 * and "moves" across the tiles; past days are dimmed.
 */
export function WeekRow({ week, total }: { week: HomeModel["week"]; total: number }) {
  return (
    <section>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-[22px] font-semibold tracking-tight">Неделя</h2>
        <QuickFill />
      </div>
      <ScrollToToday className="no-scrollbar -mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 py-2 sm:-mx-8 sm:scroll-px-8 sm:px-8">
        {week.map((d) => (
          <DayLink
            key={d.day}
            day={d.day}
            className={`tile w-[132px] shrink-0 snap-start rounded-2xl bg-glass p-3.5 sm:w-[148px] ${d.isToday ? "tile-on" : ""} ${d.isPast ? "opacity-40" : ""}`}
            today={d.isToday}
          >
            <div className="flex items-baseline justify-between">
              <span className="text-[13px] text-dim">{d.isToday ? "Сегодня" : d.weekday}</span>
              {d.mine && (
                <span
                  title={d.mine === "free" ? "Ты отметил время" : "Ты не можешь"}
                  className={`size-2 rounded-full ${d.mine === "free" ? "bg-fg" : "ring-1 ring-faint"}`}
                />
              )}
            </div>
            <p className="mt-0.5 text-[28px] leading-none font-semibold tabular-nums">{d.num}</p>
            <div className="mt-4 flex h-9 items-end gap-px" aria-hidden="true">
              {d.counts.map((c, i) => (
                <span
                  key={i}
                  className="flex-1 rounded-[1px]"
                  style={{
                    height: c ? `${Math.max(12, (c / Math.max(total, 1)) * 100)}%` : "2px",
                    background: c >= 2 ? "var(--color-fg)" : c ? "var(--color-faint)" : "var(--color-line)",
                  }}
                />
              ))}
            </div>
            <p className="mt-2.5 text-[13px] text-dim">
              {d.peak >= 2 ? `до ${d.peak} вместе` : d.peak === 1 ? "пока один" : "пусто"}
            </p>
          </DayLink>
        ))}
      </ScrollToToday>
    </section>
  );
}
