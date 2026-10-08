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


/**
 * Кто именно: один — по нику («Хочет Лёша»), двое — оба ника
 * («Хотят Лёша и Маша»), трое и больше — числом («Хотят трое»).
 * Если это только ты — глагол на «ты»: «Хочешь только ты» (you = «Хочешь»).
 */
export function who(names: string[], one: string, many: string, you: string = one): string {
  if (names.length === 1 && names[0] === "ты") return `${you} только ты`;
  if (names.length === 1) return `${one} ${names[0]}`;
  if (names.length === 2) return `${many} ${names[0]} и ${names[1]}`;
  return `${many} ${people(names.length)}`;
}
