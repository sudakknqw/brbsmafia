import { Avatar } from "@/components/Avatar";
import { Cover } from "@/components/GameArt";
import { FriendTime } from "@/components/FriendTime";
import { personalPhrase } from "@/lib/phrases";
import type { HomeModel } from "@/lib/views";

/** Friends and the games currently in their status. */
export function StatusRow({ statuses, meId, viewerTz }: { statuses: HomeModel["statuses"]; meId: string; viewerTz: string }) {
  return (
    <section>
      <h2 className="mb-4 text-[22px] font-semibold tracking-tight">Статусы</h2>
      {/* Top padding for the friend-time tooltip: scrolling would clip it otherwise. */}
      <div className="no-scrollbar -mx-4 -mt-16 flex gap-6 overflow-x-auto px-4 pt-16 pb-1 sm:-mx-8 sm:px-8">
        {statuses.map(({ member, games }) => (
          <FriendTime
            key={member.id}
            name={member.name}
            timezone={member.timezone}
            viewerTz={viewerTz}
            className="w-[84px] shrink-0 flex-col"
          >
            <div className="relative mx-auto size-[68px]">
              <Avatar id={member.id} name={member.name} url={member.avatar_url} size={68} className={games.length ? "" : "opacity-40 grayscale"} />
              <div className="absolute -right-3 -bottom-1.5 flex">
                {games.slice(0, 3).map((g, i) => (
                  <div
                    key={g.id}
                    className="anim-pop w-[22px] overflow-hidden rounded-[5px] shadow-[0_0_0_2px_var(--color-ink)]"
                    style={{ marginLeft: i ? -10 : 0, rotate: `${(i - 1) * 8}deg`, animationDelay: `${i * 60}ms` }}
                  >
                    <Cover game={g} className="!rounded-[5px] !p-0 !text-[0px]" />
                  </div>
                ))}
              </div>
            </div>
            <p className="mt-2.5 w-full truncate text-center text-[14px] font-medium">{member.id === meId ? "Ты" : member.name}</p>
            <p className="w-full truncate text-center text-[12px] text-faint">{games.length ? games.map((g) => g.name).join(", ") : (personalPhrase(member.id) ?? "без статуса")}</p>
          </FriendTime>
        ))}
      </div>
    </section>
  );
}
