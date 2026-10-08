import { NextResponse, type NextRequest } from "next/server";
import { getViewer } from "@/lib/crew";

type SteamItem = { id: number; name: string; type: string };
type Found = { appid: number; name: string };

// Номер игры или ссылка на её страницу в магазине: 1547000, store.steampowered.com/app/1547000/...
async function byAppId(term: string): Promise<Found[] | null> {
  const id = term.match(/\/app\/(\d+)/)?.[1] ?? term.match(/^\d+$/)?.[0];
  if (!id) return null;
  const res = await fetch(`https://store.steampowered.com/api/appdetails?appids=${id}&filters=basic&cc=US&l=russian`, {
    next: { revalidate: 86400 },
  });
  const data = (await res.json()) as Record<string, { success: boolean; data?: { name: string; steam_appid: number } }>;
  const app = data[id];
  return app?.success && app.data ? [{ appid: app.data.steam_appid, name: app.data.name }] : [];
}

// Поиск по магазину Steam. Браузер напрямую туда не пустит, поэтому через нас.
// Регион — США: в российском Steam часть игр скрыта (например, всё от Rockstar).
export async function GET(request: NextRequest) {
  const viewer = await getViewer();
  if (!viewer.isMember) return NextResponse.json({ items: [] }, { status: 401 });

  const term = request.nextUrl.searchParams.get("q")?.trim();
  if (!term) return NextResponse.json({ items: [] });

  try {
    const exact = await byAppId(term);
    if (exact) return NextResponse.json({ items: exact });

    const url = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(term)}&l=russian&cc=US`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    const data = (await res.json()) as { items?: SteamItem[] };
    const items = (data.items ?? [])
      .filter((i) => i.type === "app")
      .slice(0, 8)
      .map((i) => ({ appid: i.id, name: i.name }));
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: [] }, { status: 502 });
  }
}
