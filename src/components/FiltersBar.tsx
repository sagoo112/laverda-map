import React from "react";
import { View, Text, Pressable, StyleSheet, Switch } from "react-native";

export function FiltersBar(props: {
  countries: string[];
  categories: string[];
  tags: string[];

  country: string;
  category: string;
  tag: string;

  verifiedOnly: boolean;
  okOnly: boolean;

  setCountry: (v: string) => void;
  setCategory: (v: string) => void;
  setTag: (v: string) => void;

  setVerifiedOnly: (v: boolean) => void;
  setOkOnly: (v: boolean) => void;
}) {
  return (
    <View style={styles.wrap}>
      <Row label="Country" items={["all", ...props.countries]} value={props.country} onPick={props.setCountry} />
      <Row label="Category" items={["all", ...props.categories]} value={props.category} onPick={props.setCategory} />
      <Row label="Tag" items={["all", ...props.tags]} value={props.tag} onPick={props.setTag} />

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Verified only</Text>
        <Switch value={props.verifiedOnly} onValueChange={props.setVerifiedOnly} />
      </View>

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Status OK only</Text>
        <Switch value={props.okOnly} onValueChange={props.setOkOnly} />
      </View>
    </View>
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
  wrap: { position: "absolute", top: 10, left: 10, right: 10, gap: 8 },
  row: { backgroundColor: "white", borderRadius: 12, padding: 8, borderWidth: 1, borderColor: "#ddd" },
  rowLabel: { fontSize: 12, fontWeight: "700", marginBottom: 6 },
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
  switchLabel: { fontSize: 12, fontWeight: "700" }
});
