import React from "react";
import { View, Text, StyleSheet, ScrollView, Linking, Pressable } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

const STAT_CARDS = [
  { icon: "map-marker", label: "Countries", value: "25+" },
  { icon: "garage-variant", label: "Shops & Workshops", value: "80+" },
  { icon: "account-group", label: "Clubs & Meetups", value: "40+" }
];

const SECTIONS = [
  {
    icon: "target-variant",
    title: "Our Mission",
    body:
      "Bring every Laverda-friendly place into one modern map so riders can plan routes, find help, and discover hidden gems."
  },
  {
    icon: "map-search-outline",
    title: "What You'll Find",
    body:
      "Verified garages, restoration shops, clubs, meetups, scenic stops, museums, and curated blogs—filtered by category and searchable worldwide."
  },
  {
    icon: "hand-heart",
    title: "Contribute",
    body:
      "Spot something missing? Share coordinates, websites, or stories so the community map stays up-to-date."
  }
];

export default function AboutScreen() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.title}>Laverda Map</Text>
        <Text style={styles.subtitle}>
          The open, community-driven atlas for Laverda riders. Browse on the go, bookmark favorites, and help fellow enthusiasts.
        </Text>
      </View>

      <View style={styles.statsRow}>
        {STAT_CARDS.map((card) => (
          <View key={card.label} style={styles.statCard}>
            <MaterialCommunityIcons name={card.icon as any} size={24} color="#f97316" />
            <Text style={styles.statValue}>{card.value}</Text>
            <Text style={styles.statLabel}>{card.label}</Text>
          </View>
        ))}
      </View>

      {SECTIONS.map((section) => (
        <View key={section.title} style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name={section.icon as any} size={20} color="#0f172a" />
            <Text style={styles.sectionTitle}>{section.title}</Text>
          </View>
          <Text style={styles.sectionBody}>{section.body}</Text>
        </View>
      ))}

      <Pressable style={styles.cta} onPress={() => Linking.openURL("mailto:hello@laverda-map.example")}>
        <MaterialCommunityIcons name="email-send" size={18} color="#fff" />
        <Text style={styles.ctaText}>Suggest a place</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    gap: 20
  },
  hero: {
    backgroundColor: "#0f172a",
    padding: 20,
    borderRadius: 20
  },
  title: { fontSize: 26, fontWeight: "800", color: "#fff" },
  subtitle: { color: "#cbd5f5", marginTop: 10, lineHeight: 20 },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12
  },
  statCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    gap: 6,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3
  },
  statValue: { fontSize: 20, fontWeight: "800", color: "#0f172a" },
  statLabel: { color: "#475569", fontSize: 12 },
  section: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 8,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2
  },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#0f172a" },
  sectionBody: { color: "#475569", lineHeight: 20 },
  cta: {
    backgroundColor: "#f97316",
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#f97316",
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4
  },
  ctaText: { color: "#fff", fontWeight: "700", fontSize: 16 }
});
