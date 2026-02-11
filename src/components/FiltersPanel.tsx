import React from "react";
import { View, Text, Pressable, StyleSheet, Switch, ScrollView } from "react-native";
import { PlaceType } from "../types/entry";

const TYPES: Array<{ key: PlaceType | "all"; label: string }> = [
  { key: "all", label: "All" },
  { key: "club", label: "Clubs" },
  { key: "private", label: "Private" },
  { key: "museum", label: "Museums" },
  { key: "service", label: "Service" },
  { key: "other", label: "Other" }
];

export function FiltersPanel(props: {
  countries: string[];
  tags: string[];

  country: string;     // all | ISO2
  type: PlaceType | "all";
  tag: string;         // all | tag
  verifiedOnly: boolean;

  setCountry: (v: string) => void;
  setType: (v: PlaceType | "all") => void;
  setTag: (v: string) => void;
  setVerifiedOnly: (v: boolean) => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Row label="Country" items={["all", ...props.countries]} value={props.country} onPick={props.setCountry} />

      <View style={styles.row}>
        <Text style={styles.rowLabel}>Type</Text>
        <View style={styles.chips}>
          {TYPES.map((x) => {
            const active = props.type === x.key;
            return (
              <Pressable key={x.key} onPress={() => props.setType(x.key)} style={[styles.chip, active && styles.chipActive]}>
                <Text style={[styles.text, active && styles.textActive]}>{x.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Row label="Tag" items={["all", ...props.tags]} value={props.tag} onPick={props.setTag} />

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Verified only</Text>
        <Switch value={props.verifiedOnly} onValueChange={props.setVerifiedOnly} />
      </View>
    </ScrollView>
  );
}

function Row(props: { label: string; items: string[]; value: string; onPick: (v: string) => void }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{props.label}</Text>
      <View style={styles.chips}>
        {props.items.map((x) => {
          const active = props.value === x;
          return (
            <Pressable key={x} onPress={() => props.onPick(x)} style={[styles.chip, active && styles.chipActive]}>
              <Text style={[styles.text, active && styles.textActive]}>{x === "all" ? "All" : x}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10, paddingBottom: 10 },
  row: { backgroundColor: "white", borderRadius: 12, padding: 10, borderWidth: 1, borderColor: "#ddd" },
  rowLabel: { fontSize: 12, fontWeight: "900", marginBottom: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: "#ccc" },
  chipActive: { backgroundColor: "#111", borderColor: "#111" },
  text: { fontSize: 12, color: "#111" },
  textActive: { color: "white" },
  switchRow: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "#ddd",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  switchLabel: { fontSize: 12, fontWeight: "900" }
});
