"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useOpenDay } from "./DayOverlay";

/**
 * Ссылка на день. На главной раскрывает день поверх страницы;
 * с зажатым Ctrl/Cmd или без главной — обычный переход.
 */
export function DayLink({
  day,
  className,
  today,
  children,
}: {
  day: string;
  className?: string;
  today?: boolean;
  children: ReactNode;
}) {
  const openDay = useOpenDay();
  return (
    <Link
      href={`/day/${day}`}
      className={className}
      data-today={today || undefined}
      onClick={(e) => {
        if (!openDay || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        openDay(day, e.currentTarget);
      }}
    >
      {children}
    </Link>
  );
}
