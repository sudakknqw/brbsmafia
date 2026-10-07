import { Avatar } from "@/components/Avatar";
import { GameCover } from "@/components/GameCover";
import type { Game, Member, Want } from "@/lib/types";

/** Ряд друзей: у каждого на аватарке игры, в которые он хочет сейчас. */
export function StatusRow({ members, wants, games, meId }: { members: Member[]; wants: Want[]; games: Game[]; meId: string }) {
  const withStatus = members
    .map((m) => ({
      member: m,
      games: wants
        .filter((w) => w.user_id === m.id)
        .map((w) => games.find((g) => g.id === w.game_id))
        .filter((g) => !!g),
    }))
    .sort((a, b) => Number(b.member.id === meId) - Number(a.member.id === meId) || b.games.length - a.games.length);

  return (
    <section className="mt-8">
      <h2 className="mb-3 text-[20px] font-bold tracking-tight">Статусы</h2>
      <div className="no-scrollbar -mx-4 flex gap-5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {withStatus.map(({ member, games }) => (
          <div key={member.id} className={`w-[72px] shrink-0 text-center ${games.length ? "" : "opacity-40"}`}>
            <div className="relative mx-auto size-14">
              <Avatar id={member.id} name={member.name} url={member.avatar_url} size={56} />
              <div className="absolute -right-2 -bottom-1 flex">
                {games.slice(0, 3).map((g, i) => (
                  <div key={g.id} className={`w-[20px] rounded-[5px] ring-2 ring-bg ${i ? "-ml-2.5" : ""}`}>
                    <GameCover key={g.id} game={g} className="!rounded-[5px] !p-0 !text-[0px]" />
                  </div>
                ))}
              </div>
            </div>
            <p className="mt-2 truncate text-[13px]">{member.id === meId ? "Ты" : member.name}</p>
            <p className="truncate text-[11px] text-dim">{games.length ? games.map((g) => g.name).join(", ") : "без статуса"}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
