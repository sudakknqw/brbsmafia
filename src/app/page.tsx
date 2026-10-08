import { LiveSync } from "@/components/LiveSync";
import { HomeView } from "@/components/home/HomeView";
import { SteamPrompt } from "@/components/steam/SteamPrompt";
import { loadCrewData, loadMonth, requireMember } from "@/lib/crew";
import { steamConfigured } from "@/lib/steamApi";
import { gamingDay } from "@/lib/time";

export default async function Home() {
  const viewer = await requireMember();
  const today = gamingDay(new Date(), viewer.profile.timezone);
  const [data, month] = await Promise.all([loadCrewData(viewer), loadMonth(viewer.supabase, today)]);
  return (
    <>
      <LiveSync timezone={data.me.timezone} meId={data.me.id} />
      <HomeView data={data} month={month} />
      {!viewer.profile.steam_id && steamConfigured() && <SteamPrompt />}
    </>
  );
}
