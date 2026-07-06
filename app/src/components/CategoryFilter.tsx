import React from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, Image } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { getCategoryMetaByKey } from "../utils/placeCategories";

type Props = {
	categories: string[];
	selected: string;
	onSelect: (category: string) => void;
};

export default function CategoryFilter({ categories, selected, onSelect }: Props) {
	return (
				<View style={styles.container}>
				<ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				contentContainerStyle={styles.scrollContent}
			>
				{categories.map((cat) => {
					const isActive = cat === selected;
					const meta =
						  cat === "all"
						  ? { label: "All", color: "#0f172a", icon: "map-marker-radius" }
						  : getCategoryMetaByKey(cat);
					const showLogo = (meta as any).key === "club" && (meta as any).iconImage;
					
					return (
						<Pressable
						key={cat}
							style={[
									styles.chip,
									{ borderColor: meta.color },
									isActive && { backgroundColor: meta.color }
									]}
							onPress={() => onSelect(cat)}
							>
						<View style={styles.chipContent}>
						{showLogo ? (
							<Image
								source={(meta as any).iconImage}
								style={[styles.logoIcon, { borderColor: isActive ? "#fff" : meta.color }]}
							/>
						) : (
						<MaterialCommunityIcons
						name={meta.icon as any}
						size={14}
						color={isActive ? "#fff" : meta.color}
						style={styles.chipIcon}
						/>
						)}
						<Text style={[styles.text, { color: isActive ? "#fff" : meta.color }]}>
						{meta.label}
						</Text>
						</View>
						</Pressable>
						);
				})}
			</ScrollView>
			</View>
			);
}

const styles = StyleSheet.create({
		container: {},
	scrollContent: {
		paddingHorizontal: 12,
	},
		chip: {
			paddingHorizontal: 16,
			paddingVertical: 9,
			borderRadius: 999,
			marginRight: 8,
			borderWidth: 1.2,
			backgroundColor: "#fff",
			shadowColor: "#000",
			shadowOpacity: 0.08,
			shadowRadius: 6,
			shadowOffset: { width: 0, height: 2 },
			elevation: 3,
		},
	chipContent: {
		flexDirection: "row",
		alignItems: "center",
	},
	chipIcon: { marginRight: 4 },
	logoIcon: {
		width: 16,
		height: 16,
		borderRadius: 8,
		marginRight: 4,
		borderWidth: 1,
	},
	text: {
		fontSize: 12,
		fontWeight: "700",
	},
	});
