"use client";

import Link from "next/link";
import { weekdayLong } from "@/lib/time";

const arrow = (to: 1 | -1) => (
  <svg width="10" height="17" viewBox="0 0 10 17" aria-hidden="true">
    <path
      d={to === -1 ? "M8.5 1.5L2 8.5l6.5 7" : "M1.5 1.5L8 8.5l-6.5 7"}
      stroke="currentColor"
      strokeWidth="2.2"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const style =
  "flex size-11 items-center justify-center rounded-full bg-white/15 transition hover:scale-105 hover:bg-white/20 active:scale-95";

/**
 * Стрелки к соседним дням. В раскрытом дне на главной листают внутри недели
 * (onGo), на отдельной странице /day/… — обычные ссылки.
 */
export function DayNav({
  prevDay,
  nextDay,
  onGo,
}: {
  prevDay: string | null;
  nextDay: string | null;
  onGo?: (day: string, to: 1 | -1) => void;
}) {
  const one = (day: string | null, to: 1 | -1) => {
    const label = day ? `${to === -1 ? "Предыдущий" : "Следующий"} день: ${weekdayLong(day)}` : undefined;
    if (!day) return <span className={`${style} pointer-events-none opacity-30`} aria-hidden="true">{arrow(to)}</span>;
    if (onGo) {
      return (
        <button onClick={() => onGo(day, to)} aria-label={label} title={label} className={style}>
          {arrow(to)}
        </button>
      );
    }
    return (
      <Link href={`/day/${day}`} aria-label={label} title={label} className={style}>
        {arrow(to)}
      </Link>
    );
  };
  return (
    <div className="flex shrink-0 gap-2">
      {one(prevDay, -1)}
      {one(nextDay, 1)}
    </div>
  );
}
