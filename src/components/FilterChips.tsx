import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { PlaceCategory } from "../types/place";

const CATEGORIES: Array<{ key: PlaceCategory | "all"; label: string }> = [
  { key: "all", label: "All" },
  { key: "garage", label: "Garages" },
  { key: "meetup", label: "Meetups" },
  { key: "history", label: "History" },
  { key: "museum", label: "Museums" },
  { key: "dealer", label: "Dealers" },
  { key: "scenic", label: "Scenic" },
  { key: "other", label: "Other" }
];

export function FilterChips(props: {
  selected: PlaceCategory | "all";
  onSelect: (v: PlaceCategory | "all") => void;
}) {
  return (
    <View style={styles.row}>
      {CATEGORIES.map((c) => {
        const active = props.selected === c.key;
        return (
          <Pressable
            key={c.key}
            onPress={() => props.onSelect(c.key)}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[styles.text, active && styles.textActive]}>{c.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    position: "absolute",
    top: 10,
    left: 10,
    right: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#ccc",
    backgroundColor: "white"
  },
  chipActive: {
    borderColor: "#111",
    backgroundColor: "#111"
  },
  text: {
    fontSize: 12,
    color: "#111"
  },
  textActive: {
    color: "white"
  }
});
