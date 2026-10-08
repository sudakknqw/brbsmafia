import { Spotlight } from "./Spotlight";
import { WeekRow } from "./WeekRow";
import { StatusRow } from "./StatusRow";
import { Library } from "./Library";
import { buildHome, type CrewData } from "@/lib/views";
import { AmbientTail } from "@/components/AmbientTail";
import { DayOverlayProvider } from "@/components/day/DayOverlay";

export function HomeView({ data }: { data: CrewData }) {
  const home = buildHome(data);
  return (
    <DayOverlayProvider data={data}>
      <Spotlight
        me={data.me}
        spotlight={home.spotlight}
        today={home.today}
      />
      <main className="relative isolate mx-auto max-w-6xl space-y-14 px-4 pb-24 sm:px-8">
        <AmbientTail />
        <WeekRow week={home.week} total={home.total} />
        <StatusRow statuses={home.statuses} meId={data.me.id} />
        <Library games={data.games} wants={data.wants} members={data.members} meId={data.me.id} />
      </main>
    </DayOverlayProvider>
  );
}
