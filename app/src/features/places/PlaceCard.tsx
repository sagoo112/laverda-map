import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { type Place, isOnlineResource, locationLabel } from "./model";
import { categories } from "./categories";
import { colors, space, ui } from "../../shared/theme";
import { IconButton } from "../../shared/ui";
import { usePlaces } from "./PlacesProvider";

export default function PlaceCard({
  place,
  onPress,
  distance,
}: {
  place: Place;
  onPress: () => void;
  distance?: number;
}) {
  const { favorites, toggleFavorite, favoritesReady } = usePlaces();
  const category = categories[place.type];
  const saved = favorites.includes(place.id);
  return (
    <View style={[ui.card, styles.card]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={"View " + place.name}
        testID={"place-" + place.id}
        style={styles.main}
      >
        <View style={ui.row}>
          <View style={[styles.dot, { backgroundColor: category.color }]} />
          <Text style={[ui.caption, { flex: 1 }]}>
            {category.label}
            {!isOnlineResource(place) ? " · " + locationLabel(place) : ""}
          </Text>
        </View>
        <Text style={styles.name}>{place.name}</Text>
        {place.address && (
          <Text style={ui.body} numberOfLines={2}>
            {place.address}
          </Text>
        )}
        {!place.address && place.url && (
          <Text style={ui.body} numberOfLines={2}>
            {new URL(place.url).hostname.replace(/^www\./, "")}
          </Text>
        )}
        {distance !== undefined && (
          <Text style={ui.caption}>
            About {distance < 10 ? distance.toFixed(1) : Math.round(distance)} km away · straight
            line
          </Text>
        )}
      </Pressable>
      <IconButton
        label={(saved ? "Unsave " : "Save ") + place.name}
        icon={saved ? "bookmark" : "bookmark-outline"}
        selected={saved}
        disabled={!favoritesReady}
        onPress={() => toggleFavorite(place.id)}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "flex-start", gap: space.xs, paddingRight: space.xs },
  main: { flex: 1, gap: space.sm },
  name: { fontSize: 17, fontWeight: "600", color: colors.ink, lineHeight: 24 },
  dot: { width: 5, height: 5, borderRadius: 3 },
});
