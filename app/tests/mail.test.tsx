import * as MailComposer from "expo-mail-composer";
import { File } from "expo-file-system";
import { prepareEmail } from "../src/features/club/mail";

let mockFiles: File[] = [];
let mockCleanupFails = false;
jest.mock("expo-mail-composer", () => ({
  isAvailableAsync: jest.fn(),
  composeAsync: jest.fn(),
  MailComposerStatus: { UNDETERMINED: "undetermined" },
}));
jest.mock("expo-file-system", () => ({
  Paths: { cache: "file:///cache/" },
  File: class {
    name: string;
    uri: string;
    write = jest.fn();
    delete = jest.fn();
    constructor(root: string, name: string) {
      this.name = name;
      this.uri = root + name;
      mockFiles.push(this as unknown as File);
    }
  },
  Directory: class {
    list() {
      if (mockCleanupFails) throw new Error("Cache unavailable");
      return mockFiles;
    }
  },
}));
jest.mock("../src/features/club/proposal", () => ({
  contactEmail: "kontakt@example.org",
  contactConfigured: false,
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockFiles = [];
  mockCleanupFails = false;
  jest.mocked(MailComposer.isAvailableAsync).mockResolvedValue(true);
  jest.mocked(MailComposer.composeAsync).mockResolvedValue({
    status: MailComposer.MailComposerStatus.UNDETERMINED,
  });
});

test("missing mail app fails without creating an attachment", async () => {
  jest.mocked(MailComposer.isAvailableAsync).mockResolvedValue(false);
  await expect(prepareEmail("Subject", "Body", "{}")).rejects.toThrow("No email app");
  expect(mockFiles).toHaveLength(0);
  expect(MailComposer.composeAsync).not.toHaveBeenCalled();
});

test("placeholder drafts have no recipient and retain their JSON attachment", async () => {
  const old = new File("file:///cache/", "laverda-proposal-1.json");
  await prepareEmail("Proposal\r\nSubject", "Review this place", '{"entries":[]}');
  const attachment = mockFiles[1];
  expect(attachment.write).toHaveBeenCalledWith('{"entries":[]}');
  expect(MailComposer.composeAsync).toHaveBeenCalledWith(
    expect.objectContaining({
      recipients: [],
      subject: "Proposal  Subject",
      attachments: [attachment.uri],
      isHtml: false,
    }),
  );
  expect(old.delete).toHaveBeenCalled();
  expect(attachment.delete).not.toHaveBeenCalled();
});

test("cleanup errors do not report an opened draft as a failure", async () => {
  mockCleanupFails = true;
  await expect(prepareEmail("Contact", "Hello")).resolves.toBeUndefined();
  expect(MailComposer.composeAsync).toHaveBeenCalledTimes(1);
});
