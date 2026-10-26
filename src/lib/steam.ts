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

/** Plate color for games without a cover, stable per name. */
const PLATES = ["#3C3489", "#085041", "#712B13", "#0C447C", "#72243E", "#444441", "#633806"];
export function plateColor(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PLATES[h % PLATES.length];
}

/**
 * Game images in order of preference: custom uploads first, then Steam.
 * Components try the list until one of them loads.
 */
export function gameArt(game: Game) {
  const steam = game.steam_appid ? steamArt(game.steam_appid) : null;
  const list = (...urls: (string | null | undefined)[]) => urls.filter((u): u is string => !!u);
  return {
    portrait: list(game.cover_url, steam?.portrait),
    // The header is the fallback for the portrait cover (shown centered on a blurred background).
    portraitFallback: list(game.header_url, steam?.header),
    hero: list(game.hero_url, steam?.hero),
    // No wide art: a stretched and blurred header instead.
    heroFallback: list(game.header_url, steam?.header),
    header: list(game.header_url, steam?.header, game.hero_url),
    logo: list(game.logo_url, steam?.logo),
  };
}
