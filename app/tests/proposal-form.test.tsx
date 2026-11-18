import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import ProposalForm from "../src/features/club/ProposalForm";
import { prepareEmail } from "../src/features/club/mail";
jest.mock("../src/features/club/mail", () => ({ prepareEmail: jest.fn() }));
afterEach(cleanup);
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(prepareEmail).mockResolvedValue(undefined);
});
test("required fields are checked before preparing a mail", async () => {
  await render(<ProposalForm onClose={jest.fn()} />);
  await fireEvent.press(screen.getByText("Prepare proposal email"));
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(prepareEmail).not.toHaveBeenCalled();
});
test("a complete proposal prepares an importable JSON attachment for review", async () => {
  await render(<ProposalForm onClose={jest.fn()} />);
  for (const [label, value] of [
    ["Your name *", "Example rider"],
    ["Your email *", "rider@example.org"],
    ["Place name *", "Example workshop"],
    ["Country code *", "CH"],
    ["Website", "https://example.org"],
  ]) {
    await fireEvent.changeText(screen.getByLabelText(label), value);
  }
  await fireEvent.press(screen.getByText("Prepare proposal email"));
  await waitFor(() => expect(prepareEmail).toHaveBeenCalled());
  const [, body, json] = jest.mocked(prepareEmail).mock.calls[0];
  expect(body).toContain("rider@example.org");
  expect(JSON.parse(json!).entries[0]).toMatchObject({
    name: "Example workshop",
    country: "CH",
    verified: false,
    visibility: "hidden",
  });
  expect(json).not.toContain("rider@example.org");
});
