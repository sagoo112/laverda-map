/**
 * Country centroids used when an entry has no exact coordinates.
 * Keys are ISO-3166-1 alpha-2 (uppercase).
 */

export const COUNTRY_CENTROIDS = {
  CH: { lat: 46.81819, lng: 8.22751, label: "Switzerland (centroid)" },
  DE: { lat: 51.16569, lng: 10.45153, label: "Germany (centroid)" },
  AT: { lat: 47.51623, lng: 14.55007, label: "Austria (centroid)" },
  IT: { lat: 41.87194, lng: 12.56738, label: "Italy (centroid)" },
  FR: { lat: 46.22764, lng: 2.21375, label: "France (centroid)" },
  GB: { lat: 55.37805, lng: -3.43597, label: "United Kingdom (centroid)" },
  NL: { lat: 52.13263, lng: 5.29127, label: "Netherlands (centroid)" },
  DK: { lat: 56.26392, lng: 9.50179, label: "Denmark (centroid)" },
  FI: { lat: 61.92411, lng: 25.74815, label: "Finland (centroid)" },
  SE: { lat: 60.12816, lng: 18.6435, label: "Sweden (centroid)" },
  AU: { lat: -25.2744, lng: 133.7751, label: "Australia (centroid)" },
  CA: { lat: 56.13037, lng: -106.34677, label: "Canada (centroid)" },
  ES: { lat: 40.46367, lng: -3.74922, label: "Spain (centroid)" }
} as const;

export type KnownCountryIso2 = keyof typeof COUNTRY_CENTROIDS;

export function countryCentroid(countryIso2?: string) {
  if (!countryIso2) return null;
  const k = countryIso2.toUpperCase() as KnownCountryIso2;
  return COUNTRY_CENTROIDS[k] ?? null;
}
