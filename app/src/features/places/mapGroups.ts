import { distanceKm, type MappablePlace } from "./model";

const SHARED_SITE_RADIUS_KM = 0.03;

export function mapCoordinate(place: MappablePlace) {
  return { latitude: place.location.lat, longitude: place.location.lng };
}

export function groupMapPlaces(places: MappablePlace[]): MappablePlace[][] {
  // Keep the representative stable and put clubs first for the marker and chooser.
  const sorted = [...places].sort(
    (a, b) => Number(b.type === "club") - Number(a.type === "club") || a.id.localeCompare(b.id),
  );
  const groups: MappablePlace[][] = [];
  for (const place of sorted) {
    const coordinate = mapCoordinate(place);
    // Check every member so chains of nearby points do not merge distinct sites.
    const group = groups.find((members) =>
      members.every(
        (member) => distanceKm(coordinate, mapCoordinate(member)) <= SHARED_SITE_RADIUS_KM,
      ),
    );
    if (group) group.push(place);
    else groups.push([place]);
  }
  return groups;
}
