import { Spotlight } from "./Spotlight";
import { WeekRow } from "./WeekRow";
import { StatusRow } from "./StatusRow";
import { Library } from "./Library";
import { MonthStats } from "./MonthStats";
import { monthStats } from "@/lib/stats";
import type { DayEntry, Gathering } from "@/lib/types";

export type MonthData = { monthStart: string; entries: DayEntry[]; gatherings: Gathering[] };
import { buildHome, type CrewData } from "@/lib/views";
import { AmbientTail } from "@/components/AmbientTail";
import { DayOverlayProvider } from "@/components/day/DayOverlay";
import { Splash } from "@/components/splash/Splash";

export function HomeView({ data, month }: { data: CrewData; month: MonthData }) {
  const home = buildHome(data);
  const stats = monthStats({ members: data.members, games: data.games, today: data.today, ...month });
  return (
    <DayOverlayProvider data={data}>
      <Splash members={data.members} />
      <Spotlight
        me={data.me}
        spotlight={home.spotlight}
        gathering={home.gathering}
        today={home.today}
      />
      <main className="relative isolate mx-auto max-w-6xl space-y-14 px-4 pb-24 sm:px-8">
        <AmbientTail />
        <WeekRow week={home.week} total={home.total} />
        <StatusRow statuses={home.statuses} meId={data.me.id} viewerTz={data.me.timezone} />
        <Library games={data.games} wants={data.wants} members={data.members} meId={data.me.id} />
        <MonthStats cards={stats.cards} />
      </main>
    </DayOverlayProvider>
  );
}
