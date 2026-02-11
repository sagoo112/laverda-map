/**
 * Raw entry record as stored in your JSON data file.
 *
 * Design goals:
 * - Backwards compatible with your current JSON.
 * - Strict enough for safe app code.
 * - Extensible without breaking older clients.
 */

export type LocationMode = "exact" | "approx" | "country-centroid";

export type Location = {
  mode: LocationMode;
  lat: number;
  lng: number;
  /** Optional human-readable hint shown in UI (e.g. "Switzerland (centroid)") */
  label?: string;
};

/** Normalized, app-facing type used for filtering. */
export type PlaceType = "club" | "private" | "museum" | "service" | "other";

/** Preferred ISO-3166-1 alpha-2 (e.g. "CH"). Use "unknown" if missing. */
export type CountryIso2 = string;

export type Visibility = "public" | "hidden";

/**
 * One data entry in your JSON.
 *
 * Notes:
 * - `type` is the canonical filter field.
 * - `category` is legacy and can remain.
 */
export type Entry = {
  id: string;

  /** Canonical filter category */
  type?: PlaceType;

  /** Legacy category string from source file (optional) */
  category?: string;

  url: string;
  status?: string;

  description?: string;
  country?: CountryIso2;

  visibility?: Visibility;
  verified?: boolean;
  linkType?: string;
  tags?: string[];
  priority?: number;
  lastCheckedAt?: string; // YYYY-MM-DD

  /** Optional geo info; if missing, app can fall back to country centroid. */
  location?: Location;

  /** Optional precomputed navigation target (otherwise derived from lat/lng). */
  navigationUrl?: string;
};

export type PlacesFile = {
  schemaVersion: number;
  generatedAt?: string; // YYYY-MM-DD
  entries: Entry[];
};
