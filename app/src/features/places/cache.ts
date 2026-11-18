import { z } from "zod";
import type { PlaceDto } from "./schema";
export const TENANT = "laverda";
export type Snapshot = { entries: PlaceDto[]; fetchedAt: string | null };
// Only used to locate and remove caches written by older app versions.
export const cacheKey = (apiUrl: string | null) =>
  "laverda:places:v1:" + TENANT + ":" + (apiUrl ?? "bundled");
export const favoritesKey = "laverda:favorites:v1:" + TENANT;
export async function removeLegacyDirectory(storage: {
  getAllKeys: () => Promise<readonly string[]>;
  multiRemove: (keys: string[]) => Promise<void>;
}) {
  const keys = (await storage.getAllKeys()).filter((key) => key.startsWith("laverda:places:"));
  if (keys.length) await storage.multiRemove(keys);
}
export function decodeFavorites(raw: string | null): string[] {
  if (raw && raw.length > 1000000) return [];
  try {
    return [
      ...new Set(
        z
          .array(z.string().min(1).max(200))
          .max(10000)
          .parse(JSON.parse(raw ?? "[]")),
      ),
    ];
  } catch {
    return [];
  }
}
