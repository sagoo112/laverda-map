import React from "react";
import { cleanup, render, screen, userEvent } from "@testing-library/react-native";
import PlaceDetailsSheet from "../src/features/places/PlaceDetailsSheet";
import { normalizePlaces } from "../src/features/places/model";
import { parseEntries } from "../src/features/places/schema";
import source from "./fixtures/places.generated.json";
import { openNavigation, openWebsite } from "../src/shared/links";

jest.mock("../src/shared/links", () => ({ openNavigation: jest.fn(), openWebsite: jest.fn() }));
jest.mock("../src/features/places/PlacesProvider", () => ({
  usePlaces: () => ({ favorites: [], toggleFavorite: jest.fn(), favoritesReady: true }),
}));
jest.mock("@gorhom/bottom-sheet", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: React.forwardRef(
      ({ children }: { children: React.ReactNode }, _ref: React.ForwardedRef<unknown>) =>
        React.createElement(View, null, children),
    ),
    BottomSheetScrollView: View,
    BottomSheetBackdrop: View,
  };
});
const places = normalizePlaces(parseEntries(source));
beforeEach(() => jest.clearAllMocks());
afterEach(cleanup);

test("details retain checked dates and navigation while save/expand/close stay accessible", async () => {
  const place = places.find((item) => item.navigationUrl && item.lastCheckedAt)!;
  const close = jest.fn();
  const user = userEvent.setup();
  await render(<PlaceDetailsSheet place={place} onClose={close} />);
  expect(screen.getByText("Last checked " + place.lastCheckedAt)).toBeTruthy();
  expect(screen.queryByText(/^Updated /)).toBeNull();
  expect(screen.getByRole("button", { name: "Save place" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Expand details" })).toBeTruthy();
  await user.press(screen.getByRole("button", { name: "Navigate" }));
  expect(openNavigation).toHaveBeenCalledWith(place.navigationUrl);
  await user.press(screen.getByRole("button", { name: "Close place details" }));
  expect(close).toHaveBeenCalledTimes(1);
});
test("online resources offer a website but never misleading navigation", async () => {
  const place = places.find((item) => item.type === "blog" && item.url)!;
  const user = userEvent.setup();
  await render(<PlaceDetailsSheet place={place} onClose={() => {}} />);
  expect(screen.queryByRole("button", { name: "Navigate" })).toBeNull();
  await user.press(screen.getByRole("button", { name: "Visit website" }));
  expect(openWebsite).toHaveBeenCalledWith(place.url);
});
