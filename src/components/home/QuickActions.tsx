"use client";

import { useTransition } from "react";
import { clearDay, quickFill, setBusy } from "@/app/actions";

export function QuickActions({ today, busyToday }: { today: string; busyToday: boolean }) {
  const [pending, start] = useTransition();
  const chip = "shrink-0 rounded-full bg-card px-4 py-2 text-sm font-medium transition hover:bg-elev disabled:opacity-50";

  return (
    <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <button disabled={pending} onClick={() => start(() => quickFill("today"))} className={chip}>
        Сегодня вечером
      </button>
      <button disabled={pending} onClick={() => start(() => quickFill("tomorrow"))} className={chip}>
        Завтра вечером
      </button>
      <button disabled={pending} onClick={() => start(() => quickFill("weekend"))} className={chip}>
        Выходные
      </button>
      <button
        disabled={pending}
        onClick={() => start(() => (busyToday ? clearDay(today) : setBusy(today)))}
        className={`${chip} ${busyToday ? "text-dim" : ""}`}
      >
        {busyToday ? "Всё-таки могу" : "Сегодня не могу"}
      </button>
    </div>
  );
}
