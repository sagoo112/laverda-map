import React from "react";
import { Text } from "react-native";
import { cleanup, render, screen, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { PlacesProvider, usePlaces } from "../src/features/places/PlacesProvider";
import { cacheKey, encodeCache, favoritesKey } from "../src/features/places/cache";
import { requestJson } from "../src/shared/api";

jest.mock("../src/shared/api", () => ({
  ...jest.requireActual("../src/shared/api"),
  API_URL: "https://api.test.invalid",
  requestJson: jest.fn(),
}));
const request = jest.mocked(requestJson);
const clients: QueryClient[] = [];
function Probe() {
  const state = usePlaces();
  return (
    <>
      <Text>{state.places.map((place) => place.name).join(", ")}</Text>
      <Text>{state.source}</Text>
      <Text>{state.error}</Text>
      <Text>{String(state.favoritesReady)}</Text>
    </>
  );
}
async function mount() {
  const client = new QueryClient();
  clients.push(client);
  return render(
    <QueryClientProvider client={client}>
      <PlacesProvider>
        <Probe />
      </PlacesProvider>
    </QueryClientProvider>,
  );
}
beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  request.mockReset();
});
afterEach(async () => {
  await cleanup();
  clients.splice(0).forEach((client) => client.clear());
});
test("successful API refresh persists public data and excludes private records", async () => {
  request.mockResolvedValue({
    entries: [
      { id: "live", name: "Fresh public entry", visibility: "public" },
      { id: "secret", name: "Not public", visibility: "private" },
    ],
  });
  await mount();
  expect(await screen.findByText("Fresh public entry")).toBeTruthy();
  expect(screen.queryByText("Not public")).toBeNull();
  const cached = JSON.parse((await AsyncStorage.getItem(cacheKey("https://api.test.invalid")))!);
  expect(cached.entries.map((entry: { id: string }) => entry.id)).toEqual(["live"]);
  expect(cached.fetchedAt).toBeTruthy();
});
test("malformed API responses retain restored last-good data", async () => {
  await AsyncStorage.setItem(
    cacheKey("https://api.test.invalid"),
    encodeCache({
      fetchedAt: "2020-01-01T00:00:00.000Z",
      entries: [{ id: "cached", name: "Cached place", visibility: "public" }],
    }),
  );
  request.mockResolvedValue({ wrong: "shape" });
  await mount();
  expect(await screen.findByText("Cached place")).toBeTruthy();
  await waitFor(() => expect(screen.getByText(/Invalid places response/)).toBeTruthy(), {
    timeout: 5000,
  });
  expect(screen.getByText("Cached place")).toBeTruthy();
});
test("bookmark storage read failure never overwrites unread bookmarks", async () => {
  jest
    .mocked(AsyncStorage.getItem)
    .mockResolvedValueOnce(null)
    .mockRejectedValueOnce(new Error("disk unavailable"));
  request.mockResolvedValue({ entries: [] });
  await mount();
  expect(await screen.findByText("live")).toBeTruthy();
  expect(screen.getByText("false")).toBeTruthy();
  expect(
    jest.mocked(AsyncStorage.setItem).mock.calls.filter(([key]) => key === favoritesKey),
  ).toEqual([]);
});

test("an offline-cache read failure does not block successfully restored bookmarks", async () => {
  await AsyncStorage.setItem(favoritesKey, JSON.stringify(["saved-place"]));
  jest.mocked(AsyncStorage.getItem).mockRejectedValueOnce(new Error("cache unavailable"));
  request.mockResolvedValue({ entries: [] });
  await mount();
  expect(await screen.findByText("live")).toBeTruthy();
  expect(screen.getByText("true")).toBeTruthy();
  expect(JSON.parse((await AsyncStorage.getItem(favoritesKey))!)).toEqual(["saved-place"]);
});
