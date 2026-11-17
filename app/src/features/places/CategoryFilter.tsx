import React, { type ReactNode } from "react";
import { ScrollView, Pressable, Text, StyleSheet } from "react-native";
import { categories } from "./categories";
import type { PlaceType } from "./schema";
import { colors, radius, space } from "../../shared/theme";

export default function CategoryFilter({
  types,
  selected,
  onSelect,
  leading,
}: {
  types: PlaceType[];
  selected: string;
  onSelect: (value: string) => void;
  leading?: ReactNode;
}) {
  const options = [
    { key: "all", label: "All", icon: "view-grid-outline" as const },
    ...types.map((key) => ({ key, ...categories[key] })),
  ];
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {leading}
      {options.map((option) => (
        <Pressable
          key={option.key}
          accessibilityRole="button"
          accessibilityLabel={option.label}
          accessibilityState={{ selected: selected === option.key }}
          onPress={() => onSelect(option.key)}
          style={({ pressed }) => [
            styles.chip,
            selected === option.key && styles.active,
            pressed && { opacity: 0.65 },
          ]}
        >
          <Text style={[styles.text, selected === option.key && { color: colors.ink }]}>
            {option.label}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  row: { gap: space.xs, alignItems: "center" },
  chip: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.sm,
  },
  active: { backgroundColor: colors.subtle },
  text: { color: colors.muted, fontSize: 13, fontWeight: "600" },
});
