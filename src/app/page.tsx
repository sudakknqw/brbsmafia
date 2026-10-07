import { LiveSync } from "@/components/LiveSync";
import { HomeView } from "@/components/home/HomeView";
import { loadCrewData, requireMember } from "@/lib/crew";

export default async function Home() {
  const viewer = await requireMember();
  const data = await loadCrewData(viewer);
  return (
    <>
      <LiveSync timezone={data.me.timezone} meId={data.me.id} />
      <HomeView data={data} />
    </>
  );
}
