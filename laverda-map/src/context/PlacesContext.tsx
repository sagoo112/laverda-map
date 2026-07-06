import React, { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Entry } from "../types/entry";
import { MapItem, normalizeForMap } from "../utils/normalizeEntries";
import placesJson from "../data/places.json";

const API_URL = process.env.EXPO_PUBLIC_API_URL;

type PlacesContextValue = {
  entries: Entry[];
  placesForMap: MapItem[];
  loading: boolean;
  error: string | null;
};

const PlacesContext = createContext<PlacesContextValue | null>(null);

function getLocalEntries(): Entry[] {
  const payload: any = placesJson;
  if (Array.isArray(payload)) return payload as Entry[];
  if (Array.isArray(payload?.entries)) return payload.entries as Entry[];
  return [];
}

export function PlacesProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<Entry[]>(() => getLocalEntries());
  const [loading, setLoading] = useState(!!API_URL);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!API_URL) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/places`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json() as { entries: Entry[] };
        if (!cancelled) setEntries(data.entries ?? []);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "fetch failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  const placesForMap = useMemo(() => normalizeForMap(entries), [entries]);

  return (
    <PlacesContext.Provider value={{ entries, placesForMap, loading, error }}>
      {children}
    </PlacesContext.Provider>
  );
}

export function usePlaces(): PlacesContextValue {
  const ctx = useContext(PlacesContext);
  if (!ctx) throw new Error("usePlaces must be used within PlacesProvider");
  return ctx;
}
