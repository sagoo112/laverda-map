/**
 * Legacy "Place" model.
 *
 * Keep this if older UI code still consumes the simpler shape.
 * Newer code should prefer `Entry` + `normalizeForMap()`.
 */

export type PlaceCategory =
  | "garage"
  | "meetup"
  | "history"
  | "scenic"
  | "dealer"
  | "museum"
  | "other";

export type Place = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category: PlaceCategory;
  description?: string;
  address?: string;
  website?: string;
  lastVerified?: string; // YYYY-MM-DD
  images?: string[]; // URLs (optional)
};
