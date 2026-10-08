import { TopBar } from "@/components/TopBar";
import { ProfileForm } from "@/components/ProfileForm";
import { SteamLinkForm } from "@/components/steam/SteamLinkForm";
import { requireMember } from "@/lib/crew";
import { steamConfigured } from "@/lib/steamApi";

export default async function ProfilePage() {
  const { profile: me } = await requireMember();
  const steamId = (me as { steam_id?: string | null }).steam_id;

  return (
    <>
      <TopBar me={me} back />
      <main className="mx-auto max-w-md px-4 pt-8 pb-16 sm:px-6">
        <h1 className="anim-rise mb-8 text-[44px] leading-none font-extrabold tracking-[-0.045em]">Профиль</h1>
        <ProfileForm id={me.id} name={me.name} avatarUrl={me.avatar_url} submitLabel="Сохранить" />
        {steamConfigured() && (
          <section className="mt-12">
            <h2 className="mb-1.5 text-[20px] font-semibold tracking-tight">Steam</h2>
            <p className="mb-4 text-sm text-dim">Ссылка на твой профиль: по ней игры, в которые компания чаще играет, стоят выше.</p>
            <SteamLinkForm initial={steamId ? `https://steamcommunity.com/profiles/${steamId}` : ""} />
          </section>
        )}
      </main>
    </>
  );
}
