// Collective numerals (Russian "chetvero" rather than "4 people"): that's how friends talk.
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
 * Who exactly: one by name ("Lyosha wants"), two by both names
 * ("Lyosha and Masha want"), three or more as a number ("three want").
 * If it's only you, a second-person verb: "only you want" (you = the second-person form).
 */
export function who(names: string[], one: string, many: string, you: string = one): string {
  if (names.length === 1 && names[0] === "ты") return `${you} только ты`;
  if (names.length === 1) return `${one} ${names[0]}`;
  if (names.length === 2) return `${many} ${names[0]} и ${names[1]}`;
  return `${many} ${people(names.length)}`;
}
