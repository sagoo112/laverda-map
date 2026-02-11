import { Linking, Platform } from "react-native";

export function googleDirectionsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

/** Open a navigation URL (or default Google directions to lat/lng). */
export async function openNavigation(params: { navigationUrl?: string; lat: number; lng: number }) {
  const url = params.navigationUrl ?? googleDirectionsUrl(params.lat, params.lng);
  await Linking.openURL(url);
}

/**
 * Open the platform-native maps app.
 * - Android: geo: intent
 * - iOS: Apple Maps
 */
export async function openInNativeMaps(params: { lat: number; lng: number; label?: string }) {
  const { lat, lng, label } = params;

  if (Platform.OS === "android") {
    const q = label ? `${lat},${lng}(${encodeURIComponent(label)})` : `${lat},${lng}`;
    await Linking.openURL(`geo:${lat},${lng}?q=${q}`);
    return;
  }

  await Linking.openURL(`http://maps.apple.com/?daddr=${lat},${lng}`);
}
