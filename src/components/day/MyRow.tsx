"use client";

import type { Ref } from "react";
import { Avatar } from "@/components/Avatar";
import type { Member } from "@/lib/types";
import { DayNote } from "./DayNote";
import { pct, type Range } from "./timeScale";

/** Red "NO" circle: can't make it this day. */
function NoButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      aria-label={active ? "Всё-таки смогу" : "Не смогу в этот день"}
      title={active ? "Всё-таки смогу" : "Не смогу"}
      className={`flex size-7 shrink-0 items-center justify-center rounded-full text-[9px] font-extrabold tracking-wide transition active:scale-90 ${
        active ? "bg-bad text-white" : "text-faint ring-1 ring-white/20 hover:bg-bad/20 hover:text-bad hover:ring-bad/60"
      }`}
    >
      NO
    </button>
  );
}

type Props = {
  rowRef: Ref<HTMLDivElement>;
  member: Member;
  hourLabels: string[];
  range: Range | null;
  busy: boolean;
  anchor: number | null;
  preview: Range | null;
  /** Bar key: when it changes, the appear animation replays. */
  grown: number;
  /** Saved day note, under the bar. */
  note: string;
  onBusy: (value: boolean) => void;
  onBar: () => void;
  onPick: (h: number) => void;
  onHover: (h: number) => void;
};

/**
 * Your own row: two cells of the timeline grid, the name with NO and the bar.
 * While no time is set, the bar is split into hours: tap the start, tap the end.
 */
export function MyRow({ rowRef, member, hourLabels, range, busy, anchor, preview, grown, note, onBusy, onBar, onPick, onHover }: Props) {
  return (
    <>
      {/* Own row: one continuous highlight across both columns, no seam in the middle */}
      <div className="pointer-events-none absolute -inset-x-2 top-7 h-14 rounded-2xl bg-white/[0.06]" aria-hidden="true" />
      <div ref={rowRef} id="my-row" className="relative flex h-14 items-center gap-2 pr-1">
        <Avatar id={member.id} name={member.name} url={member.avatar_url} size={26} />
        <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">Ты</span>
        <NoButton active={busy} onClick={() => onBusy(!busy)} />
      </div>
      <div className="relative h-14">
        <div className={`relative h-full transition-opacity ${busy && !range && anchor === null ? "opacity-40" : ""}`}>
          <div className="absolute inset-x-0 top-1/2 h-4 -translate-y-1/2 rounded-full bg-white/10" />
          {range && (
            <button
              key={grown}
              onClick={onBar}
              aria-label={`Моё время ${hourLabels[range[0]]} – ${hourLabels[range[1]]}. Изменить`}
              className="anim-grow absolute top-1/2 h-4 -translate-y-1/2 rounded-full bg-fg transition hover:h-5"
              style={{ left: pct(range[0]), width: pct(range[1] - range[0]) }}
            />
          )}
          {range && note && <DayNote text={note} range={range} className="top-[38px]" />}
          {preview && (
            <>
              <div
                className="pointer-events-none absolute top-1/2 h-4 -translate-y-1/2 rounded-full bg-white/35 transition-all duration-100"
                style={{ left: pct(preview[0]), width: pct(preview[1] - preview[0]) }}
              />
              <div
                className="pointer-events-none absolute top-1/2 h-5 -translate-y-1/2 animate-pulse rounded-full bg-fg"
                style={{ left: pct(anchor!), width: pct(1) }}
              />
            </>
          )}
          {!range && (
            <div className="absolute inset-0 grid grid-cols-24" onPointerLeave={() => anchor !== null && onHover(anchor)}>
              {hourLabels.slice(0, -1).map((label, h) => (
                <button
                  key={h}
                  onClick={() => onPick(h)}
                  onPointerEnter={() => onHover(h)}
                  aria-label={anchor === null ? `Свободен с ${label}` : `До ${hourLabels[h + 1]}`}
                  className="h-full rounded-md transition-colors hover:bg-white/10"
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
