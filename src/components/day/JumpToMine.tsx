"use client";

/** Кнопка в шапке дня: прокручивает к своей строке на шкале. */
export function JumpToMine({ marked }: { marked: boolean }) {
  return (
    <button
      onClick={() => document.getElementById("my-row")?.scrollIntoView({ block: "center", behavior: "smooth" })}
      className="rounded-full bg-fg px-6 py-3 text-[16px] font-semibold text-ink transition hover:scale-[1.03] active:scale-[0.97]"
    >
      {marked ? "Изменить доступное время" : "Отметить доступное время"}
    </button>
  );
}
