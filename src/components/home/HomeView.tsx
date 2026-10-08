import { HomeLive } from "./HomeLive";
import { MonthStats } from "./MonthStats";
import { bestWeekday, monthStats } from "@/lib/stats";
import type { DayEntry, Gathering } from "@/lib/types";
import type { CrewData } from "@/lib/views";

export type MonthData = { monthStart: string; entries: DayEntry[]; gatherings: Gathering[]; history: DayEntry[] };

export function HomeView({ data, month }: { data: CrewData; month: MonthData }) {
  const best = bestWeekday({ members: data.members, entries: month.history, today: data.today, tz: data.me.timezone });
  const stats = monthStats({ games: data.games, ...month, best });
  return <HomeLive data={data} footer={<MonthStats cards={stats.cards} />} />;
}
