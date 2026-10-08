import { HomeLive } from "./HomeLive";
import { MonthStats } from "./MonthStats";
import { monthStats } from "@/lib/stats";
import type { DayEntry, Gathering } from "@/lib/types";
import type { CrewData } from "@/lib/views";

export type MonthData = { monthStart: string; entries: DayEntry[]; gatherings: Gathering[] };

export function HomeView({ data, month }: { data: CrewData; month: MonthData }) {
  const stats = monthStats({ games: data.games, ...month });
  return <HomeLive data={data} footer={<MonthStats cards={stats.cards} />} />;
}
