import { TopBar } from "@/components/TopBar";
import { ProfileForm } from "@/components/ProfileForm";
import { requireMember } from "@/lib/crew";

export default async function ProfilePage() {
  const { profile: me } = await requireMember();

  return (
    <>
      <TopBar me={me} back />
      <main className="mx-auto max-w-md px-4 pt-8 pb-16 sm:px-6">
        <h1 className="anim-rise mb-8 text-[44px] leading-none font-extrabold tracking-[-0.045em]">Профиль</h1>
        <ProfileForm id={me.id} name={me.name} avatarUrl={me.avatar_url} submitLabel="Сохранить" />
      </main>
    </>
  );
}
