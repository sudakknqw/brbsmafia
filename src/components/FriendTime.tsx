"use client";

import { useState, type ReactNode } from "react";
import { offsetMinutes } from "@/lib/time";
import { plural } from "@/lib/words";

/** «Маша: сейчас 03:12. Это на 4 часа позже, чем у тебя» — при наведении или нажатии. */
export function FriendTime({
  name,
  timezone,
  viewerTz,
  children,
  className = "",
}: {
  name: string;
  timezone: string;
  viewerTz: string;
  children: ReactNode;
  className?: string;
}) {
  const [text, setText] = useState("");

  // Считаем в момент наведения: время «живое» и не расходится с сервером.
  const refresh = () => {
    const now = new Date();
    const local = new Intl.DateTimeFormat("ru-RU", { timeZone: timezone, hour: "2-digit", minute: "2-digit" }).format(now);
    const diff = (offsetMinutes(now, timezone) - offsetMinutes(now, viewerTz)) / 60;
    const hours = Math.abs(diff);
    const shown = Number.isInteger(hours) ? String(hours) : hours.toFixed(1).replace(".", ",");
    const unit = Number.isInteger(hours) ? plural(hours, "час", "часа", "часов") : "часа";
    // Ники не склоняем: «у Маша» звучит хуже, чем «Маша: сейчас…».
    const relation = diff === 0 ? "Так же, как у тебя" : `Это на ${shown} ${unit} ${diff > 0 ? "позже" : "раньше"}, чем у тебя`;
    setText(`${name}: сейчас ${local}. ${relation}`);
  };

  return (
    <span
      tabIndex={0}
      onPointerEnter={refresh}
      onFocus={refresh}
      className={`group/time relative inline-flex min-w-0 items-center outline-none ${className}`}
    >
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-0 z-30 mb-2 w-max max-w-[240px] translate-y-1 rounded-xl border border-line bg-[#1a1a1f] px-3 py-2 text-[13px] leading-snug text-fg opacity-0 shadow-[0_12px_32px_rgba(0,0,0,0.5)] transition duration-150 group-hover/time:translate-y-0 group-hover/time:opacity-100 group-focus-visible/time:translate-y-0 group-focus-visible/time:opacity-100 group-focus/time:translate-y-0 group-focus/time:opacity-100"
      >
        {text}
      </span>
    </span>
  );
}
