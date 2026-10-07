import { TopBar } from "@/components/TopBar";
import { ProfileForm } from "@/components/ProfileForm";
import { signOut } from "@/app/actions";
import { requireMember } from "@/lib/crew";

export default async function ProfilePage() {
  const { profile: me } = await requireMember();

  return (
    <>
      <TopBar me={me} back />
      <main className="mx-auto max-w-md px-4 pt-8 pb-16 sm:px-6">
        <h1 className="anim-rise mb-8 text-[44px] leading-none font-extrabold tracking-[-0.045em]">Профиль</h1>
        <ProfileForm id={me.id} name={me.name} avatarUrl={me.avatar_url} submitLabel="Сохранить" />
        <form action={signOut} className="mt-12">
          <button className="w-full rounded-full bg-glass py-3.5 text-[16px] text-bad transition hover:bg-glass2">Выйти</button>
        </form>
      </main>
    </>
  );
}
