import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery } from "@tanstack/react-query";
import bundledDirectory from "../../data/places.json";
import { ApiError, API_URL, requestJson } from "../../shared/api";
import { parseEntries } from "./schema";
import { normalizePlaces, type Place } from "./model";
import {
  decodeFavorites,
  favoritesKey,
  TENANT,
  removeLegacyDirectory,
  type Snapshot,
} from "./cache";
const localPlaces = normalizePlaces(parseEntries(bundledDirectory));
const noPlaces: Place[] = [];
export const placesSourceKey = "laverda:places-source:v1:" + TENANT;
type PlacesSource = "local" | "api";

type PlacesContextValue = {
  places: Place[];
  loading: boolean;
  error: string | null;
  cachedAt: string | null;
  source: PlacesSource;
  sourceReady: boolean;
  setSource: (source: PlacesSource) => void;
  storageError: string | null;
  refresh: () => void;
  favorites: string[];
  toggleFavorite: (id: string) => void;
  favoritesReady: boolean;
};
const PlacesContext = createContext<PlacesContextValue | null>(null);

export function PlacesProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [favoritesReady, setFavoritesReady] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [source, updateSource] = useState<PlacesSource>("local");
  const writeQueue = useRef(Promise.resolve());
  useEffect(() => {
    let active = true;
    Promise.allSettled([
      removeLegacyDirectory(AsyncStorage),
      AsyncStorage.getItem(favoritesKey),
      AsyncStorage.getItem(placesSourceKey),
    ])
      .then(([cached, saved, preference]) => {
        if (!active) return;
        if (saved.status === "fulfilled") {
          setFavorites(decodeFavorites(saved.value));
          setFavoritesReady(true);
        }
        if (preference.status === "fulfilled" && preference.value === "api") updateSource("api");
        if (saved.status === "rejected") {
          setStorageError("Saved places could not be loaded. Try reopening the app.");
        } else if (preference.status === "rejected") {
          setStorageError("Could not restore the data source. Using local places.");
        } else if (cached.status === "rejected") {
          setStorageError("Old directory data could not be removed. Please clear app storage.");
        }
      })
      .catch(() => {
        if (active)
          setStorageError("Device storage is unavailable. Changes may not survive a restart.");
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const query = useQuery({
    queryKey: ["places", TENANT, API_URL, source],
    enabled: ready && source === "api",
    staleTime: 5 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    retry: (attempt, error) => attempt < 1 && !(error instanceof ApiError && error.status < 500),
    queryFn: async ({ signal }): Promise<Snapshot> => {
      const entries = parseEntries(
        await requestJson("/api/v1/public/" + TENANT + "/places", { signal }),
      ).filter((entry) => entry.visibility === "public");
      return { entries, fetchedAt: new Date().toISOString() };
    },
  });
  const setSource = (next: PlacesSource) => {
    if (!ready) return;
    updateSource(next);
    writeQueue.current = writeQueue.current
      .then(() => AsyncStorage.setItem(placesSourceKey, next))
      .catch(() => setStorageError("Could not save the data source on this device."));
  };
  const toggleFavorite = useCallback(
    (id: string) => {
      if (!favoritesReady) return;
      setFavorites((current) =>
        current.includes(id) ? current.filter((saved) => saved !== id) : [...current, id],
      );
    },
    [favoritesReady],
  );
  useEffect(() => {
    if (!favoritesReady) return;
    // Serialize writes so rapid toggles cannot persist an older selection last.
    writeQueue.current = writeQueue.current
      .then(() => AsyncStorage.setItem(favoritesKey, JSON.stringify(favorites)))
      .catch(() => setStorageError("Could not save favourites on this device."));
  }, [favoritesReady, favorites]);
  const { refetch } = query;
  const refresh = useCallback(() => {
    if (ready && source === "api") void refetch();
  }, [refetch, ready, source]);
  const apiPlaces = useMemo(
    () => (query.data ? normalizePlaces(query.data.entries) : noPlaces),
    [query.data],
  );
  let apiError = query.error?.message ?? null;
  if (query.fetchStatus === "paused") {
    apiError = "Connect to the internet or switch to local places in Club settings.";
  } else if (query.error instanceof ApiError && [401, 403, 404].includes(query.error.status)) {
    apiError = "The online directory is unavailable. Switch to local places in Club settings.";
  }
  const value: PlacesContextValue = {
    places: source === "local" ? localPlaces : apiPlaces,
    loading: source === "api" && query.isFetching,
    error: source === "api" ? apiError : null,
    cachedAt: source === "api" ? (query.data?.fetchedAt ?? null) : null,
    source,
    sourceReady: ready,
    setSource,
    storageError,
    refresh,
    favorites,
    toggleFavorite,
    favoritesReady,
  };
  return <PlacesContext.Provider value={value}>{children}</PlacesContext.Provider>;
}
export function usePlaces() {
  const context = useContext(PlacesContext);
  if (!context) throw new Error("usePlaces requires PlacesProvider.");
  return context;
}
