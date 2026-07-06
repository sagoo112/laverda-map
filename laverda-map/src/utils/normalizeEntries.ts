import { CountryIso2, Entry, PlaceType } from "../types/entry";
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

const COUNTRY_ALIASES: Record<string, CountryIso2> = {
  UK: "GB",
  GBR: "GB",
  EN: "GB",
  ENG: "GB",
  ENGLAND: "GB",
  GB: "GB",
  AUS: "AU",
  AUD: "AU",
  AUSTRALIA: "AU",
  USA: "US",
  US: "US",
  STATES: "US",
  UAE: "AE"
};

const COUNTRY_OVERRIDES: Record<string, CountryIso2> = {
  "carbongastank-com-2b8d2a": "DE",
  "alcocknick-wordpress-com-723635": "GB",
  "or600-webspace-rocks-b100d6": "GB"
};

const HOST_SUFFIX_COUNTRY: Record<string, CountryIso2> = {
  ".co.uk": "GB",
  ".org.uk": "GB",
  ".gov.uk": "GB",
  ".com.au": "AU",
  ".org.au": "AU",
  ".net.au": "AU",
  ".co.nz": "NZ",
  ".org.nz": "NZ",
  ".com.br": "BR",
  ".com.ar": "AR",
  ".co.za": "ZA"
};

const TLD_COUNTRY: Record<string, CountryIso2> = {
  ch: "CH",
  de: "DE",
  at: "AT",
  it: "IT",
  fr: "FR",
  uk: "GB",
  gb: "GB",
  nl: "NL",
  dk: "DK",
  fi: "FI",
  se: "SE",
  no: "NO",
  be: "BE",
  au: "AU",
  ca: "CA",
  us: "US",
  es: "ES",
  ie: "IE",
  nz: "NZ",
  br: "BR",
  za: "ZA",
  pt: "PT"
};

function normalizeIso2(country?: string): CountryIso2 | "unknown" {
  if (!country) return "unknown";
  const c = country.trim().toUpperCase();
  if (!c || c === "UNKNOWN") return "unknown";
  if (COUNTRY_ALIASES[c]) return COUNTRY_ALIASES[c];
  if (c.length === 3 && COUNTRY_ALIASES[c]) return COUNTRY_ALIASES[c];
  if (c.length === 3 && COUNTRY_ALIASES[c.slice(0, 2)]) return COUNTRY_ALIASES[c.slice(0, 2)];
  return c as CountryIso2;
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

function guessCountryFromUrl(url?: string): CountryIso2 | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const suffix = Object.keys(HOST_SUFFIX_COUNTRY).find((s) => host.endsWith(s));
    if (suffix) return HOST_SUFFIX_COUNTRY[suffix];

    const parts = host.split(".");
    const tld = parts[parts.length - 1];
    if (tld && TLD_COUNTRY[tld]) return TLD_COUNTRY[tld];
  } catch {
    return null;
  }
  return null;
}

function guessCountryFromName(name?: string | null): CountryIso2 | null {
  if (!name) return null;
  const match = /\(([A-Za-z]{2,3})\)/g;
  let m: RegExpExecArray | null;
  while ((m = match.exec(name))) {
    const token = m[1].toUpperCase();
    if (COUNTRY_ALIASES[token]) return COUNTRY_ALIASES[token];
    if (token.length === 2) return token as CountryIso2;
  }
  return null;
}

function resolveCountry(e: Entry): CountryIso2 | "unknown" {
  const normalized = normalizeIso2(e.country);
  if (normalized !== "unknown") return normalized;

  if (e.id && COUNTRY_OVERRIDES[e.id]) {
    return COUNTRY_OVERRIDES[e.id];
  }

  const fromUrl = guessCountryFromUrl(e.url);
  if (fromUrl) return fromUrl;

  const fromName = guessCountryFromName(e.name ?? e.description ?? e.category);
  if (fromName) return fromName;

  return "unknown";
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
      const country = resolveCountry(e);
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
