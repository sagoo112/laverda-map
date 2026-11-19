import React, { useEffect, useMemo, useRef } from "react";
import { View, StyleSheet, Platform, Text, Image } from "react-native";
import Constants from "expo-constants";
import MapView, { Marker, type MapMarker } from "react-native-maps";
import type { MappablePlace } from "./model";
import { groupMapPlaces, mapCoordinate } from "./mapGroups";
import { categories } from "./categories";
import { Button, Icon } from "../../shared/ui";
import { colors, ui } from "../../shared/theme";

export type PlacesMapProps = {
  places: MappablePlace[];
  fitRevision: number;
  onSelect: (ids: string[]) => void;
  onShowList: () => void;
};
export const MAP_AVAILABLE =
  Platform.OS === "ios" ||
  (Platform.OS === "android" && !!Constants.expoConfig?.extra?.mapsAndroidConfigured);
const MARKER_SIZE = 38;
const MARKER_BORDER = 2;
const LOGO_DIAMETER = MARKER_SIZE - 2 * MARKER_BORDER;
export default function PlacesMap({ places, fitRevision, onSelect, onShowList }: PlacesMapProps) {
  const map = useRef<MapView>(null);
  const ready = useRef(false);
  const groups = useMemo(() => groupMapPlaces(places), [places]);
  const latest = useRef(groups);
  useEffect(() => {
    latest.current = groups;
  }, [groups]);
  const fit = () => {
    if (ready.current && latest.current.length)
      map.current?.fitToCoordinates(
        latest.current.map(([place]) => mapCoordinate(place)),
        { edgePadding: { top: 48, left: 48, right: 48, bottom: 100 }, animated: true },
      );
  };
  useEffect(() => {
    if (fitRevision > 0) fit();
  }, [fitRevision]);
  if (!MAP_AVAILABLE) {
    return (
      <View style={ui.content}>
        <Text style={ui.heading}>The directory is ready.</Text>
        <Text style={ui.body}>
          The map is not configured in this build. All places are available in the list.
        </Text>
        <Button title="Browse places" onPress={onShowList} secondary />
      </View>
    );
  }
  return (
    <MapView
      ref={map}
      style={StyleSheet.absoluteFill}
      initialRegion={{ latitude: 46.8, longitude: 8.2, latitudeDelta: 4, longitudeDelta: 5 }}
      onMapReady={() => {
        ready.current = true;
        if (fitRevision > 0) fit();
      }}
      showsUserLocation={false}
      showsMyLocationButton={false}
      userInterfaceStyle="light"
    >
      {groups.map((group) => (
        <PlaceMarker
          key={JSON.stringify(group.map(({ id }) => id))}
          group={group}
          onSelect={onSelect}
        />
      ))}
    </MapView>
  );
}

function PlaceMarker({
  group,
  onSelect,
}: {
  group: MappablePlace[];
  onSelect: PlacesMapProps["onSelect"];
}) {
  const marker = useRef<MapMarker>(null);
  const [place] = group;
  const club = place.type === "club";
  const category = categories[place.type];
  const grouped = group.length > 1;
  return (
    <Marker
      ref={marker}
      coordinate={mapCoordinate(place)}
      title={grouped ? `${group.length} places here` : place.name}
      description={place.address ?? category.label}
      zIndex={club ? 2 : 1}
      onPress={(event) => {
        event.stopPropagation();
        onSelect(group.map(({ id }) => id));
      }}
    >
      <View style={grouped ? styles.groupMarker : undefined}>
        <View style={[styles.marker, { borderColor: category.color }]}>
          {club ? (
            <Image
              source={require("../../../assets/laverda-adaptive-icon.png")}
              style={styles.clubLogo}
              resizeMode="contain"
              resizeMethod="resize"
              fadeDuration={0}
              accessibilityLabel="Laverda club"
              onLoad={Platform.OS === "android" ? () => marker.current?.redraw() : undefined}
            />
          ) : (
            <Icon name={category.icon} color={category.color} size={22} />
          )}
        </View>
        {grouped && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{group.length}</Text>
          </View>
        )}
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  marker: {
    width: MARKER_SIZE,
    height: MARKER_SIZE,
    borderRadius: MARKER_SIZE / 2,
    borderWidth: MARKER_BORDER,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  // Scale the opaque disk to fill the pin, including the PNG's transparent margins.
  clubLogo: {
    width: (1024 / 536) * LOGO_DIAMETER,
    height: (1024 / 536) * LOGO_DIAMETER,
  },
  groupMarker: { minWidth: 46, paddingTop: 4, alignItems: "center" },
  badge: {
    position: "absolute",
    top: 0,
    right: 0,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 3,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.white,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: colors.white, fontSize: 10, fontWeight: "700", includeFontPadding: false },
});
