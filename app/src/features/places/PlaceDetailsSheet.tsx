import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BackHandler, StyleSheet, Text, View } from "react-native";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { type Place, isMappable, isOnlineResource, locationLabel } from "./model";
import { usePlaces } from "./PlacesProvider";
import { categories } from "./categories";
import { Button, IconButton, TextAction } from "../../shared/ui";
import { colors, space, ui } from "../../shared/theme";
import { openNavigation, openWebsite } from "../../shared/links";

export default function PlaceDetailsSheet({
  place,
  onClose,
}: {
  place: Place;
  onClose: () => void;
}) {
  const sheet = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ["45%", "90%"], []);
  const { favorites, toggleFavorite, favoritesReady } = usePlaces();
  const saved = favorites.includes(place.id);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      onClose();
      return true;
    });
    return () => subscription.remove();
  }, [onClose]);
  const backdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
      />
    ),
    [],
  );
  return (
    <BottomSheet
      ref={sheet}
      index={0}
      snapPoints={snapPoints}
      enableDynamicSizing={false}
      enablePanDownToClose
      onClose={onClose}
      onChange={(index) => setExpanded(index === 1)}
      backdropComponent={backdrop}
      backgroundStyle={{ backgroundColor: colors.surface }}
      handleIndicatorStyle={{ backgroundColor: colors.border }}
    >
      <BottomSheetScrollView contentContainerStyle={styles.content} accessibilityViewIsModal>
        <View style={styles.header}>
          <Text style={[ui.caption, { flex: 1 }]}>{categories[place.type].label}</Text>
          <IconButton
            label={saved ? "Remove from saved" : "Save place"}
            icon={saved ? "bookmark" : "bookmark-outline"}
            selected={saved}
            disabled={!favoritesReady}
            onPress={() => toggleFavorite(place.id)}
          />
          <IconButton
            label={expanded ? "Collapse details" : "Expand details"}
            icon={expanded ? "chevron-down" : "chevron-up"}
            onPress={() => sheet.current?.snapToIndex(expanded ? 0 : 1)}
          />
          <IconButton label="Close place details" icon="close" onPress={onClose} />
        </View>
        <Text accessibilityRole="header" style={ui.heading}>
          {place.name}
        </Text>
        <Text style={ui.caption}>{locationLabel(place)}</Text>
        {place.address && <Text style={ui.body}>{place.address}</Text>}
        {place.location?.mode === "approx" && (
          <Text style={styles.notice}>
            Approximate location. Confirm the address before travelling.
          </Text>
        )}
        {place.navigationUrl && (
          <Button
            title="Navigate"
            icon="directions"
            onPress={() => void openNavigation(place.navigationUrl!)}
          />
        )}
        {place.url && !place.navigationUrl && (
          <Button
            title="Visit website"
            icon="open-in-new"
            onPress={() => void openWebsite(place.url)}
          />
        )}
        {place.url && place.navigationUrl && (
          <TextAction
            title="Visit website"
            icon="open-in-new"
            onPress={() => void openWebsite(place.url)}
          />
        )}
        {!isOnlineResource(place) && !isMappable(place) && (
          <Text style={styles.notice}>
            No precise destination is available. Check the website before planning a visit.
          </Text>
        )}
        {place.description && <Text style={ui.body}>{place.description}</Text>}
        {place.tags.length > 0 && <Text style={ui.caption}>{place.tags.join(" · ")}</Text>}
        {place.lastCheckedAt && <Text style={ui.caption}>Last checked {place.lastCheckedAt}</Text>}
        <Text style={ui.caption}>
          Always confirm opening hours and visiting arrangements before travelling.
        </Text>
      </BottomSheetScrollView>
    </BottomSheet>
  );
}
const styles = StyleSheet.create({
  content: { paddingHorizontal: space.xl, paddingBottom: space.xxl, gap: space.md },
  header: { flexDirection: "row", alignItems: "center" },
  notice: {
    ...ui.body,
    color: colors.notice,
  },
});
