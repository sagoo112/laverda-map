import React from "react";
import { cleanup, render, screen } from "@testing-library/react-native";
import PlacesStatus from "../src/features/places/PlacesStatus";
import { usePlaces } from "../src/features/places/PlacesProvider";

jest.mock("../src/features/places/PlacesProvider", () => ({ usePlaces: jest.fn() }));
afterEach(cleanup);
const state: ReturnType<typeof usePlaces> = {
  places: [],
  loading: false,
  error: null,
  cachedAt: null,
  source: "api",
  sourceReady: true,
  setSource: jest.fn(),
  storageError: null,
  refresh: jest.fn(),
  favorites: [],
  toggleFavorite: jest.fn(),
  favoritesReady: true,
};
test("healthy live data does not add a status banner", async () => {
  jest.mocked(usePlaces).mockReturnValue(state);
  await render(<PlacesStatus compact />);
  expect(screen.queryByText("Online directory")).toBeNull();
});
test("a failed offline write never claims the live response was saved offline", async () => {
  jest
    .mocked(usePlaces)
    .mockReturnValue({ ...state, storageError: "Could not save offline data." });
  await render(<PlacesStatus compact />);
  expect(screen.getByText("Online directory")).toBeTruthy();
  expect(screen.getByText("Could not save offline data.")).toBeTruthy();
});
