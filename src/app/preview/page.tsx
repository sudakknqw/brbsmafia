import { notFound } from "next/navigation";
import { HomeView } from "@/components/home/HomeView";
import { DayView } from "@/components/day/DayView";
import { addDays } from "@/lib/time";
import { mockCrew } from "./mock";

// Предпросмотр дизайна на выдуманных данных: /preview, /preview?empty, /preview?day,
// /preview?n=3 — компания из трёх человек (для экрана загрузки).
// В продакшене страницы нет.
export default async function Preview({ searchParams }: PageProps<"/preview">) {
  if (process.env.NODE_ENV === "production") notFound();
  const params = await searchParams;
  const data = mockCrew("empty" in params ? "empty" : "full");
  const n = Number(params.n);
  if (n >= 1 && n <= 8) data.members = data.members.slice(0, n);
  if ("day" in params) return <DayView data={data} day={data.today} />;
  // История для «лучшего дня»: эта неделя, повторённая на 4 недели назад.
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
