import { Alert, Linking } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { webUrl } from "./urls";

export async function openWebsite(value?: string | null) {
  const url = webUrl(value);
  if (!url) {
    Alert.alert("Website unavailable", "No valid website address is available.");
    return;
  }
  try {
    await WebBrowser.openBrowserAsync(url);
  } catch {
    Alert.alert("Could not open website", "Please check your connection and try again.");
  }
}
export async function openNavigation(value: string) {
  const url = webUrl(value);
  if (!url) return;
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert(
      "Could not open directions",
      "Please check that a maps app or browser is available.",
    );
  }
}
