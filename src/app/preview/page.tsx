import { notFound } from "next/navigation";
import { HomeView } from "@/components/home/HomeView";
import { DayView } from "@/components/day/DayView";
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
  return <HomeView data={data} />;
}
