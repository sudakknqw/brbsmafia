import { Avatar } from "@/components/Avatar";
import { Cover } from "@/components/GameArt";
import type { HomeModel } from "@/lib/views";

/** Друзья и игры, которые у них сейчас в статусе. */
export function StatusRow({ statuses, meId }: { statuses: HomeModel["statuses"]; meId: string }) {
  return (
    <section>
      <h2 className="mb-4 text-[22px] font-semibold tracking-tight">Статусы</h2>
      <div className="no-scrollbar -mx-4 flex gap-6 overflow-x-auto px-4 py-1 sm:-mx-8 sm:px-8">
        {statuses.map(({ member, games }) => (
          <div key={member.id} className="w-[84px] shrink-0">
            <div className="relative mx-auto size-[68px]">
              <Avatar id={member.id} name={member.name} url={member.avatar_url} size={68} className={games.length ? "" : "opacity-40 grayscale"} />
              <div className="absolute -right-3 -bottom-1.5 flex">
                {games.slice(0, 3).map((g, i) => (
                  <div
                    key={g.id}
                    className="anim-pop w-[22px] overflow-hidden rounded-[5px] shadow-[0_0_0_2px_var(--color-ink)]"
                    style={{ marginLeft: i ? -10 : 0, transform: `rotate(${(i - 1) * 8}deg)`, animationDelay: `${i * 60}ms` }}
                  >
                    <Cover game={g} className="!rounded-[5px] !p-0 !text-[0px]" />
                  </div>
                ))}
              </div>
            </div>
            <p className="mt-2.5 truncate text-center text-[14px] font-medium">{member.id === meId ? "Ты" : member.name}</p>
            <p className="truncate text-center text-[12px] text-faint">{games.length ? games.map((g) => g.name).join(", ") : "без статуса"}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
