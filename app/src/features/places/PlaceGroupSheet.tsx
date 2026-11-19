import React, { useEffect } from "react";
import { BackHandler, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { Icon, IconButton } from "../../shared/ui";
import { colors, radius, space, ui } from "../../shared/theme";
import { categories } from "./categories";
import type { Place } from "./model";

function Backdrop(props: BottomSheetBackdropProps) {
  return (
    <BottomSheetBackdrop
      {...props}
      appearsOnIndex={0}
      disappearsOnIndex={-1}
      pressBehavior="close"
    />
  );
}

export default function PlaceGroupSheet({
  places,
  onSelect,
  onClose,
}: {
  places: Place[];
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const { height } = useWindowDimensions();
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      onClose();
      return true;
    });
    return () => subscription.remove();
  }, [onClose]);

  return (
    <BottomSheet
      index={0}
      maxDynamicContentSize={height * 0.6}
      enablePanDownToClose
      onClose={onClose}
      backdropComponent={Backdrop}
      backgroundStyle={{ backgroundColor: colors.surface }}
      handleIndicatorStyle={{ backgroundColor: colors.border }}
    >
      <BottomSheetScrollView contentContainerStyle={styles.content} accessibilityViewIsModal>
        <View style={ui.row}>
          <Text accessibilityRole="header" style={[ui.heading, { flex: 1 }]}>
            {places.length} places here
          </Text>
          <IconButton label="Close places at this location" icon="close" onPress={onClose} />
        </View>
        {places.map((place) => {
          const category = categories[place.type];
          return (
            <Pressable
              key={place.id}
              accessibilityRole="button"
              accessibilityLabel={`${place.name}, ${category.label}`}
              onPress={() => onSelect(place.id)}
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
            >
              <Icon name={category.icon} color={category.color} size={22} />
              <View style={{ flex: 1 }}>
                <Text style={ui.caption}>{category.label}</Text>
                <Text style={styles.name}>{place.name}</Text>
              </View>
              <Icon name="chevron-right" size={20} />
            </Pressable>
          );
        })}
      </BottomSheetScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: space.xl, paddingBottom: space.xxl, gap: space.md },
  row: {
    ...ui.row,
    gap: space.md,
    padding: space.md,
    minHeight: 48,
    backgroundColor: colors.background,
    borderRadius: radius.sm,
  },
  name: { ...ui.body, color: colors.ink, fontWeight: "600" },
});
