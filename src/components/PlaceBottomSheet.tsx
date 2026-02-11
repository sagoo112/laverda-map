import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Linking,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { MapItem } from "../utils/normalizeEntries";
import { openNavigation, openInNativeMaps } from "../utils/openMaps";

type Props = {
  visible: boolean;
  item: MapItem | null;
  onClose: () => void;
};

const SCREEN_H = Dimensions.get("window").height;

export default function PlaceBottomSheet({ visible, item, onClose }: Props) {
  const sheetH = Math.min(Math.round(SCREEN_H * 0.45), 520);

  // translateY: 0 = open, sheetH = closed
  const baseY = useRef(new Animated.Value(sheetH)).current;
  const dragY = useRef(new Animated.Value(0)).current;

  const translateY = Animated.add(baseY, dragY).interpolate({
    inputRange: [0, sheetH],
    outputRange: [0, sheetH],
    extrapolate: "clamp"
  });

  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    if (visible) {
      setIsMounted(true);
      Animated.timing(baseY, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true
      }).start();
    } else {
      Animated.timing(baseY, {
        toValue: sheetH,
        duration: 180,
        useNativeDriver: true
      }).start(({ finished }) => {
        if (finished) setIsMounted(false);
      });
    }
  }, [visible, sheetH, baseY]);

  const pan = useMemo(() => {
    return PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 6,
      onPanResponderMove: (_, g) => {
        dragY.setValue(Math.max(0, g.dy));
      },
      onPanResponderRelease: (_, g) => {
        const shouldClose = g.dy > sheetH * 0.25 || g.vy > 1.1;

        if (shouldClose) {
          dragY.setValue(0);
          onClose();
          return;
        }

        Animated.spring(dragY, {
          toValue: 0,
          useNativeDriver: true
        }).start();
      }
    });
  }, [dragY, onClose, sheetH]);

  if (!isMounted) return null;

  const title = item ? (item.description?.trim() || item.url) : "";
  const subtitle = item
    ? `${item._type} • ${item._country} • ${item.location?.mode ?? "country-centroid"}`
    : "";

  const isCentroid = (item?.location?.mode ?? "country-centroid") === "country-centroid";

  return (
    <Animated.View
      style={[styles.wrap, { height: sheetH, transform: [{ translateY }] }]}
      pointerEvents="auto"
    >
      <View {...pan.panHandlers} style={styles.grabberArea}>
        <View style={styles.grabber} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title} numberOfLines={2}>{title}</Text>
        <Text style={styles.meta}>{subtitle}</Text>

        {item?.tags?.length ? <Text style={styles.block}>Tags: {item.tags.join(", ")}</Text> : null}
        {typeof item?.verified === "boolean" ? <Text style={styles.block}>Verified: {String(item.verified)}</Text> : null}
        {item?.lastCheckedAt ? <Text style={styles.block}>Last checked: {item.lastCheckedAt}</Text> : null}

        {item ? (
          <Text style={styles.block}>
            Coordinates: {item._lat.toFixed(5)}, {item._lng.toFixed(5)}
          </Text>
        ) : null}

        {isCentroid ? (
          <Text style={styles.hint}>
            This is a country-centroid marker (no precise address). Navigation is disabled.
          </Text>
        ) : null}

        <View style={styles.buttons}>
          {item?.url ? (
            <View style={styles.btnOutline} onTouchEnd={() => Linking.openURL(item.url)}>
              <Text style={styles.btnOutlineText}>Open Website</Text>
            </View>
          ) : null}

          {!isCentroid && item ? (
            <View
              style={styles.btn}
              onTouchEnd={() => openNavigation({ navigationUrl: item._navigationUrl, lat: item._lat, lng: item._lng })}
            >
              <Text style={styles.btnText}>Navigate</Text>
            </View>
          ) : null}

          {!isCentroid && item ? (
            <View
              style={styles.btnOutline}
              onTouchEnd={() => openInNativeMaps({ lat: item._lat, lng: item._lng, label: title })}
            >
              <Text style={styles.btnOutlineText}>Open in Maps</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "white",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    borderColor: "#ddd",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -3 },
    elevation: 8
  },
  grabberArea: {
    paddingTop: 10,
    paddingBottom: 6,
    alignItems: "center"
  },
  grabber: {
    width: 44,
    height: 5,
    borderRadius: 99,
    backgroundColor: "#cfcfcf"
  },
  content: {
    paddingHorizontal: 14,
    paddingBottom: 18,
    gap: 8
  },
  title: { fontSize: 18, fontWeight: "900" },
  meta: { color: "#666", fontSize: 12 },
  block: { fontSize: 13, lineHeight: 18 },
  hint: { fontSize: 12, color: "#666", lineHeight: 16 },

  buttons: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 8 },

  // using View + onTouchEnd to avoid press issues inside some animated contexts
  btn: {
    backgroundColor: "#111",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12
  },
  btnText: { color: "white", fontWeight: "900" },

  btnOutline: {
    borderWidth: 1,
    borderColor: "#111",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12
  },
  btnOutlineText: { color: "#111", fontWeight: "900" }
});
