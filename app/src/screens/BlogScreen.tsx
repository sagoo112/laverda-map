import React, { useMemo, useState, useCallback } from "react";
import { View, Text, FlatList, Pressable, StyleSheet, Modal } from "react-native";
import { WebView } from "react-native-webview";

import { placesForMap } from "../utils/placesData";
import { MapItem } from "../utils/normalizeEntries";

export default function BlogScreen() {
	const blogItems = useMemo(() => {
		return placesForMap
			.filter((p) => p.type === "blog" && p.url)
			.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
	}, []);

	const [selectedItem, setSelectedItem] = useState<MapItem | null>(null);

	const colors = useMemo(() => ["#EA4335", "#F9AB00", "#34A853", "#4285F4"], []);

	const renderItem = useCallback(
		({ item, index }: { item: MapItem; index: number }) => {
			const accent = colors[index % colors.length];
			const tags = (item.tags ?? []).slice(0, 3);

			return (
				<Pressable
					style={[styles.card, { borderColor: accent }]}
					onPress={() => setSelectedItem(item)}
					android_ripple={{ color: "rgba(0,0,0,0.1)" }}
				>
					<View style={[styles.badge, { backgroundColor: accent }]}>
						<Text style={styles.badgeText}>BLOG</Text>
					</View>
					<Text style={styles.title}>{item.name ?? item.description ?? item.url}</Text>
					{item.description ? (
						<Text style={styles.sub} numberOfLines={3}>
							{item.description}
						</Text>
					) : null}

					<View style={styles.metaRow}>
						{item._country ? <Text style={styles.metaText}>🌍 {item._country}</Text> : null}
						{item.lastCheckedAt ? <Text style={styles.metaText}>Updated {item.lastCheckedAt}</Text> : null}
					</View>

					{tags.length ? (
						<View style={styles.tagRow}>
							{tags.map((tag) => (
								<View key={tag} style={styles.tagChip}>
									<Text style={styles.tagText}>{tag}</Text>
								</View>
							))}
						</View>
					) : null}
				</Pressable>
			);
		},
		[colors]
	);
	
	return (
		<View style={styles.container}>
			<FlatList
				data={blogItems}
				keyExtractor={(item, index) => {
					const base = item.id ?? item.url ?? "blog";
					return `${base}-${index}`;
				}}
				renderItem={renderItem}
				ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
				contentContainerStyle={styles.listContent}
				ListHeaderComponent={
					<View style={styles.hero}>
						<Text style={styles.heroTitle}>Laverda Stories</Text>
						<Text style={styles.heroSubtitle}>
							Dive into {blogItems.length} curated blogs, club journals, and travel logs from the community.
						</Text>
					</View>
				}
				ListEmptyComponent={
					<View style={styles.emptyCard}>
						<Text style={styles.emptyTitle}>No blog entries yet</Text>
						<Text style={styles.emptyBody}>Check back soon or share a favorite site with the team.</Text>
					</View>
				}
			/>

			{selectedItem?.url && (
				<Modal visible animationType="slide" onRequestClose={() => setSelectedItem(null)}>
					<View style={styles.modalContainer}>
						<View style={styles.modalHeader}>
							<Text style={styles.modalTitle} numberOfLines={1}>
								{selectedItem.name ?? selectedItem.url}
							</Text>
							<Pressable onPress={() => setSelectedItem(null)}>
								<Text style={styles.modalCloseText}>Close</Text>
							</Pressable>
						</View>
						<WebView style={{ flex: 1 }} source={{ uri: selectedItem.url }} />
					</View>
				</Modal>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: "#fafafa" },
	listContent: { padding: 16, paddingBottom: 40 },
	hero: {
		marginBottom: 24,
		padding: 18,
		borderRadius: 16,
		backgroundColor: "#1f2937",
	},
	heroTitle: { color: "#fff", fontSize: 22, fontWeight: "700" },
	heroSubtitle: { color: "#cbd5f5", marginTop: 8, lineHeight: 20 },
	card: {
		padding: 18,
		borderRadius: 16,
		backgroundColor: "#fff",
		borderWidth: 2,
	},
	badge: {
		alignSelf: "flex-start",
		paddingHorizontal: 10,
		paddingVertical: 4,
		borderRadius: 999,
		marginBottom: 10,
	},
	badgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },
	title: { fontSize: 17, fontWeight: "700", color: "#111" },
	sub: { marginTop: 6, fontSize: 14, color: "#444" },
	metaRow: { flexDirection: "row", gap: 12, marginTop: 12 },
	metaText: { fontSize: 12, color: "#6b7280" },
	tagRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 12, gap: 6 },
	tagChip: {
		paddingHorizontal: 10,
		paddingVertical: 4,
		backgroundColor: "#f3f4f6",
		borderRadius: 999,
	},
	tagText: { fontSize: 12, color: "#374151" },
	emptyCard: {
		padding: 20,
		borderRadius: 16,
		backgroundColor: "#fff",
		borderWidth: 1,
		borderColor: "#e5e7eb",
		alignItems: "center",
	},
	emptyTitle: { fontSize: 16, fontWeight: "600", marginBottom: 8 },
	emptyBody: { color: "#6b7280", textAlign: "center" },
	modalContainer: { flex: 1, backgroundColor: "#000" },
	modalHeader: {
		paddingTop: 50,
		paddingBottom: 12,
		paddingHorizontal: 16,
		backgroundColor: "#111",
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: 16
	},
	modalTitle: { color: "#fff", fontSize: 16, fontWeight: "700", flex: 1 },
	modalCloseText: { color: "#fff", fontWeight: "600" }
});
