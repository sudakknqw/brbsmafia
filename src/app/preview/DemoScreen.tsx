import { HomeView } from "@/components/home/HomeView";
import { DayView } from "@/components/day/DayView";
import { addDays } from "@/lib/time";
import { mockCrew } from "./mock";

type Params = Record<string, string | string[] | undefined>;

/**
 * Home or day screen on made-up data. Used by the public /demo page and the
 * dev-only /preview page. Nothing here touches the database: any action a
 * visitor triggers is rejected by the server (there is no session).
 *
 * ?day opens today's timeline, ?empty shows a fresh crew, ?n=3 limits the crew size.
 */
export function DemoScreen({ params }: { params: Params }) {
  const data = mockCrew("empty" in params ? "empty" : "full");
  const n = Number(params.n);
  if (n >= 1 && n <= 8) data.members = data.members.slice(0, n);
  if ("day" in params) return <DayView data={data} day={data.today} />;
  // History for the "best day" card: this week repeated 4 weeks back.
  const shift = (iso: string, weeks: number) => new Date(Date.parse(iso) - weeks * 7 * 86400_000).toISOString();
  const history = [1, 2, 3, 4].flatMap((w) =>
    data.entries.map((e) => ({
      ...e,
      day: addDays(e.day, -7 * w),
      slots: e.slots.map((s) => ({ start: shift(s.start, w), end: shift(s.end, w) })),
    })),
  );
  const month = { monthStart: data.today.slice(0, 8) + "01", entries: data.entries, gatherings: data.gatherings, history };
  return <HomeView data={data} month={month} />;
}
