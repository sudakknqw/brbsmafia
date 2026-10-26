// Each person's own color, for timeline bars and avatars without a picture.
const COLORS = ["#0a84ff", "#30d158", "#ff375f", "#ff9f0a", "#bf5af2", "#64d2ff", "#ffd60a", "#ac8e68", "#5e5ce6"];

export function memberColor(id: string): string {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return COLORS[h % COLORS.length];
}
