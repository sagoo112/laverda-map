import React from "react";
import { AppState, Pressable, Text, TextInput } from "react-native";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as SecureStore from "expo-secure-store";
import { AuthProvider, useAuth } from "../src/features/auth/AuthProvider";
import AuthGate from "../src/features/auth/AuthGate";
import { ApiError, requestJson } from "../src/shared/api";

let mockUnauthorized: (() => void) | null = null;
jest.mock("../src/shared/api", () => ({
  ...jest.requireActual("../src/shared/api"),
  API_URL: "https://api.test.invalid",
  requestJson: jest.fn(),
  setAccessToken: jest.fn(),
  onUnauthorized: (callback: (() => void) | null) => {
    mockUnauthorized = callback;
  },
}));
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: "private",
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
const request = jest.mocked(requestJson);
const clients: QueryClient[] = [];
const session = {
  tenant: "laverda",
  token: "a".repeat(64),
  expiresAt: new Date(Date.now() + 3600000).toISOString(),
};
function Content() {
  const { signOut } = useAuth();
  const [draft, setDraft] = React.useState("");
  return (
    <>
      <Text>Protected directory</Text>
      <TextInput accessibilityLabel="Draft" value={draft} onChangeText={setDraft} />
      <Pressable onPress={() => void signOut()}>
        <Text>Leave</Text>
      </Pressable>
    </>
  );
}
async function mount() {
  const client = new QueryClient();
  clients.push(client);
  return render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <AuthGate>
          <Content />
        </AuthGate>
      </AuthProvider>
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  jest.clearAllMocks();
  request.mockReset();
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue(null);
  jest.mocked(SecureStore.setItemAsync).mockResolvedValue(undefined);
  jest.mocked(SecureStore.deleteItemAsync).mockResolvedValue(undefined);
});
afterEach(async () => {
  await cleanup();
  clients.splice(0).forEach((client) => client.clear());
});
test("incorrect password never unlocks or persists credentials", async () => {
  request.mockRejectedValue(new ApiError(401));
  await mount();
  await fireEvent.changeText(await screen.findByLabelText("Club password"), "wrong");
  await fireEvent.press(screen.getByText("Sign in"));
  expect(await screen.findByText("Incorrect club password.")).toBeTruthy();
  expect(screen.queryByText("Protected directory")).toBeNull();
  expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  expect(screen.getByLabelText("Club password").props.value).toBe("");
});
test("verified login stores only the token and logout hides the directory", async () => {
  request.mockResolvedValueOnce(session).mockResolvedValue({ status: "ok" });
  await mount();
  await fireEvent.changeText(await screen.findByLabelText("Club password"), "club passphrase");
  await fireEvent.press(screen.getByText("Sign in"));
  expect(await screen.findByText("Protected directory")).toBeTruthy();
  expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
    expect.any(String),
    session.token,
    expect.any(Object),
  );
  await fireEvent.press(screen.getByText("Leave"));
  expect(await screen.findByText("Sign in")).toBeTruthy();
  expect(screen.queryByText("Protected directory")).toBeNull();
  expect(SecureStore.deleteItemAsync).toHaveBeenCalled();
});
test("saved token requires online validation and network failure stays locked", async () => {
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue(session.token);
  request.mockRejectedValueOnce(new Error("offline"));
  await mount();
  expect(await screen.findByText("Verify access")).toBeTruthy();
  expect(screen.queryByText("Protected directory")).toBeNull();
  request.mockResolvedValue(session);
  await fireEvent.press(screen.getByText("Verify access"));
  expect(await screen.findByText("Protected directory")).toBeTruthy();
  await act(async () => {
    mockUnauthorized?.();
  });
  expect(await screen.findByText("Sign in")).toBeTruthy();
});
test("an expired saved session cannot unlock the app", async () => {
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue(session.token);
  request.mockResolvedValue({ ...session, expiresAt: "2020-01-01T00:00:00.000Z" });
  await mount();
  await waitFor(() => expect(SecureStore.deleteItemAsync).toHaveBeenCalled());
  expect(screen.queryByText("Protected directory")).toBeNull();
});

test("returning from the mail app verifies access without losing a draft", async () => {
  let notify: ((state: "active" | "background") => void) | undefined;
  const subscription = jest
    .spyOn(AppState, "addEventListener")
    .mockImplementation((_, listener) => {
      notify = listener;
      return { remove: jest.fn() };
    });
  try {
    jest.mocked(SecureStore.getItemAsync).mockResolvedValue(session.token);
    request.mockResolvedValue(session);
    await mount();
    await screen.findByText("Protected directory");
    await fireEvent.changeText(screen.getByLabelText("Draft"), "My proposed workshop");
    await act(async () => notify?.("background"));
    expect(screen.queryByText("Protected directory")).toBeNull();
    await act(async () => notify?.("active"));
    await screen.findByText("Protected directory");
    expect(screen.getByLabelText("Draft").props.value).toBe("My proposed workshop");
    expect(request).toHaveBeenCalledTimes(2);
  } finally {
    subscription.mockRestore();
  }
});
