/** Placeholder while the server prepares the page, so navigation feels instant. */
export function PageSkeleton({ hero = "tall" }: { hero?: "tall" | "short" }) {
  return (
    <div aria-busy="true" aria-label="Загрузка" className="page-skeleton">
      <div className={`flex flex-col justify-end px-4 pb-10 sm:px-8 ${hero === "tall" ? "min-h-[min(78svh,720px)]" : "min-h-[340px]"}`}>
        <div className="mx-auto w-full max-w-6xl space-y-4">
          <div className="skeleton h-5 w-44 rounded-full" />
          <div className="skeleton h-20 w-72 rounded-2xl" />
          <div className="skeleton h-12 w-52 rounded-full" />
        </div>
      </div>
      <div className="mx-auto flex max-w-6xl gap-3 overflow-hidden px-4 sm:px-8">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="skeleton h-[150px] w-[132px] shrink-0 rounded-2xl sm:w-[148px]" />
        ))}
      </div>
    </div>
  );
}
