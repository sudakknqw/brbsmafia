import { PageSkeleton } from "@/components/PageSkeleton";
import { SplashLetter } from "@/components/splash/Splash";

export default function Loading() {
  return (
    <>
      {/* First load: the B letter waits for data, then the party flies in. */}
      <div className="splash fixed inset-0 z-[60] flex items-center justify-center bg-ink" aria-label="Загрузка">
        <div className="relative size-0 animate-pulse max-[480px]:scale-[0.8]">
          <SplashLetter />
        </div>
      </div>
      <PageSkeleton />
    </>
  );
}
