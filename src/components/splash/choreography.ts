// Восемь постановок «сбора пати» — своя для каждого числа участников (1–8).
// Каждая отдаёт для каждого аватара кадры движения (смещение от центра,
// масштаб, прозрачность) и задержку старта. Буква B стоит в центре.

export type Frame = { x: number; y: number; s?: number; o?: number; offset?: number };
export type Move = { frames: Frame[]; delay: number; duration: number };

const rad = (deg: number) => (deg * Math.PI) / 180;
const at = (deg: number, r: number) => ({ x: Math.cos(rad(deg)) * r, y: Math.sin(rad(deg)) * r });

/** Точки правильного многоугольника вокруг центра, первая — сверху. */
function ring(n: number, r: number, start = -90) {
  return Array.from({ length: n }, (_, i) => ({ deg: start + (360 / n) * i, ...at(start + (360 / n) * i, r) }));
}

/** Путь по дуге: от угла a до угла b, с радиусом r0 → r1. */
function arc(a: number, b: number, r0: number, r1: number, steps = 8): Frame[] {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    const p = at(a + (b - a) * t, r0 + (r1 - r0) * t);
    return { ...p, o: Math.min(1, t * 3), offset: t };
  });
}

const FAR = 280;

const plays: Record<number, () => Move[]> = {
  // 1. Соло: падает сверху, отскакивает и встаёт рядом с B.
  1: () => [
    {
      delay: 0,
      duration: 900,
      frames: [
        { x: 70, y: -FAR, o: 0 },
        { x: 70, y: 10, s: 1.08, o: 1, offset: 0.62 },
        { x: 70, y: -6, offset: 0.8 },
        { x: 70, y: 0, s: 1 },
      ],
    },
  ],

  // 2. Дуэт: летят навстречу с двух сторон, проскакивают и встают по бокам.
  2: () =>
    [-1, 1].map((side, i) => ({
      delay: i * 40,
      duration: 850,
      frames: [
        { x: side * FAR, y: 0, o: 0 },
        { x: side * 48, y: 0, o: 1, offset: 0.7 },
        { x: side * 72, y: 0 },
      ],
    })),

  // 3. Тройка: закручиваются по спирали в треугольник.
  3: () =>
    ring(3, 72).map((p, i) => ({
      delay: i * 90,
      duration: 950,
      frames: arc(p.deg - 200, p.deg, FAR, 72, 10),
    })),

  // 4. Квадрат: заходят по диагоналям из углов экрана одновременно.
  4: () =>
    ring(4, 76, -135).map((p, i) => ({
      delay: i * 30,
      duration: 800,
      frames: [
        { ...at(p.deg, FAR), s: 0.7, o: 0 },
        { ...at(p.deg, 64), s: 1.06, o: 1, offset: 0.75 },
        { x: p.x, y: p.y, s: 1 },
      ],
    })),

  // 5. Стрелка часов: по одному появляются на своих местах по часовой.
  5: () =>
    ring(5, 76).map((p, i) => ({
      delay: i * 130,
      duration: 520,
      frames: [
        { x: p.x * 0.4, y: p.y * 0.4, s: 0, o: 0 },
        { x: p.x * 1.12, y: p.y * 1.12, s: 1.15, o: 1, offset: 0.65 },
        { x: p.x, y: p.y, s: 1 },
      ],
    })),

  // 6. Две волны: трое прилетают снаружи, трое вырастают изнутри из буквы.
  6: () =>
    ring(6, 80).map((p, i) =>
      i % 2 === 0
        ? {
            delay: 0,
            duration: 750,
            frames: [{ ...at(p.deg, FAR), o: 0 }, { ...at(p.deg, 70), o: 1, offset: 0.75 }, { x: p.x, y: p.y }],
          }
        : {
            delay: 380,
            duration: 600,
            frames: [{ x: 0, y: 0, s: 0.2, o: 0 }, { ...at(p.deg, 92), s: 1.1, o: 1, offset: 0.7 }, { x: p.x, y: p.y, s: 1 }],
          },
    ),

  // 7. Корона: поднимаются снизу и встают дугой над буквой, от центра к краям.
  7: () =>
    Array.from({ length: 7 }, (_, i) => {
      const deg = -90 + (i - 3) * 28;
      const p = at(deg, 102);
      return {
        delay: Math.abs(i - 3) * 90,
        duration: 800,
        frames: [
          { x: p.x, y: FAR, o: 0 },
          { x: p.x, y: p.y - 10, o: 1, offset: 0.72 },
          { x: p.x, y: p.y },
        ],
      };
    }),

  // 8. Орбита: друг за другом влетают сверху и облетают круг до своего места.
  8: () =>
    ring(8, 84).map((p, i) => ({
      delay: i * 70,
      duration: 1000,
      // Чем дальше место по кругу, тем длиннее облёт — хвост растягивается кольцом.
      frames: arc(-210, p.deg, FAR, 84, 14),
    })),
};

// Постановки задуманы в «базовых» единицах; на экране всё крупнее и чуть медленнее.
export const SIZE = 1.45; // размах: расстояния от буквы
export const TEMPO = 1.25; // темп: во сколько раз дольше базового

export function choreography(count: number): Move[] {
  const n = Math.max(1, Math.min(8, count));
  return plays[n]().map((m) => ({
    delay: m.delay * TEMPO,
    duration: m.duration * TEMPO,
    frames: m.frames.map((f) => ({ ...f, x: f.x * SIZE, y: f.y * SIZE })),
  }));
}

/** Сколько длится выход всех участников (без финала). */
export function entranceLength(moves: Move[]) {
  return Math.max(...moves.map((m) => m.delay + m.duration));
}
