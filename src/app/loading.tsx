import { PageSkeleton } from "@/components/PageSkeleton";
import { SplashLetter } from "@/components/splash/Splash";

export default function Loading() {
  return (
    <>
      {/* Первый заход: буква B ждёт данные, потом к ней слетается пати. */}
      <div className="splash fixed inset-0 z-[60] flex items-center justify-center bg-ink" aria-label="Загрузка">
        <div className="relative size-0 animate-pulse">
          <SplashLetter />
        </div>
      </div>
      <PageSkeleton />
    </>
  );
}
