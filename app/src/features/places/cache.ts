import { z } from "zod";
import { parseEntries, type PlaceDto } from "./schema";

export const TENANT = "laverda";
export type Snapshot = { entries: PlaceDto[]; fetchedAt: string | null };
export const cacheKey = (apiUrl: string | null) =>
  "laverda:places:v1:" + TENANT + ":" + (apiUrl ?? "bundled");
export const favoritesKey = "laverda:favorites:v1:" + TENANT;
const envelope = z.object({
  version: z.literal(1),
  tenant: z.literal(TENANT),
  fetchedAt: z.iso.datetime(),
  entries: z.array(z.unknown()),
});
export function decodeCache(raw: string | null): Snapshot | null {
  if (!raw) return null;
  try {
    const value = envelope.parse(JSON.parse(raw));
    const entries = parseEntries(value).filter((entry) => entry.visibility === "public");
    return { entries, fetchedAt: value.fetchedAt };
  } catch {
    return null;
  }
}
export function encodeCache(snapshot: Snapshot): string {
  return JSON.stringify({
    version: 1,
    tenant: TENANT,
    ...snapshot,
    entries: snapshot.entries.filter((entry) => entry.visibility === "public"),
  });
}
export function decodeFavorites(raw: string | null): string[] {
  try {
    return [...new Set(z.array(z.string().min(1).max(200)).parse(JSON.parse(raw ?? "[]")))];
  } catch {
    return [];
  }
}
