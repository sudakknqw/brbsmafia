import { Header } from "@/components/Header";
import { ProfileForm } from "@/components/ProfileForm";
import { signOut } from "@/app/actions";
import { requireMember } from "@/lib/crew";

export default async function ProfilePage() {
  const { profile: me } = await requireMember();

  return (
    <main className="mx-auto max-w-md px-4 pb-16 sm:px-6">
      <Header me={me} back />
      <h1 className="mb-6 text-[34px] font-bold tracking-tight">Профиль</h1>
      <ProfileForm id={me.id} name={me.name} avatarUrl={me.avatar_url} submitLabel="Сохранить" />
      <form action={signOut} className="mt-10">
        <button className="w-full rounded-2xl bg-card py-3.5 text-[16px] text-bad">Выйти</button>
      </form>
    </main>
  );
}
