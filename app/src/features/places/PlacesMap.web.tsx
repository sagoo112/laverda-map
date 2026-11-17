import React from "react";
import { Text, View } from "react-native";
import { ui } from "../../shared/theme";
import type { PlacesMapProps } from "./PlacesMap";
import { Button } from "../../shared/ui";

export const MAP_AVAILABLE = false;
export default function PlacesMap({ onShowList }: PlacesMapProps) {
  return (
    <View style={ui.content}>
      <Text style={ui.heading}>Explore the directory</Text>
      <Text style={ui.body}>
        Choose List to browse places here. The interactive map is available in the Android and iOS
        app.
      </Text>
      <Button title="Browse places" onPress={onShowList} secondary />
    </View>
  );
}
