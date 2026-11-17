import React from "react";
import { ActivityIndicator, Pressable, Text, View, StyleSheet } from "react-native";
import { usePlaces } from "./PlacesProvider";
import { API_URL } from "../../shared/api";
import { colors, space, ui } from "../../shared/theme";

export default function PlacesStatus({ compact = false }: { compact?: boolean }) {
  const { loading, error, source, cachedAt, storageError, refresh } = usePlaces();
  if (!loading && !error && source === "live" && !storageError) return null;
  const label =
    source === "bundled"
      ? "Included directory"
      : source === "saved"
        ? "Saved offline"
        : "Latest directory";
  return (
    <View style={styles.wrap} accessibilityLiveRegion="polite">
      <View style={ui.row}>
        {loading && <ActivityIndicator size="small" color={colors.accent} />}
        <Text style={[ui.caption, styles.label, { flex: 1 }]}>
          {loading ? "Checking for updates…" : error ? label + " · unable to update" : label}
          {!compact && !loading && cachedAt ? " · " + new Date(cachedAt).toLocaleDateString() : ""}
        </Text>
        {API_URL && !loading && (!compact || !!error) && (
          <Pressable
            onPress={refresh}
            accessibilityRole="button"
            accessibilityLabel="Refresh places"
            style={styles.retry}
          >
            <Text style={styles.link}>Refresh</Text>
          </Pressable>
        )}
      </View>
      {storageError && <Text style={ui.caption}>{storageError}</Text>}
    </View>
  );
}
const styles = StyleSheet.create({
  wrap: {
    gap: space.xs,
  },
  label: { fontSize: 12, lineHeight: 17 },
  retry: { minHeight: 44, justifyContent: "center", paddingHorizontal: space.sm },
  link: { color: colors.accent, fontWeight: "700" },
});
