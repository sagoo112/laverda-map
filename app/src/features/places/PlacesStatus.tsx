import React from "react";
import { ActivityIndicator, Pressable, Text, View, StyleSheet } from "react-native";
import { usePlaces } from "./PlacesProvider";
import { colors, space, ui } from "../../shared/theme";

export default function PlacesStatus({ compact = false }: { compact?: boolean }) {
  const { loading, error, source, cachedAt, storageError, refresh } = usePlaces();
  if (!loading && !error && !storageError && (source === "local" || compact)) return null;
  const label = source === "local" ? "Local directory" : "Online directory";
  return (
    <View style={styles.wrap} accessibilityLiveRegion="polite">
      <View style={ui.row}>
        {loading && <ActivityIndicator size="small" color={colors.accent} />}
        <Text style={[ui.caption, styles.label, { flex: 1 }]}>
          {loading ? "Loading online directory…" : label}
          {!compact && !loading && cachedAt ? " · " + new Date(cachedAt).toLocaleDateString() : ""}
        </Text>
        {source === "api" && !loading && (!compact || !!error) && (
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
      {error && <Text style={ui.caption}>{error}</Text>}
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
