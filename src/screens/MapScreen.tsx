import React, { useMemo, useState } from "react";
import { View, StyleSheet, Platform, Modal, Pressable, Text, FlatList } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE, Region } from "react-native-maps";

import { PlacesFile, PlaceType } from "../types/entry";
import { normalizeForMap, MapItem } from "../utils/normalizeEntries";
import { FiltersPanel } from "../components/FiltersPanel";
import PlaceBottomSheet from "../components/PlaceBottomSheet";

import placesRaw from "../data/places.json";

const file = placesRaw as PlacesFile;

const initialRegion: Region = {
  latitude: 20,
  longitude: 0,
  latitudeDelta: 120,
  longitudeDelta: 120
};

function displayTitle(e: MapItem) {
  const s = (e.description?.trim() ?? "");
  return s.length > 0 ? s : e.url;
}

// Optional: wenn du extrem lange Titel hast, hier minimal kürzen (ohne Ellipsis im UI)
// function displayTitle(e: MapItem) {
//   const s = (e.description?.trim() ?? "");
//   const raw = s.length > 0 ? s : e.url;
//   return raw.replace(/^https?:\/\//, "").replace(/^www\./, "");
// }

function typeColor(t: PlaceType, mode: string) {
  if (mode === "country-centroid") return "#8a8a8a";
  switch (t) {
    case "club": return "#111";
    case "museum": return "#a33";
    case "service": return "#0a66ff";
    case "private": return "#0b8a5a";
    default: return "#666";
  }
}

function MarkerView(props: { title: string; color: string; compact?: boolean }) {
  return (
    <View style={styles.markerWrap} pointerEvents="none">
      <View style={[styles.markerLabel, props.compact && styles.markerLabelCompact]}>
        {/* WICHTIG: kein numberOfLines -> kein Ellipsis; dafür maxWidth + wrapping */}
        <Text style={styles.markerLabelText}>{props.title}</Text>
      </View>

      <View style={[styles.pinCircle, { borderColor: props.color }]} />
      <View style={[styles.pinCircleInner, { backgroundColor: props.color }]} />
      <View style={[styles.pinStem, { backgroundColor: props.color }]} />
      <View style={[styles.pinTip, { borderTopColor: props.color }]} />
    </View>
  );
}

export default function MapScreen() {
  const items = useMemo(() => normalizeForMap(file.entries), []);

  const [filtersOpen, setFiltersOpen] = useState(false);

  const [country, setCountry] = useState("all");
  const [type, setType] = useState<PlaceType | "all">("all");
  const [tag, setTag] = useState("all");
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  // centroid-group selection modal
  const [centroidListOpen, setCentroidListOpen] = useState(false);
  const [centroidItems, setCentroidItems] = useState<MapItem[]>([]);
  const [centroidTitle, setCentroidTitle] = useState("");

  // bottom sheet
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedItem = useMemo(() => {
    if (!selectedId) return null;
    return items.find((x) => x.id === selectedId) ?? null;
  }, [items, selectedId]);

  const countries = useMemo(() => {
    return Array.from(new Set(items.map((i) => i._country)))
      .filter((c) => c !== "unknown")
      .sort();
  }, [items]);

  const tags = useMemo(() => {
    const s = new Set<string>();
    items.forEach((i) => (i.tags ?? []).forEach((t) => s.add(t)));
    return Array.from(s).sort();
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter((i) => {
      if (verifiedOnly && !i.verified) return false;
      if (country !== "all" && i._country !== country) return false;
      if (type !== "all" && i._type !== type) return false;
      if (tag !== "all" && !(i.tags ?? []).includes(tag)) return false;
      return true;
    });
  }, [items, verifiedOnly, country, type, tag]);

  const { exactMarkers, centroidGroups } = useMemo(() => {
    const exact: MapItem[] = [];
    const groups = new Map<string, { key: string; lat: number; lng: number; country: string; items: MapItem[] }>();

    for (const e of filtered) {
      if (e._mode === "country-centroid") {
        const k = `${e._country}:${e._lat.toFixed(5)},${e._lng.toFixed(5)}`;
        const g = groups.get(k) ?? { key: k, lat: e._lat, lng: e._lng, country: e._country, items: [] };
        g.items.push(e);
        groups.set(k, g);
      } else {
        exact.push(e);
      }
    }
    return { exactMarkers: exact, centroidGroups: Array.from(groups.values()) };
  }, [filtered]);

  function openCentroidGroup(group: { country: string; items: MapItem[] }) {
    const sorted = [...group.items].sort((a, b) => displayTitle(a).localeCompare(displayTitle(b)));
    setCentroidItems(sorted);
    setCentroidTitle(`${group.country} (${group.items.length})`);
    setCentroidListOpen(true);
  }

  function openSheet(placeId: string) {
    setSelectedId(placeId);
    setSheetOpen(true);
  }

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={initialRegion}
        provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
      >
        {exactMarkers.map((e) => {
          const title = displayTitle(e);
          const color = typeColor(e._type, e._mode);
          return (
            <Marker
              key={e.id}
              coordinate={{ latitude: e._lat, longitude: e._lng }}
              anchor={{ x: 0.5, y: 1 }}              // wichtig: label geht nach oben
              tracksViewChanges={false}               // performance + stabileres rendering
              onPress={() => openSheet(e.id)}
            >
              <MarkerView title={title} color={color} />
            </Marker>
          );
        })}

        {centroidGroups.map((g) => {
          const title = g.items.length === 1 ? displayTitle(g.items[0]) : `${g.country} (${g.items.length})`;
          return (
            <Marker
              key={g.key}
              coordinate={{ latitude: g.lat, longitude: g.lng }}
              anchor={{ x: 0.5, y: 1 }}
              tracksViewChanges={false}
              onPress={() => {
                if (g.items.length === 1) openSheet(g.items[0].id);
                else openCentroidGroup({ country: g.country, items: g.items });
              }}
            >
              <MarkerView title={title} color={"#8a8a8a"} compact={g.items.length > 1} />
            </Marker>
          );
        })}
      </MapView>

      {/* Filter button */}
      <Pressable style={styles.filterButton} onPress={() => setFiltersOpen((x) => !x)}>
        <Text style={styles.filterButtonText}>Filter</Text>
      </Pressable>

      {/* Filters modal */}
      <Modal visible={filtersOpen} transparent animationType="fade" onRequestClose={() => setFiltersOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setFiltersOpen(false)} />
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Filters</Text>
          <FiltersPanel
            countries={countries}
            tags={tags}
            country={country}
            type={type}
            tag={tag}
            verifiedOnly={verifiedOnly}
            setCountry={setCountry}
            setType={setType}
            setTag={setTag}
            setVerifiedOnly={setVerifiedOnly}
          />
        </View>
      </Modal>

      {/* Centroid picker modal */}
      <Modal visible={centroidListOpen} transparent animationType="fade" onRequestClose={() => setCentroidListOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setCentroidListOpen(false)} />
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>{centroidTitle}</Text>

          <FlatList
            data={centroidItems}
            keyExtractor={(x) => x.id}
            ItemSeparatorComponent={() => <View style={styles.sep} />}
            renderItem={({ item }) => (
              <Pressable
                style={styles.listRow}
                onPress={() => {
                  setCentroidListOpen(false);
                  openSheet(item.id);
                }}
              >
                <Text style={styles.listTitle}>{displayTitle(item)}</Text>
                <Text style={styles.listMeta}>
                  {item._type} • {item._country}
                </Text>
              </Pressable>
            )}
          />
        </View>
      </Modal>

      {/* Bottom sheet */}
      <PlaceBottomSheet visible={sheetOpen} item={selectedItem} onClose={() => setSheetOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },

  filterButton: {
    position: "absolute",
    right: 14,
    top: 14,
    backgroundColor: "#111",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4
  },
  filterButtonText: { color: "white", fontWeight: "900", fontSize: 12 },

  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.35)" },
  panel: {
    position: "absolute",
    top: 60,
    left: 12,
    right: 12,
    maxHeight: "78%",
    backgroundColor: "white",
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: "#ddd",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6
  },
  panelTitle: { fontSize: 14, fontWeight: "900", marginBottom: 10 },

  sep: { height: 1, backgroundColor: "#eee" },
  listRow: { paddingVertical: 10 },
  listTitle: { fontWeight: "900", fontSize: 14, lineHeight: 18 },
  listMeta: { color: "#666", marginTop: 2, fontSize: 12 },

  // Marker (key: overflow visible + wrapping)
  markerWrap: {
    alignItems: "center",
    overflow: "visible" // critical
  },
  markerLabel: {
    overflow: "visible",
    backgroundColor: "rgba(255,255,255,0.97)",
    borderRadius: 14,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#ddd",
    marginBottom: 6,

    // bigger, so long titles wrap instead of being cut
    maxWidth: 260,

    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3
  },
  markerLabelCompact: { maxWidth: 220 },
  markerLabelText: {
    fontSize: 12,
    fontWeight: "900",
    lineHeight: 16,

    // allow wrapping
    flexShrink: 1
  },

  pinCircle: { width: 18, height: 18, borderRadius: 999, borderWidth: 2, backgroundColor: "white" },
  pinCircleInner: { position: "absolute", top: 4, width: 10, height: 10, borderRadius: 999 },
  pinStem: { width: 3, height: 11, marginTop: -1, borderRadius: 2 },
  pinTip: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 10,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "#111",
    marginTop: -1
  }
});
