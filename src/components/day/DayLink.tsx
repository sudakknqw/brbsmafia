"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useOpenDay } from "./DayOverlay";

/**
 * Link to a day. On the home page it expands the day over the page;
 * with Ctrl/Cmd held or outside the home page it's a normal navigation.
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
