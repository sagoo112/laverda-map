import { Entry, PlaceType } from "../types/entry";
import { countryCentroid } from "./countryCentroids";
import { googleDirectionsUrl } from "./openMaps";

export type MapItem = Entry & {
  // resolved fields for map rendering + filtering
  _lat: number;
  _lng: number;
  _country: string; // ISO2 or "unknown"
  _mode: "exact" | "approx" | "country-centroid";
  _navigationUrl: string;
  _type: PlaceType;
};

const WORLD_FALLBACK = { lat: 20, lng: 0, label: "World (fallback)" } as const;

function normalizeIso2(country?: string) {
  if (!country) return "unknown";
  const c = country.toUpperCase();
  return c === "UNKNOWN" ? "unknown" : c;
}

function inferType(e: Entry): PlaceType {
  if (e.type) return e.type;

  const category = (e.category ?? "").toLowerCase();
  const tags = (e.tags ?? []).map((x) => x.toLowerCase());
  const url = (e.url ?? "").toLowerCase();
  const desc = (e.description ?? "").toLowerCase();

  const hasAny = (...needles: string[]) =>
    needles.some((n) => category.includes(n) || desc.includes(n) || url.includes(n) || tags.includes(n));

  if (hasAny("museum", "museo")) return "museum";
  if (hasAny("service", "werkstatt", "garage", "shop", "dealer", "parts", "spares", "restoration")) return "service";
  if (hasAny("club", "clubs", "forum", "register")) return "club";
  if (hasAny("private", "privat", "owner", "collection", "sammlung")) return "private";

  return "other";
}

function resolveLatLng(e: Entry, countryIso2: string) {
  let mode = (e.location?.mode ?? "country-centroid") as MapItem["_mode"];
  let lat = e.location?.lat;
  let lng = e.location?.lng;
  let label = e.location?.label;

  const missing = typeof lat !== "number" || typeof lng !== "number";
  if (!missing) {
    return { mode, lat, lng, label };
  }

  const cc = countryCentroid(countryIso2);
  if (cc) {
    return { mode: "country-centroid" as const, lat: cc.lat, lng: cc.lng, label: cc.label };
  }

  return {
    mode: "country-centroid" as const,
    lat: WORLD_FALLBACK.lat,
    lng: WORLD_FALLBACK.lng,
    label: WORLD_FALLBACK.label
  };
}

/**
 * Normalize raw entries into a shape that is safe/easy for map rendering.
 *
 * Guarantees:
 * - hidden entries are removed
 * - country is normalized (uppercase ISO2 or "unknown")
 * - lat/lng exist (exact or centroid fallback)
 * - navigation URL exists
 * - type exists (inferred when missing)
 */
export function normalizeForMap(entries: Entry[]): MapItem[] {
  return entries
    .filter((e) => e.visibility !== "hidden")
    .map((e) => {
      const country = normalizeIso2(e.country);
      const { mode, lat, lng, label } = resolveLatLng(e, country);

      const nav = e.navigationUrl ?? googleDirectionsUrl(lat, lng);
      const type = inferType(e);

      return {
        ...e,
        country,
        type,
        location: { mode, lat, lng, label },
        _lat: lat,
        _lng: lng,
        _country: country,
        _mode: mode,
        _navigationUrl: nav,
        _type: type
      };
    });
}
