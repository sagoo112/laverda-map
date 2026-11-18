import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Platform, Text, Image } from "react-native";
import Constants from "expo-constants";
import MapView, { Marker } from "react-native-maps";
import type { MappablePlace } from "./model";
import { categories } from "./categories";
import { Button, Icon } from "../../shared/ui";
import { colors, ui } from "../../shared/theme";

export type PlacesMapProps = {
  places: MappablePlace[];
  fitRevision: number;
  onSelect: (id: string) => void;
  onShowList: () => void;
};
export const MAP_AVAILABLE =
  Platform.OS === "ios" ||
  (Platform.OS === "android" && !!Constants.expoConfig?.extra?.mapsAndroidConfigured);
export default function PlacesMap({ places, fitRevision, onSelect, onShowList }: PlacesMapProps) {
  const map = useRef<MapView>(null);
  const ready = useRef(false);
  const latest = useRef(places);
  useEffect(() => {
    latest.current = places;
  }, [places]);
  const fit = () => {
    if (ready.current && latest.current.length)
      map.current?.fitToCoordinates(
        latest.current.map((place) => ({
          latitude: place.location.lat,
          longitude: place.location.lng,
        })),
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
      {places.map((place) => (
        <Marker
          key={place.id}
          coordinate={{ latitude: place.location.lat, longitude: place.location.lng }}
          title={place.name}
          description={place.address ?? categories[place.type].label}
          onPress={(event) => {
            event.stopPropagation();
            onSelect(place.id);
          }}
        >
          <View style={[styles.marker, { borderColor: categories[place.type].color }]}>
            {place.type === "club" ? (
              <Image
                source={require("../../../assets/laverda-logo.jpg")}
                style={{ width: 29, height: 24 }}
                resizeMode="contain"
                accessibilityLabel="Laverda club"
              />
            ) : (
              <Icon
                name={categories[place.type].icon}
                color={categories[place.type].color}
                size={22}
              />
            )}
          </View>
        </Marker>
      ))}
    </MapView>
  );
}
const styles = StyleSheet.create({
  marker: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
});
