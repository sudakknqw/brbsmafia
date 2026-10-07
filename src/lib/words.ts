// Собирательные числительные: «четверо», а не «4 человека» — так говорят друзья.
const COLLECTIVE = ["никто", "один", "двое", "трое", "четверо", "пятеро", "шестеро", "семеро", "восьмеро", "девятеро", "десятеро"];

export function people(n: number): string {
  return COLLECTIVE[n] ?? `${n} человек`;
}

export function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

const GENITIVE = ["нуля", "одного", "двух", "трёх", "четырёх", "пяти", "шести", "семи", "восьми", "девяти", "десяти"];

/** «из восьми» */
export function ofTotal(n: number): string {
  return `из ${GENITIVE[n] ?? n}`;
}
