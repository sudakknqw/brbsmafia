import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/ProfileForm";
import { getViewer } from "@/lib/crew";

export default async function OnboardingPage() {
  const { user, profile, isMember } = await getViewer();
  if (!user || !isMember || !profile) redirect("/welcome");
  if (profile.onboarded) redirect("/");

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-8 px-6 py-10">
      <div>
        <p className="text-sm text-dim">Профиль</p>
        <h1 className="mt-1 text-[36px] leading-tight font-extrabold tracking-[-0.04em]">Как тебя видят друзья</h1>
      </div>
      <ProfileForm id={profile.id} name={profile.name} avatarUrl={profile.avatar_url} submitLabel="Продолжить" redirectTo="/" />
    </main>
  );
}
