import type { PlaceDto, PlaceType } from "./schema";
import { googleDirectionsUrl, webUrl } from "../../shared/urls";

export type Place = Omit<
  PlaceDto,
  "type" | "name" | "country" | "url" | "navigationUrl" | "tags"
> & {
  type: PlaceType;
  name: string;
  country: string;
  url: string | null;
  navigationUrl: string | null;
  tags: string[];
};
const aliases: Record<string, PlaceType> = {
  club: "club",
  clubs: "club",
  "club - forum": "club",
  "club - register": "club",
  workshop: "service",
  service: "service",
  garage: "service",
  shop: "shop",
  dealer: "shop",
  "shop - service": "shop",
  museum: "museum",
  private: "private",
  blog: "blog",
  media: "blog",
  forum: "forum",
  "forum - registry": "forum",
  registry: "registry",
  "owners registry": "registry",
  event: "event",
  meetup: "event",
};
export function normalizePlaces(entries: PlaceDto[]): Place[] {
  return entries
    .filter((entry) => entry.visibility === "public")
    .map((entry) => {
      const type = entry.type ?? aliases[entry.category?.trim().toLowerCase() ?? ""] ?? "other";
      const country = entry.country?.trim().toUpperCase() || "unknown";
      const place: Place = {
        ...entry,
        type,
        name: entry.name || entry.description || "Laverda resource",
        country: country === "UK" ? "GB" : country === "UNKNOWN" ? "unknown" : country,
        url: webUrl(entry.url),
        tags: entry.tags ?? [],
        navigationUrl: null,
      };
      if (isMappable(place)) {
        place.navigationUrl =
          webUrl(entry.navigationUrl) ??
          googleDirectionsUrl(place.location.lat, place.location.lng);
      }
      return place;
    });
}
export type MappablePlace = Place & { location: NonNullable<PlaceDto["location"]> };
export function isOnlineResource(place: Place): boolean {
  return ["blog", "forum", "registry"].includes(place.type);
}
export function isMappable(place: Place): place is MappablePlace {
  return !isOnlineResource(place) && !!place.location && place.location.mode !== "country-centroid";
}
let regionNames: Intl.DisplayNames | undefined;
// Keep every seeded country readable on Hermes builds without Intl.DisplayNames.
// Unknown future codes still work and use platform names where available.
const countryFallback: Readonly<Record<string, string>> = {
  AT: "Austria",
  AU: "Australia",
  CA: "Canada",
  CH: "Switzerland",
  DE: "Germany",
  DK: "Denmark",
  ES: "Spain",
  FI: "Finland",
  FR: "France",
  GB: "United Kingdom",
  IT: "Italy",
  NL: "Netherlands",
  SE: "Sweden",
};
export function countryName(code: string): string {
  if (code === "unknown") return "Location not specified";
  if (typeof countryFallback[code] === "string") return countryFallback[code];
  try {
    regionNames ??= new Intl.DisplayNames(["en"], { type: "region" });
    return regionNames.of(code) ?? code;
  } catch {
    // Some older native Intl implementations lack region names.
    return code;
  }
}
export function locationLabel(place: Place): string {
  if (isOnlineResource(place)) return "Online resource";
  if (
    place.country === "unknown" &&
    (!place.location || place.location.mode === "country-centroid")
  )
    return "Location not specified";
  if (!place.location || place.location.mode === "country-centroid")
    return "Country only · " + countryName(place.country);
  return place.location.mode === "approx" ? "Approximate location" : countryName(place.country);
}
function searchText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ß/g, "ss")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}
export function filterPlaces(
  places: Place[],
  query: string,
  category: string,
  savedIds?: readonly string[],
): Place[] {
  const terms = searchText(query).split(/\s+/).filter(Boolean);
  return places.filter((place) => {
    if (
      (category !== "all" && place.type !== category) ||
      (savedIds && !savedIds.includes(place.id))
    )
      return false;
    if (!terms.length) return true;
    const haystack = searchText(
      [
        place.name,
        place.description,
        place.address,
        place.country,
        countryName(place.country),
        place.type,
        place.category,
        place.url,
        ...place.tags,
      ]
        .filter(Boolean)
        .join(" "),
    );
    return terms.every((term) => haystack.includes(term));
  });
}
export type Coordinates = { latitude: number; longitude: number };
export function distanceKm(from: Coordinates, to: Coordinates): number {
  const rad = (value: number) => (value * Math.PI) / 180;
  const a =
    Math.sin(rad(to.latitude - from.latitude) / 2) ** 2 +
    Math.cos(rad(from.latitude)) *
      Math.cos(rad(to.latitude)) *
      Math.sin(rad(to.longitude - from.longitude) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(Math.min(1, a)), Math.sqrt(Math.max(0, 1 - a)));
}
export function sortPlaces(places: Place[], origin?: Coordinates | null): Place[] {
  return [...places].sort((a, b) => {
    if (origin) {
      const distance = (p: Place) =>
        isMappable(p)
          ? distanceKm(origin, { latitude: p.location.lat, longitude: p.location.lng })
          : Infinity;
      const delta = distance(a) - distance(b);
      if (delta && Number.isFinite(delta)) return delta;
      if (isMappable(a) !== isMappable(b)) return isMappable(a) ? -1 : 1;
    }
    return (
      (b.priority ?? 0) - (a.priority ?? 0) ||
      a.name.localeCompare(b.name, "en") ||
      a.id.localeCompare(b.id, "en")
    );
  });
}
