import placesJson from "../data/places.json";
import { Entry } from "../types/entry";
import { MapItem, normalizeForMap } from "./normalizeEntries";

function unwrapModulePayload(value: any) {
  if (value && typeof value === "object" && "default" in value) {
    return unwrapModulePayload(value.default);
  }
  return value;
}

function extractEntries(value: any): Entry[] {
  const payload = unwrapModulePayload(value);

  if (Array.isArray(payload)) {
    return payload as Entry[];
  }

  if (payload && typeof payload === "object") {
    if (Array.isArray(payload.entries)) return payload.entries as Entry[];
    if (Array.isArray(payload.places)) return payload.places as Entry[];
    if (Array.isArray(payload.data)) return payload.data as Entry[];
  }

  return [];
}

const entries = extractEntries(placesJson);

export const placesEntries: Entry[] = entries;
export const placesForMap: MapItem[] = normalizeForMap(entries);
