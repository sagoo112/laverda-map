import React, { useState } from "react";
import { View, Text, StyleSheet, Modal, Pressable, Linking, ScrollView, Image } from "react-native";
import { WebView } from "react-native-webview";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MapItem } from "../utils/normalizeEntries";
import { getCategoryMeta } from "../utils/placeCategories";

type Props = {
	place: MapItem | null;
};

export default function PlaceBottomSheet({ place }: Props) {
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);
	const insets = useSafeAreaInsets();
	
	if (!place) return null;

	const categoryMeta = getCategoryMeta(place);
	
	const openNavigation = () => {
		if (!place) return;
		
		const url = place._navigationUrl ?? `https://www.google.com/maps/dir/?api=1&destination=${place._lat},${place._lng}`;
		Linking.openURL(url);
	};
	
	return (
			<>
			<View pointerEvents="box-none" style={styles.host}>
			<View pointerEvents="none" style={styles.overlay} />
			<View pointerEvents="box-none" style={[styles.sheetContainer, { paddingBottom: insets.bottom + 90 }]}>
			<View style={styles.sheet}>
			<ScrollView>
			<Text style={styles.title}>{place.name}</Text>
			
				<View style={[styles.categoryPill, { borderColor: categoryMeta.color, backgroundColor: `${categoryMeta.color}18` }]}>
				{categoryMeta.key === "club" && categoryMeta.iconImage ? (
				<View
				style={{
					width: 18,
					height: 18,
					borderRadius: 9,
					backgroundColor: "#fff",
					alignItems: "center",
					justifyContent: "center",
					marginRight: 6
				}}
				>
					<Image source={categoryMeta.iconImage} style={{ width: 16, height: 16, borderRadius: 8 }} />
				</View>
				) : (
				<MaterialCommunityIcons name={categoryMeta.icon as any} size={16} color={categoryMeta.color} />
				)}
				<Text style={[styles.categoryText, { color: categoryMeta.color }]}>
				{categoryMeta.label}
				</Text>
				</View>
			
			{place.address && (
							   <Text style={styles.meta}>Address: {place.address}</Text>
							   )}
			
			{place.description && (
								   <Text style={styles.description}>{place.description}</Text>
								   )}
			
			{place.url && (
						   <>
						   <Pressable
						   style={styles.button}
						   onPress={() => setPreviewUrl(place.url)}
						   >
						   <Text style={styles.buttonText}>Preview Website</Text>
						   </Pressable>
						   
						   <Pressable
						   style={styles.button}
						   onPress={() => Linking.openURL(place.url)}
						   >
						   <Text style={styles.buttonText}>Open Website</Text>
						   </Pressable>
						   </>
						   )}
			
				{Number.isFinite(place._lat) && Number.isFinite(place._lng) && (
													   <Pressable style={styles.button} onPress={openNavigation}>
													   <Text style={styles.buttonText}>Navigate</Text>
													   </Pressable>
													   )}
			</ScrollView>
			</View>
			</View>
			</View>
			
			{previewUrl && (
							<Modal visible animationType="slide" onRequestClose={() => setPreviewUrl(null)}>
							<View style={{ flex: 1 }}>
							<WebView source={{ uri: previewUrl }} />
							<Pressable style={styles.previewCloseButton} onPress={() => setPreviewUrl(null)}>
							<Text style={styles.previewCloseText}>Back</Text>
							</Pressable>
							</View>
							</Modal>
							)}
			</>
			);
}

const styles = StyleSheet.create({
	host: {
		...StyleSheet.absoluteFillObject,
	},
	overlay: {
		...StyleSheet.absoluteFillObject,
		backgroundColor: "rgba(0,0,0,0.3)",
	},
	sheetContainer: {
		flex: 1,
		justifyContent: "flex-end",
	},
	sheet: {
		backgroundColor: "#fff",
		padding: 20,
		maxHeight: "70%",
		borderTopLeftRadius: 20,
		borderTopRightRadius: 20,
	},
	title: {
		fontSize: 20,
		fontWeight: "bold",
		marginBottom: 10,
	},
	categoryPill: {
		alignSelf: "flex-start",
		paddingHorizontal: 12,
		paddingVertical: 4,
		borderRadius: 999,
		borderWidth: 1,
		marginBottom: 8,
	},
	categoryText: {
		fontSize: 13,
		fontWeight: "600",
	},
	description: {
		fontSize: 14,
		marginVertical: 10,
	},
	meta: {
		fontSize: 14,
		marginBottom: 6,
		color: "#4b5563",
	},
	button: {
		backgroundColor: "#222",
		padding: 12,
		borderRadius: 8,
		marginVertical: 6,
	},
	buttonText: {
		color: "#fff",
		textAlign: "center",
	},
	previewCloseButton: {
		padding: 14,
		backgroundColor: "#111",
	},
	previewCloseText: {
		color: "#fff",
		textAlign: "center",
	}
});
