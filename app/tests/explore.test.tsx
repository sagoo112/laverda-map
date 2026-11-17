import React from "react";
import { cleanup, render, screen, userEvent } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { PlacesProvider } from "../src/features/places/PlacesProvider";
import ExploreScreen from "../src/features/places/ExploreScreen";
import ResourcesScreen from "../src/features/resources/ResourcesScreen";
import ClubScreen from "../src/features/club/ClubScreen";
import { Alert } from "react-native";
import * as Location from "expo-location";
import { favoritesKey } from "../src/features/places/cache";

jest.mock("@react-navigation/native", () => ({ useFocusEffect: () => {} }));
jest.mock("../src/features/places/PlacesMap", () => ({
  __esModule: true,
  default: () => null,
  MAP_AVAILABLE: false,
}));
jest.mock("../src/features/places/PlaceDetailsSheet", () => () => null);
jest.mock("expo-location", () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { Balanced: 3 },
}));
const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};
const clients: QueryClient[] = [];
afterEach(async () => {
  await cleanup();
  clients.splice(0).forEach((client) => client.clear());
});
async function mount(child: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(client);
  return render(
    <SafeAreaProvider initialMetrics={metrics}>
      <QueryClientProvider client={client}>
        <PlacesProvider>{child}</PlacesProvider>
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
}
beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});
test("cold offline launch opens directory; search and saved filtering work", async () => {
  const user = userEvent.setup();
  await mount(<ExploreScreen />);
  expect(screen.queryByText(/password/i)).toBeNull();
  await user.press(screen.getByRole("button", { name: "List view" }));
  await user.type(screen.getByLabelText("Search places"), "Eggenwil");
  const name = "LAVERDA Club Schweiz - LCS (CH)";
  expect(screen.getByRole("button", { name: "View " + name })).toBeTruthy();
  await user.press(screen.getByRole("button", { name: "Save " + name }));
  await user.press(screen.getByRole("button", { name: "Saved places" }));
  expect(screen.getByRole("button", { name: "View " + name })).toBeTruthy();
  await user.press(screen.getByRole("button", { name: "Unsave " + name }));
  expect(await screen.findByText("No saved matches")).toBeTruthy();
});
test("bookmarks restored from device storage are available after relaunch", async () => {
  await AsyncStorage.setItem(favoritesKey, JSON.stringify(["www-laverdaclub-ch-82bbf1"]));
  const user = userEvent.setup();
  await mount(<ExploreScreen />);
  await user.press(screen.getByRole("button", { name: "List view" }));
  await user.press(screen.getByRole("button", { name: "Saved places" }));
  expect(
    await screen.findByRole("button", { name: "Unsave LAVERDA Club Schweiz - LCS (CH)" }),
  ).toBeTruthy();
});
test("resources support search, type filters and one-tap reset", async () => {
  const user = userEvent.setup();
  await mount(<ResourcesScreen />);
  await user.press(screen.getByRole("button", { name: "Forums" }));
  await user.type(screen.getByLabelText("Search resources"), "no-such-resource-xyz");
  expect(screen.getByText("No resources found")).toBeTruthy();
  await user.press(screen.getByRole("button", { name: "Clear filters" }));
  expect(screen.getByText("13 independent websites")).toBeTruthy();
  expect(screen.queryByText(/^Updated /)).toBeNull();
});
test("missing map configuration opens the usable list; empty filters can be reset", async () => {
  const user = userEvent.setup();
  await mount(<ExploreScreen />);
  expect(screen.getByRole("button", { name: "List view", selected: true })).toBeTruthy();
  await user.type(screen.getByLabelText("Search places"), "no-matches-xyz");
  expect(screen.getByText("No places found")).toBeTruthy();
  await user.press(screen.getByRole("button", { name: "Clear filters" }));
  expect(screen.getByText("33 places")).toBeTruthy();
});
test("nearby permission is only requested on a tap and denial keeps browsing available", async () => {
  const user = userEvent.setup();
  const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  jest
    .mocked(Location.requestForegroundPermissionsAsync)
    .mockResolvedValue({ status: "denied" } as Location.LocationPermissionResponse);
  await mount(<ExploreScreen />);
  expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  await user.press(screen.getByRole("button", { name: "Near me" }));
  expect(alert).toHaveBeenCalledWith("Location is optional", expect.any(String));
  expect(screen.getByText("33 places")).toBeTruthy();
  expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
  alert.mockRestore();
});
test("Club privacy information can be expanded without leaving the page", async () => {
  const user = userEvent.setup();
  await mount(<ClubScreen />);
  expect(screen.queryByText(/Location is optional/)).toBeNull();
  await user.press(screen.getByRole("button", { name: "Offline & privacy" }));
  expect(screen.getByText(/Location is optional/)).toBeTruthy();
  expect(screen.getByRole("button", { name: "Offline & privacy", expanded: true })).toBeTruthy();
});
