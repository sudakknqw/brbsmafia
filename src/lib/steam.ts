const CDN = "https://shared.steamstatic.com/store_item_assets/steam/apps";

export function steamArt(appid: number) {
  return {
    portrait: `${CDN}/${appid}/library_600x900.jpg`,
    header: `${CDN}/${appid}/header.jpg`,
    hero: `${CDN}/${appid}/library_hero.jpg`,
    logo: `${CDN}/${appid}/logo.png`,
  };
}

/** Цвет плашки для игр без обложки — стабильный по названию. */
const PLATES = ["#3C3489", "#085041", "#712B13", "#0C447C", "#72243E", "#444441", "#633806"];
export function plateColor(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PLATES[h % PLATES.length];
}
