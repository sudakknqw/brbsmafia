import { NextResponse, type NextRequest } from "next/server";
import { getViewer } from "@/lib/crew";

type SteamItem = { id: number; name: string; type: string };

// Поиск по магазину Steam. Браузер напрямую туда не пустит, поэтому через нас.
export async function GET(request: NextRequest) {
  const viewer = await getViewer();
  if (!viewer.isMember) return NextResponse.json({ items: [] }, { status: 401 });

  const term = request.nextUrl.searchParams.get("q")?.trim();
  if (!term) return NextResponse.json({ items: [] });

  const url = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(term)}&l=russian&cc=RU`;
  try {
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
