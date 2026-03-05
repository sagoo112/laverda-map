import React, { useMemo } from "react";
import { View, Text, StyleSheet, Pressable, Linking, ScrollView } from "react-native";

import { placesForMap } from "../utils/placesData";
import { openNavigation, openInNativeMaps } from "../utils/openMaps";

type Props = {
  route: {
    params: {
      placeId: string;
    };
  };
};

const items = placesForMap;

export default function PlaceDetailsScreen({ route }: Props) {
  const entry = useMemo(() => items.find((x) => x.id === route.params.placeId), [route.params.placeId]);

  if (!entry) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Not found</Text>
      </View>
    );
  }

  const label = entry.location?.label ?? entry.description ?? entry.url;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{entry.description ?? entry.url}</Text>
      <Text style={styles.meta}>
        {entry.category} • {entry._country} • {entry.location?.mode ?? "country-centroid"}
      </Text>

      <Text style={styles.block}>URL: {entry.url}</Text>
      {entry.tags?.length ? <Text style={styles.block}>Tags: {entry.tags.join(", ")}</Text> : null}
      {typeof entry.verified === "boolean" ? <Text style={styles.block}>Verified: {String(entry.verified)}</Text> : null}
      {entry.lastCheckedAt ? <Text style={styles.block}>Last checked: {entry.lastCheckedAt}</Text> : null}
      <Text style={styles.block}>
        Coordinates: {entry._lat.toFixed(5)}, {entry._lng.toFixed(5)} ({label})
      </Text>

      <View style={styles.buttons}>
        <Pressable style={styles.btn} onPress={() => Linking.openURL(entry.url)}>
          <Text style={styles.btnText}>Open Website</Text>
        </Pressable>

        <Pressable
          style={styles.btnOutline}
          onPress={() => openNavigation({ navigationUrl: entry._navigationUrl, lat: entry._lat, lng: entry._lng })}
        >
          <Text style={styles.btnOutlineText}>Navigate (Google Maps)</Text>
        </Pressable>

        <Pressable style={styles.btnOutline} onPress={() => openInNativeMaps({ lat: entry._lat, lng: entry._lng, label })}>
          <Text style={styles.btnOutlineText}>Open in Maps App</Text>
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
