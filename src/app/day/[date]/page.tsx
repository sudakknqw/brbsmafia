import { notFound } from "next/navigation";
import { LiveSync } from "@/components/LiveSync";
import { DayView } from "@/components/day/DayView";
import { loadCrewData, requireMember } from "@/lib/crew";
import { addDays } from "@/lib/time";

export default async function DayPage({ params }: PageProps<"/day/[date]">) {
  const { date: day } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) notFound();

  const viewer = await requireMember();
  const data = await loadCrewData(viewer, addDays(day, -1), addDays(day, 1));
  return (
    <>
      <LiveSync timezone={data.me.timezone} meId={data.me.id} />
      <DayView data={data} day={day} />
    </>
  );
}
