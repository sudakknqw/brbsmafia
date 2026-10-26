// Fit an uploaded image to Steam's sizes right in the browser:
// cover/hero/header are center-cropped, the logo is fitted without cropping.

export type ArtKind = "cover" | "hero" | "header" | "logo";

export const ART_SPECS: Record<ArtKind, { label: string; hint: string; w: number; h: number; fit: "crop" | "contain" }> = {
  cover: { label: "Обложка", hint: "вертикальная, 600×900", w: 600, h: 900, fit: "crop" },
  hero: { label: "Арт для шапки", hint: "широкий, 1920×620", w: 1920, h: 620, fit: "crop" },
  // The header is stored at double size (460×215 ×2) so it stays sharp on retina screens.
  header: { label: "Шапка", hint: "горизонтальная, 460×215", w: 920, h: 430, fit: "crop" },
  logo: { label: "Логотип", hint: "PNG с прозрачным фоном", w: 1280, h: 720, fit: "contain" },
};

export const MAX_UPLOAD = 15 * 1024 * 1024;

export async function fitImage(file: File, kind: ArtKind): Promise<{ blob: Blob; ext: string }> {
  const spec = ART_SPECS[kind];
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;

  if (spec.fit === "crop") {
    canvas.width = spec.w;
    canvas.height = spec.h;
    const scale = Math.max(spec.w / bitmap.width, spec.h / bitmap.height);
    const w = bitmap.width * scale;
    const h = bitmap.height * scale;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, (spec.w - w) / 2, (spec.h - h) / 2, w, h);
  } else {
    const scale = Math.min(1, spec.w / bitmap.width, spec.h / bitmap.height);
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  }
  bitmap.close();

  const type = spec.fit === "contain" ? "image/png" : "image/jpeg";
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Не получилось обработать картинку"))), type, 0.88),
  );
  return { blob, ext: type === "image/png" ? "png" : "jpg" };
}

/** Storage path: one folder per game, a timestamped name so the browser doesn't keep a stale cached image. */
export function artPath(gameId: number, kind: ArtKind, ext: string) {
  return `${gameId}/${kind}-${Date.now()}.${ext}`;
}
