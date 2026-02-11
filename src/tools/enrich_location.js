import React, { useMemo } from "react";
import { View, Text, StyleSheet, Pressable, Linking, ScrollView } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../App";

import { PlacesFile } from "../types/entry";
import { normalizeForMap } from "../utils/normalizeEntries";
import { openInNativeMaps } from "../utils/openMaps";

import placesRaw from "../data/places.json";

type Props = NativeStackScreenProps<RootStackParamList, "PlaceDetails">;

const file = placesRaw as PlacesFile;
const items = normalizeForMap(file.entries);

export default function PlaceDetailsScreen({ route }: Props) {
  const entry = useMemo(
    () => items.find((x) => x.id === route.params.placeId),
    [route.params.placeId]
  );

  if (!entry) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Not found</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{entry.description ?? entry.url}</Text>
      <Text style={styles.meta}>{entry.category} • {entry._country}</Text>

      <Text style={styles.block}>URL: {entry.url}</Text>
      {entry.tags?.length ? <Text style={styles.block}>Tags: {entry.tags.join(", ")}</Text> : null}
      {typeof entry.verified === "boolean" ? <Text style={styles.block}>Verified: {String(entry.verified)}</Text> : null}
      {entry.lastCheckedAt ? <Text style={styles.block}>Last checked: {entry.lastCheckedAt}</Text> : null}

      <View style={styles.buttons}>
        <Pressable style={styles.btn} onPress={() => Linking.openURL(entry.url)}>
          <Text style={styles.btnText}>Open Website</Text>
        </Pressable>

        <Pressable
          style={styles.btnOutline}
          onPress={() =>
            openInNativeMaps({
              label: entry.description ?? entry.url,
              lat: entry._lat,
              lng: entry._lng
            })
          }
        >
          <Text style={styles.btnOutlineText}>Open Marker in Maps</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 10 },
  title: { fontSize: 20, fontWeight: "800" },
  meta: { color: "#666" },
  block: { fontSize: 14, lineHeight: 20 },
  buttons: { flexDirection: "row", gap: 10, marginTop: 8, flexWrap: "wrap" },
  btn: { backgroundColor: "#111", paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10 },
  btnText: { color: "white", fontWeight: "700" },
  btnOutline: { borderWidth: 1, borderColor: "#111", paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10 },
  btnOutlineText: { color: "#111", fontWeight: "700" }
});
