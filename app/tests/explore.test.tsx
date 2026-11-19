import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
} from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { PlacesProvider, placesSourceKey } from "../src/features/places/PlacesProvider";
import ExploreScreen from "../src/features/places/ExploreScreen";
import ResourcesScreen from "../src/features/resources/ResourcesScreen";
import ClubScreen from "../src/features/club/ClubScreen";
import { Alert } from "react-native";
import * as Location from "expo-location";
import source from "../src/data/places.json";
import { requestJson } from "../src/shared/api";
import { favoritesKey } from "../src/features/places/cache";
import type { PlacesMapProps } from "../src/features/places/PlacesMap";

jest.mock("../src/shared/api", () => ({
  ...jest.requireActual("../src/shared/api"),
  API_URL: "https://api.test.invalid",
  requestJson: jest.fn(),
}));
jest.mock("../src/features/club/mail", () => ({ prepareEmail: jest.fn() }));
jest.mock("@react-navigation/native", () => ({ useFocusEffect: () => {} }));
let mockMapAvailable = false;
jest.mock("../src/features/places/PlacesMap", () => {
  const { Button } = require("react-native");
  const { groupMapPlaces } = jest.requireActual("../src/features/places/mapGroups");
  return {
    __esModule: true,
    get MAP_AVAILABLE() {
      return mockMapAvailable;
    },
    default: ({ places, onSelect }: PlacesMapProps) =>
      groupMapPlaces(places).map((group: PlacesMapProps["places"]) => (
        <Button
          key={group[0].id}
          title={group.length > 1 ? `${group.length} entries on map` : group[0].name}
          onPress={() => onSelect(group.map(({ id }) => id))}
        />
      )),
  };
});
jest.mock("@gorhom/bottom-sheet", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: React.forwardRef(
      ({ children }: { children: React.ReactNode }, _ref: React.ForwardedRef<unknown>) => (
        <View>{children}</View>
      ),
    ),
    BottomSheetScrollView: View,
    BottomSheetBackdrop: View,
  };
});
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
  mockMapAvailable = false;
  await AsyncStorage.clear();
  jest.clearAllMocks();
  jest.mocked(requestJson).mockResolvedValue(source);
});

test("a shared map marker offers both entries and opens the chosen details", async () => {
  mockMapAvailable = true;
  const club = source.entries.find((entry) => entry.id === "www-laverdaclub-ch-82bbf1")!;
  const workshop = source.entries.find(
    (entry) => entry.id === "laverda-werkstatt-peter-strasser-c84b94",
  )!;
  jest.mocked(requestJson).mockResolvedValue({
    entries: [{ ...club, location: workshop.location }, workshop],
  });
  await AsyncStorage.setItem(placesSourceKey, "api");
  const user = userEvent.setup();
  await mount(<ExploreScreen />);
  const marker = await screen.findByRole("button", { name: "2 entries on map" });
  for (const [place, category] of [
    [workshop, "Workshops"],
    [club, "Clubs"],
  ] as const) {
    await user.press(marker);
    expect(screen.getByRole("header", { name: "2 places here" })).toBeTruthy();
    await user.press(screen.getByRole("button", { name: `${place.name}, ${category}` }));
    expect(screen.getByRole("header", { name: place.name })).toBeTruthy();
    expect(screen.queryByRole("header", { name: "2 places here" })).toBeNull();
    await user.press(screen.getByRole("button", { name: "Close place details" }));
  }
});
test("local directory supports search and saved filtering without signing in", async () => {
  const user = userEvent.setup();
  await mount(<ExploreScreen />);
  expect(screen.queryByText(/password/i)).toBeNull();
  await user.press(screen.getByRole("button", { name: "List view" }));
  await user.type(screen.getByLabelText("Search places"), "Ibach");
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
test("Explore hides forums and registries by default but keeps bookmarked resources reachable", async () => {
  const registry = source.entries.find((entry) => entry.type === "registry")!;
  await AsyncStorage.setItem(favoritesKey, JSON.stringify([registry.id]));
  const user = userEvent.setup();
  await mount(<ExploreScreen />);

  expect(screen.queryByRole("button", { name: "Forums" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Registries" })).toBeNull();
  await user.type(screen.getByLabelText("Search places"), "Atlas Owners Registry");
  expect(screen.getByText("No places found")).toBeTruthy();

  await user.press(screen.getByRole("button", { name: "Saved places" }));
  expect(await screen.findByRole("button", { name: `View ${registry.name}` })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Forums" })).toBeNull();
});
test("resources support search, type filters and one-tap reset", async () => {
  const user = userEvent.setup();
  await mount(<ResourcesScreen />);
  expect(screen.getByRole("button", { name: "Registries" })).toBeTruthy();
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
  expect(screen.getByText("30 places")).toBeTruthy();
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
  expect(screen.getByText("30 places")).toBeTruthy();
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

test("Club settings switch from local data to the API and back", async () => {
  await mount(<ClubScreen />);
  const name = "Use online API";
  const localSwitch = await screen.findByRole("switch", { name, checked: false, disabled: false });
  expect(screen.getByText("Using local places.json")).toBeTruthy();
  expect(requestJson).not.toHaveBeenCalled();
  await fireEvent(localSwitch, "valueChange", true);
  const onlineSwitch = await screen.findByRole("switch", { name, checked: true });
  await waitFor(() => expect(requestJson).toHaveBeenCalledTimes(1));
  await fireEvent(onlineSwitch, "valueChange", false);
  expect(screen.getByText("Using local places.json")).toBeTruthy();
});
