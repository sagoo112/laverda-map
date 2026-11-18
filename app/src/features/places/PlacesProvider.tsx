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
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
const initial: Snapshot = { entries: [], fetchedAt: null };
const queryKey = ["places", TENANT, API_URL] as const;
type PlacesContextValue = {
  places: Place[];
  loading: boolean;
  error: string | null;
  cachedAt: string | null;
  source: "bundled" | "saved" | "live";
  storageError: string | null;
  refresh: () => void;
  favorites: string[];
  toggleFavorite: (id: string) => void;
  favoritesReady: boolean;
};
const PlacesContext = createContext<PlacesContextValue | null>(null);

export function PlacesProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const [ready, setReady] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [favoritesReady, setFavoritesReady] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const writeQueue = useRef(Promise.resolve());
  useEffect(() => {
    let active = true;
    Promise.allSettled([removeLegacyDirectory(AsyncStorage), AsyncStorage.getItem(favoritesKey)])
      .then(([cached, saved]) => {
        if (!active) return;
        if (saved.status === "fulfilled") {
          setFavorites(decodeFavorites(saved.value));
          setFavoritesReady(true);
        }
        if (cached.status === "rejected" || saved.status === "rejected") {
          setStorageError(
            saved.status === "rejected"
              ? "Saved places could not be loaded. Bookmarks are unchanged; try reopening the app."
              : "Old directory data could not be removed. Please clear app storage.",
          );
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
  }, [client]);

  const query = useQuery({
    queryKey,
    initialData: initial,
    initialDataUpdatedAt: 0,
    enabled: ready && !!API_URL,
    staleTime: 5 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    retry: (attempt, error) => attempt < 1 && !(error instanceof ApiError && error.status < 500),
    queryFn: async ({ signal }): Promise<Snapshot> => {
      const entries = parseEntries(
        await requestJson("/api/v1/tenants/" + TENANT + "/places", { signal }),
      ).filter((entry) => entry.visibility === "public");
      const snapshot = { entries, fetchedAt: new Date().toISOString() };
      setLive(true);
      return snapshot;
    },
  });
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
    if (API_URL && ready) void refetch();
  }, [refetch, ready]);
  const places = useMemo(() => normalizePlaces(query.data.entries), [query.data.entries]);
  const value: PlacesContextValue = {
    places,
    loading: query.isFetching,
    error: query.error?.message ?? null,
    cachedAt: query.data.fetchedAt,
    source: live ? "live" : "bundled",
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
