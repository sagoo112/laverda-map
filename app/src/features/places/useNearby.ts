import { useRef, useState } from "react";
import { Alert } from "react-native";
import * as Location from "expo-location";
import type { Coordinates } from "./model";

export function useNearby() {
  const [origin, setOrigin] = useState<Coordinates | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  async function locate() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        Alert.alert(
          "Location is optional",
          "You can still search every place. Enable location in your device settings to sort nearby destinations.",
        );
        return;
      }
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const result = await Promise.race([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error("Location timed out")), 15000);
          }),
        ]);
        setOrigin({ latitude: result.coords.latitude, longitude: result.coords.longitude });
      } finally {
        clearTimeout(timer);
      }
    } catch {
      Alert.alert(
        "Location unavailable",
        "Check your device location settings and try again. You can still browse the directory.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return { origin, busy, locate, clear: () => setOrigin(null) };
}
