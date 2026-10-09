import { Avatar } from "@/components/Avatar";
import { FriendTime } from "@/components/FriendTime";
import { memberColor } from "@/lib/colors";
import { busyPhrase } from "@/lib/phrases";
import { DAY_HOURS } from "@/lib/time";
import { DayNote } from "./DayNote";
import { pct, runs, toRange, type Row } from "./timeScale";

/** Строки остальных — две ячейки сетки шкалы: имена и полосы. */
export function FriendRows({ day, rows, hourLabels, viewerTz }: { day: string; rows: Row[]; hourLabels: string[]; viewerTz: string }) {
  return (
    <>
      <div className="mt-1">
        {rows.map(({ member, state }) => (
          <div key={member.id} className="flex h-12 items-center gap-2 pr-1">
            <FriendTime name={member.name} timezone={member.timezone} viewerTz={viewerTz} className="flex-1">
              <span className={`flex min-w-0 items-center gap-2 ${state === "free" ? "" : "opacity-45"}`}>
                <Avatar id={member.id} name={member.name} url={member.avatar_url} size={26} />
                <span className="truncate text-[14px] font-medium">{member.name}</span>
              </span>
            </FriendTime>
            {state === "busy" && (
              <span title={busyPhrase(member.id, day)} className="flex size-7 shrink-0 items-center justify-center rounded-full bg-bad text-[9px] font-extrabold tracking-wide text-white">
                NO
              </span>
            )}
          </div>
        ))}
      </div>
      <div className="relative mt-1">
        <div className="pointer-events-none absolute inset-0 flex" aria-hidden="true">
          {Array.from({ length: DAY_HOURS / 4 }, (_, i) => (
            <div key={i} className="flex-1 border-l border-line first:border-l-0" />
          ))}
        </div>
        {rows.map(({ member, hours, state, note, comment }, row) => (
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
                      animationDelay: `calc(var(--base, 0s) + ${0.1 + row * 0.05}s)`,
                    }}
                    title={`${hourLabels[a]} – ${hourLabels[b]}`}
                  />
                ))}
              {state === "free" && comment && <DayNote text={comment} range={toRange(hours)!} className="top-full mt-0.5" />}
              {state !== "free" && note && <span className="absolute inset-y-0 left-0 flex items-center text-[13px] text-faint italic">{note}</span>}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
