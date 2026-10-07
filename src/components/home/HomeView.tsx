import { Spotlight } from "./Spotlight";
import { WeekRow } from "./WeekRow";
import { StatusRow } from "./StatusRow";
import { Library } from "./Library";
import { buildHome, type CrewData } from "@/lib/views";
import { MAX_DAY_GAMES } from "@/lib/limits";
import { AmbientTail } from "@/components/AmbientTail";

export function HomeView({ data }: { data: CrewData }) {
  const home = buildHome(data);
  return (
    <>
      <Spotlight
        me={data.me}
        spotlight={home.spotlight}
        total={home.total}
        today={home.today}
        games={data.games}
        recent={data.recent}
        maxGames={MAX_DAY_GAMES}
      />
      <main className="relative isolate mx-auto max-w-6xl space-y-14 px-4 pb-24 sm:px-8">
        <AmbientTail />
        <WeekRow week={home.week} total={home.total} />
        <StatusRow statuses={home.statuses} meId={data.me.id} />
        <Library games={data.games} wants={data.wants} members={data.members} meId={data.me.id} />
      </main>
    </>
  );
}
