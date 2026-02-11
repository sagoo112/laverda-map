import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function AboutScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Laverda Map</Text>
      <Text>
        Curated worldwide places relevant to Laverda riders: garages, meetups, museums, scenic spots.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 10 },
  title: { fontSize: 22, fontWeight: "700" }
});
