import React, { useCallback, useMemo, useRef, useState } from "react";
import { View, StyleSheet, TextInput, Pressable, FlatList, Text, Image } from "react-native";
import MapView, { MapPressEvent, Marker, MarkerPressEvent } from "react-native-maps";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import CategoryFilter from "../components/CategoryFilter";
import PlaceBottomSheet from "../components/PlaceBottomSheet";
import { placesForMap } from "../utils/placesData";
import { MapItem } from "../utils/normalizeEntries";
import { getCategoryMeta } from "../utils/placeCategories";

export default function MapScreen() {
	const [selectedCategory, setSelectedCategory] = useState("all");
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedPlace, setSelectedPlace] = useState<MapItem | null>(null);
	const [showSuggestions, setShowSuggestions] = useState(false);
	const insets = useSafeAreaInsets();
	const mapRef = useRef<MapView>(null);

	const PLACES: MapItem[] = useMemo(() => placesForMap.filter((p) => p.type !== "blog"), []);

	const categories = useMemo(() => {
		const unique = new Set<string>();
		PLACES.forEach((p) => {
			const meta = getCategoryMeta(p);
			unique.add(meta.key);
		});
		return ["all", ...Array.from(unique)];
	}, [PLACES]);
	
	const filteredPlaces = useMemo(() => {
		let next = selectedCategory === "all" ? PLACES : PLACES.filter((p) => getCategoryMeta(p).key === selectedCategory);
		const query = searchQuery.trim().toLowerCase();
		if (!query) return next;
		return next.filter((p) => {
			const hay = [
				p.name,
				p.description,
				p.address,
				p.country,
				p._country,
				p.tags?.join(" "),
				p.category
			]
				.filter(Boolean)
				.join(" ")
				.toLowerCase();
			return hay.includes(query);
		});
	}, [PLACES, selectedCategory, searchQuery]);

	const handleMapPress = (_event: MapPressEvent) => {
		setSelectedPlace(null);
	};

	const handleMarkerPress = (place: MapItem) => (event: MarkerPressEvent) => {
		if (event && typeof event.stopPropagation === "function") {
			event.stopPropagation();
		}
		setSelectedPlace(place);
	};

	const suggestions = useMemo(() => {
		const query = searchQuery.trim().toLowerCase();
		if (!query) return [];
		return PLACES.filter((p) => {
			const hay = [p.name, p.description, p.address, p.country].filter(Boolean).join(" ").toLowerCase();
			return hay.includes(query);
		}).slice(0, 5);
	}, [PLACES, searchQuery]);

	const focusPlace = useCallback((place: MapItem) => {
		setSelectedPlace(place);
		setSearchQuery(place.name ?? place.description ?? "");
		setShowSuggestions(false);

		requestAnimationFrame(() => {
			mapRef.current?.animateToRegion(
				{
					latitude: place._lat,
					longitude: place._lng,
					latitudeDelta: 0.5,
					longitudeDelta: 0.5
				},
				500
			);
		});
	}, []);

	const handleSuggestionSelect = (place: MapItem) => {
		focusPlace(place);
	};

	const handleSubmitEditing = () => {
		if (suggestions.length) {
			focusPlace(suggestions[0]);
		}
	};
	
	return (
			<View style={styles.container}>
				<MapView
				ref={mapRef}
				style={styles.map}
			initialRegion={{
				latitude: 48.0,
				longitude: 5.0,
				latitudeDelta: 22,
				longitudeDelta: 28,
			}}
			onPress={handleMapPress}
			>
			{filteredPlaces.map((place: MapItem, index: number) => {
				const lat = Number(place._lat);
				const lng = Number(place._lng);
				const key = place.id ? `${place.id}-${index}` : `${lat}-${lng}-${index}`;
				const categoryMeta = getCategoryMeta(place);
				const showLogo = categoryMeta.key === "club" && Boolean(categoryMeta.iconImage);
				
				return (
						<Marker
						key={key}
						coordinate={{ latitude: lat, longitude: lng }}
						title={place.name ?? place.description ?? "Place"}
						description={place.address ?? categoryMeta.label}
						onPress={handleMarkerPress(place)}
						tracksViewChanges={false}
						anchor={{ x: 0.5, y: 1 }}
						>
						<View style={styles.markerWrapper}>
						<View
						style={[
							styles.markerBubble,
							{ backgroundColor: categoryMeta.color },
							showLogo ? styles.markerBubbleLogo : null
						]}
						>
							{showLogo ? (
								<Image source={categoryMeta.iconImage} style={styles.markerLogoFull} resizeMode="cover" />
							) : (
								<MaterialCommunityIcons name={categoryMeta.icon as any} size={18} color="#fff" />
							)}
						</View>
						<View style={[styles.markerPointer, { borderTopColor: categoryMeta.color }]} />
						</View>
						</Marker>
						);
			})}
			</MapView>
			
			<View pointerEvents="box-none" style={[styles.controls, { top: Math.max(20, insets.top + 8) }]}>
				<View style={styles.searchBar}>
					<MaterialCommunityIcons name="magnify" size={18} color="#475569" />
					<TextInput
						style={styles.searchInput}
						placeholder="Search places..."
						placeholderTextColor="#94a3b8"
						value={searchQuery}
						onChangeText={(text) => {
							setSearchQuery(text);
							setShowSuggestions(true);
						}}
						onFocus={() => setShowSuggestions(true)}
						onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
						onSubmitEditing={handleSubmitEditing}
						autoCorrect={false}
						autoCapitalize="none"
						returnKeyType="search"
						blurOnSubmit={false}
					/>
					{searchQuery ? (
						<Pressable onPress={() => setSearchQuery("")}>
							<MaterialCommunityIcons name="close-circle" size={18} color="#94a3b8" />
						</Pressable>
					) : null}
				</View>
				<CategoryFilter
					categories={categories}
					selected={selectedCategory}
					onSelect={setSelectedCategory}
				/>
				{showSuggestions && suggestions.length ? (
					<View style={styles.suggestions}>
						<FlatList
							keyboardShouldPersistTaps="handled"
							data={suggestions}
							keyExtractor={(item) => item.id}
							renderItem={({ item }) => (
								<Pressable style={styles.suggestionRow} onPress={() => handleSuggestionSelect(item)}>
									<Text style={styles.suggestionTitle}>{item.name ?? item.description ?? "Place"}</Text>
									<Text style={styles.suggestionMeta} numberOfLines={1}>
										{item._country} • {getCategoryMeta(item).label}
									</Text>
								</Pressable>
							)}
						/>
					</View>
				) : null}
			</View>
			
			<PlaceBottomSheet place={selectedPlace} />
			</View>
			);
}

const styles = StyleSheet.create({
	container: { flex: 1 },
	map: { flex: 1 },
	controls: {
		position: "absolute",
		left: 16,
		right: 16,
		gap: 12,
	},
	searchBar: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: "#fff",
		borderRadius: 999,
		paddingHorizontal: 16,
		paddingVertical: 10,
		borderWidth: 1,
		borderColor: "#e2e8f0",
		shadowColor: "#000",
		shadowOpacity: 0.08,
		shadowRadius: 6,
		shadowOffset: { width: 0, height: 2 },
		elevation: 4,
	},
	searchInput: {
		flex: 1,
		marginLeft: 10,
		color: "#0f172a",
	},
	suggestions: {
		marginTop: 4,
		backgroundColor: "#fff",
		borderRadius: 16,
		borderWidth: 1,
		borderColor: "#e2e8f0",
		maxHeight: 220,
		shadowColor: "#000",
		shadowOpacity: 0.08,
		shadowRadius: 8,
		shadowOffset: { width: 0, height: 4 },
		elevation: 6
	},
	suggestionRow: {
		paddingHorizontal: 16,
		paddingVertical: 12,
		borderBottomWidth: 1,
		borderBottomColor: "#f1f5f9"
	},
	suggestionTitle: { fontSize: 14, fontWeight: "600", color: "#0f172a" },
	suggestionMeta: { fontSize: 12, color: "#64748b", marginTop: 2 },
	markerWrapper: {
		alignItems: "center",
	},
	markerBubble: {
		padding: 6,
		borderRadius: 18,
		borderWidth: 2,
		borderColor: "#fff",
		shadowColor: "#000",
		shadowOpacity: 0.25,
		shadowOffset: { width: 0, height: 3 },
		shadowRadius: 4,
		elevation: 6,
		alignItems: "center",
		justifyContent: "center"
	},
	markerBubbleLogo: {
		padding: 0,
		borderWidth: 0,
		backgroundColor: "#fff"
	},
	markerPointer: {
		width: 0,
		height: 0,
		borderLeftWidth: 6,
		borderRightWidth: 6,
		borderTopWidth: 8,
		borderLeftColor: "transparent",
		borderRightColor: "transparent",
		marginTop: -1,
	},
	markerLogoFull: {
		width: 30,
		height: 30,
		borderRadius: 15
	}
});
