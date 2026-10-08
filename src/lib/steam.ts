import type { Game } from "./types";

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

/**
 * Картинки игры по порядку предпочтения: свои загруженные, потом Steam.
 * Компоненты перебирают список, пока какая-нибудь не загрузится.
 */
export function gameArt(game: Game) {
  const steam = game.steam_appid ? steamArt(game.steam_appid) : null;
  const list = (...urls: (string | null | undefined)[]) => urls.filter((u): u is string => !!u);
  return {
    portrait: list(game.cover_url, steam?.portrait),
    // Шапка — запасной вариант для вертикальной обложки (покажется по центру на размытом фоне).
    portraitFallback: list(game.header_url, steam?.header),
    hero: list(game.hero_url, steam?.hero),
    // Если широкого арта нет — растянутая и размытая шапка.
    heroFallback: list(game.header_url, steam?.header),
    header: list(game.header_url, steam?.header, game.hero_url),
    logo: list(game.logo_url, steam?.logo),
  };
}
