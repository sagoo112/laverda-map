import React, { useCallback, useMemo, useState } from "react";
import { FlatList, Keyboard, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { usePlaces } from "../places/PlacesProvider";
import { filterPlaces, isOnlineResource, sortPlaces } from "../places/model";
import CategoryFilter from "../places/CategoryFilter";
import type { PlaceType } from "../places/schema";
import PlacesStatus from "../places/PlacesStatus";
import PlaceCard from "../places/PlaceCard";
import PlaceDetailsSheet from "../places/PlaceDetailsSheet";
import { EmptyState, SearchField } from "../../shared/ui";
import { space, ui } from "../../shared/theme";

export default function ResourcesScreen() {
  const { places, loading, refresh, source } = usePlaces();
  const insets = useSafeAreaInsets();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const resources = useMemo(() => sortPlaces(places.filter(isOnlineResource)), [places]);
  const types = useMemo(
    () =>
      (["blog", "forum", "registry"] as PlaceType[]).filter((type) =>
        resources.some((place) => place.type === type),
      ),
    [resources],
  );
  const results = useMemo(
    () => filterPlaces(resources, query, category),
    [resources, query, category],
  );
  const selected = results.find((place) => place.id === selectedId);
  const close = useCallback(() => setSelectedId(null), []);
  useFocusEffect(useCallback(() => () => setSelectedId(null), []));
  return (
    <View style={ui.screen}>
      <View
        style={{
          paddingHorizontal: 20,
          paddingTop: insets.top + space.md,
          paddingBottom: space.md,
          gap: space.md,
        }}
      >
        <Text accessibilityRole="header" style={ui.title}>
          Resources
        </Text>
        <Text style={ui.body}>Knowledge from the Laverda community.</Text>
        <SearchField
          value={query}
          onChangeText={(value) => {
            setQuery(value);
            close();
          }}
          label="Search resources"
          placeholder="Search blogs, forums and registries"
          testID="resource-search"
        />
        <CategoryFilter
          types={types}
          selected={category}
          onSelect={(value) => {
            setCategory(value);
            close();
          }}
        />
        <View style={{ gap: 2 }}>
          <Text accessibilityLiveRegion="polite" style={ui.caption}>
            {results.length} independent {results.length === 1 ? "website" : "websites"}
          </Text>
          <PlacesStatus compact />
        </View>
      </View>
      <FlatList
        data={results}
        keyExtractor={(place) => place.id}
        refreshing={loading}
        onRefresh={source === "api" ? refresh : undefined}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={[ui.content, { paddingTop: space.xs }]}
        renderItem={({ item }) => (
          <PlaceCard
            place={item}
            onPress={() => {
              Keyboard.dismiss();
              setSelectedId(item.id);
            }}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            title="No resources found"
            body="Try another keyword or category."
            action={
              query || category !== "all"
                ? {
                    title: "Clear filters",
                    onPress: () => {
                      setQuery("");
                      setCategory("all");
                      Keyboard.dismiss();
                    },
                  }
                : undefined
            }
          />
        }
      />
      {selected && <PlaceDetailsSheet key={selected.id} place={selected} onClose={close} />}
    </View>
  );
}
