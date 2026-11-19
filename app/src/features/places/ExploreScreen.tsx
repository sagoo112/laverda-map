import React, { useCallback, useMemo, useState } from "react";
import { FlatList, Keyboard, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { usePlaces } from "./PlacesProvider";
import { filterPlaces, isMappable, sortPlaces, distanceKm } from "./model";
import { categories } from "./categories";
import CategoryFilter from "./CategoryFilter";
import PlacesMap, { MAP_AVAILABLE } from "./PlacesMap";
import PlaceCard from "./PlaceCard";
import PlaceDetailsSheet from "./PlaceDetailsSheet";
import PlaceGroupSheet from "./PlaceGroupSheet";
import PlacesStatus from "./PlacesStatus";
import { useNearby } from "./useNearby";
import { EmptyState, Icon, IconButton, SearchField, TextAction } from "../../shared/ui";
import { colors, radius, space, ui } from "../../shared/theme";

export default function ExploreScreen() {
  const { places, favorites, loading, refresh } = usePlaces();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<"map" | "list">(MAP_AVAILABLE ? "map" : "list");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [savedOnly, setSavedOnly] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [fitRevision, setFitRevision] = useState(0);
  const nearby = useNearby();
  const directory = useMemo(
    () => places.filter((place) => savedOnly || place.type !== "blog"),
    [places, savedOnly],
  );
  const types = useMemo(
    () =>
      [...new Set(directory.map((place) => place.type))].sort((a, b) =>
        categories[a].label.localeCompare(categories[b].label),
      ),
    [directory],
  );
  const activeCategory = types.some((type) => type === category) ? category : "all";
  const results = useMemo(
    () =>
      sortPlaces(
        filterPlaces(directory, query, activeCategory, savedOnly ? favorites : undefined),
        nearby.origin,
      ),
    [directory, query, activeCategory, savedOnly, favorites, nearby.origin],
  );
  const pins = useMemo(() => results.filter(isMappable), [results]);
  const selectedPlaces = selectedIds.flatMap(
    (id) => results.find((place) => place.id === id) ?? [],
  );
  const close = useCallback(() => setSelectedIds([]), []);
  useFocusEffect(useCallback(() => close, [close]));
  const filtered = !!query || activeCategory !== "all" || savedOnly;
  const clearFilters = () => {
    setQuery("");
    setCategory("all");
    setSavedOnly(false);
    close();
    Keyboard.dismiss();
  };
  const showList = () => {
    setMode("list");
    close();
    Keyboard.dismiss();
  };
  const empty = (
    <EmptyState
      title={savedOnly ? "No saved matches" : "No places found"}
      body={
        savedOnly
          ? "Bookmark a place to keep it here. Your search and filters also apply to saved places."
          : "Try a different name, country or category."
      }
      action={filtered ? { title: "Clear filters", onPress: clearFilters } : undefined}
    />
  );

  return (
    <View style={ui.screen}>
      <View style={[styles.header, { paddingTop: insets.top + space.md }]}>
        <View style={styles.topRow}>
          <Text accessibilityRole="header" testID="explore-heading" style={[ui.title, { flex: 1 }]}>
            Explore
          </Text>
          <View style={styles.switcher}>
            {(["map", "list"] as const).map((value) => (
              <Pressable
                key={value}
                onPress={() => {
                  setMode(value);
                  close();
                  Keyboard.dismiss();
                }}
                testID={"view-" + value}
                accessibilityRole="button"
                accessibilityLabel={value === "map" ? "Map view" : "List view"}
                accessibilityState={{ selected: mode === value }}
                style={({ pressed }) => [
                  styles.switch,
                  mode === value && styles.selectedSwitch,
                  pressed && { opacity: 0.65 },
                ]}
              >
                <Icon
                  name={value === "map" ? "map-outline" : "format-list-bulleted"}
                  color={mode === value ? colors.ink : colors.muted}
                  size={21}
                />
              </Pressable>
            ))}
          </View>
        </View>
        <SearchField
          value={query}
          onChangeText={(value) => {
            setQuery(value);
            close();
          }}
          label="Search places"
          placeholder="Search places or countries"
          testID="place-search"
        />
        <CategoryFilter
          types={types}
          selected={activeCategory}
          onSelect={(value) => {
            setCategory(value);
            close();
          }}
          leading={
            <View style={styles.savedWrap}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Saved places"
                accessibilityState={{ selected: savedOnly }}
                testID="saved-filter"
                onPress={() => {
                  setSavedOnly(!savedOnly);
                  close();
                }}
                style={({ pressed }) => [
                  styles.saved,
                  savedOnly && { backgroundColor: colors.accentSoft },
                  pressed && { opacity: 0.65 },
                ]}
              >
                <Icon
                  name={savedOnly ? "bookmark" : "bookmark-outline"}
                  size={18}
                  color={savedOnly ? colors.accent : colors.muted}
                />
                <Text style={[styles.filterText, savedOnly && { color: colors.accent }]}>
                  Saved
                </Text>
              </Pressable>
            </View>
          }
        />
        <View style={styles.topRow}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text accessibilityLiveRegion="polite" style={ui.caption}>
              {results.length} {results.length === 1 ? "place" : "places"}
              {mode === "map" && MAP_AVAILABLE ? " · " + pins.length + " on map" : ""}
            </Text>
            <PlacesStatus compact />
          </View>
          <TextAction
            title={nearby.origin ? "Clear distance" : "Near me"}
            icon={nearby.origin ? "close" : "crosshairs-gps"}
            busy={nearby.busy}
            selected={!!nearby.origin}
            onPress={() => {
              Keyboard.dismiss();
              if (nearby.origin) nearby.clear();
              else {
                showList();
                void nearby.locate();
              }
            }}
          />
        </View>
      </View>
      <View style={styles.body}>
        {mode === "map" ? (
          <>
            <PlacesMap
              places={pins}
              fitRevision={fitRevision}
              onShowList={showList}
              onSelect={(ids) => {
                setSelectedIds(ids);
                Keyboard.dismiss();
              }}
            />
            {MAP_AVAILABLE && results.length === 0 && <View style={styles.mapNotice}>{empty}</View>}
            {MAP_AVAILABLE && results.length > pins.length && (
              <Pressable
                style={styles.mapNotice}
                onPress={showList}
                accessibilityRole="button"
                accessibilityLabel="View entries without map locations"
              >
                <View style={styles.mapHint}>
                  <Text style={[ui.caption, { flex: 1 }]}>
                    {results.length - pins.length} more{" "}
                    {results.length - pins.length === 1 ? "entry" : "entries"} in List
                  </Text>
                  <Icon name="arrow-right" size={18} />
                </View>
              </Pressable>
            )}
            {MAP_AVAILABLE && pins.length > 0 && (
              <View style={styles.fit}>
                <IconButton
                  label="Show results on map"
                  icon="fit-to-screen-outline"
                  onPress={() => {
                    Keyboard.dismiss();
                    setFitRevision((value) => value + 1);
                  }}
                />
              </View>
            )}
          </>
        ) : (
          <FlatList
            data={results}
            keyExtractor={(place) => place.id}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            refreshing={loading}
            onRefresh={refresh}
            contentContainerStyle={styles.list}
            ListHeaderComponent={
              nearby.origin ? (
                <Text style={ui.caption}>
                  Nearest first · straight-line distances, not riding routes.
                </Text>
              ) : null
            }
            renderItem={({ item }) => (
              <PlaceCard
                place={item}
                onPress={() => {
                  Keyboard.dismiss();
                  setSelectedIds([item.id]);
                }}
                distance={
                  nearby.origin && isMappable(item)
                    ? distanceKm(nearby.origin, {
                        latitude: item.location.lat,
                        longitude: item.location.lng,
                      })
                    : undefined
                }
              />
            )}
            ListEmptyComponent={empty}
          />
        )}
      </View>
      {selectedPlaces.length > 1 ? (
        <PlaceGroupSheet
          places={selectedPlaces}
          onSelect={(id) => setSelectedIds([id])}
          onClose={close}
        />
      ) : selectedPlaces[0] ? (
        <PlaceDetailsSheet key={selectedPlaces[0].id} place={selectedPlaces[0]} onClose={close} />
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingBottom: space.md,
    gap: space.md,
    backgroundColor: colors.background,
  },
  topRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  switcher: {
    flexDirection: "row",
    padding: 3,
    backgroundColor: colors.subtle,
    borderRadius: radius.sm,
  },
  switch: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  selectedSwitch: { backgroundColor: colors.surface },
  savedWrap: {
    borderRightWidth: 1,
    borderRightColor: colors.border,
    paddingRight: space.sm,
    marginRight: space.xs,
  },
  saved: {
    flexDirection: "row",
    minHeight: 44,
    alignItems: "center",
    gap: space.xs,
    paddingHorizontal: space.sm,
    borderRadius: radius.sm,
  },
  filterText: { fontSize: 13, color: colors.muted, fontWeight: "600" },
  body: { flex: 1 },
  list: { ...ui.content, paddingTop: space.xs },
  mapNotice: { position: "absolute", top: space.md, left: 20, right: 20 },
  mapHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    padding: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    minHeight: 44,
  },
  fit: {
    position: "absolute",
    bottom: 20,
    right: 20,
    padding: 2,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    elevation: 2,
  },
});
