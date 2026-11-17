import { z } from "zod";

export const placeTypes = [
  "club",
  "private",
  "museum",
  "service",
  "blog",
  "forum",
  "registry",
  "shop",
  "event",
  "other",
] as const;
const text = z.string().nullish();
export const placeDtoSchema = z.object({
  id: z
    .string()
    .min(1)
    .max(200)
    .refine((id) => id.trim().length > 0),
  type: z.enum(placeTypes).nullish(),
  category: text,
  name: text,
  description: text,
  address: text,
  country: text,
  url: text,
  status: text,
  visibility: z.enum(["public", "hidden", "private"]).nullish(),
  verified: z.boolean().nullish(),
  linkType: text,
  tags: z.array(z.string()).nullish(),
  priority: z.number().int().min(-2147483648).max(2147483647).nullish(),
  lastCheckedAt: z.iso.date().nullish(),
  location: z
    .object({
      mode: z.enum(["exact", "approx", "country-centroid"]),
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
      label: text,
    })
    .nullish(),
  locationSource: text,
  navigationUrl: text,
});
export type PlaceDto = z.infer<typeof placeDtoSchema>;
export type PlaceType = (typeof placeTypes)[number];

/** IDs are allocated by import/snapshot generation, never changed by a client. */
export function parseEntries(payload: unknown): PlaceDto[] {
  const result = z
    .union([z.array(placeDtoSchema), z.object({ entries: z.array(placeDtoSchema) })])
    .safeParse(payload);
  if (!result.success) throw new Error("Invalid places response: malformed entry or location.");
  const entries = Array.isArray(result.data) ? result.data : result.data.entries;
  if (new Set(entries.map((entry) => entry.id)).size !== entries.length) {
    throw new Error("Invalid places response: duplicate IDs.");
  }
  return entries;
}
