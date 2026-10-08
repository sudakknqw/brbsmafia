import type { ReactNode } from "react";

/** При наведении (или фокусе) показывает ники всех, о ком речь. */
export function NamesHint({ names, children, className = "" }: { names: string[]; children: ReactNode; className?: string }) {
  if (!names.length) return <>{children}</>;
  return (
    <span tabIndex={0} className={`group/names relative inline-flex items-center outline-none ${className}`}>
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-0 z-30 mb-2 w-max max-w-[260px] translate-y-1 rounded-xl border border-line bg-[#1a1a1f]/95 px-3 py-2 text-[13px] leading-snug text-fg opacity-0 shadow-[0_12px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl transition duration-150 group-hover/names:translate-y-0 group-hover/names:opacity-100 group-focus-visible/names:translate-y-0 group-focus-visible/names:opacity-100"
      >
        {names.join(", ")}
      </span>
    </span>
  );
}
