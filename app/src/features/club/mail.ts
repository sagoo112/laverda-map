import * as MailComposer from "expo-mail-composer";
import { Directory, File, Paths } from "expo-file-system";
import { contactConfigured, contactEmail } from "./proposal";

export async function prepareEmail(subject: string, body: string, json?: string): Promise<void> {
  if (!(await MailComposer.isAvailableAsync()))
    throw new Error(
      "No email app is available. Set up an email account first. Your form remains available.",
    );
  let attachment: File | null = null;
  if (json) {
    // Fixed, bounded app-cache attachment; no user-controlled filesystem paths.
    attachment = new File(Paths.cache, "laverda-proposal-" + Date.now() + ".json");
    attachment.write(json);
  }
  try {
    await MailComposer.composeAsync({
      recipients: contactConfigured ? [contactEmail] : [],
      subject: subject.replace(/[\r\n]/g, " "),
      body:
        (!contactConfigured
          ? "RECIPIENT NOT CONFIGURED: please add the club email address before sending.\n\n"
          : "") + body,
      isHtml: false,
      attachments: attachment ? [attachment.uri] : [],
    });
    // Android cannot confirm delivery. Never claim the email was sent.
  } finally {
    // Android hands attachments to another app asynchronously. Keep the cached file
    // for at least 24 hours, rather than deleting it before that app reads it.
    // Cache cleanup must not turn a successfully opened draft into an error.
    try {
      for (const item of new Directory(Paths.cache).list()) {
        if (
          item instanceof File &&
          /^laverda-proposal-\d+\.json$/.test(item.name) &&
          Number(item.name.match(/\d+/)?.[0]) < Date.now() - 86400000 &&
          item.uri !== attachment?.uri
        )
          item.delete();
      }
    } catch {
      // The operating system may already have evicted cache files.
    }
  }
}
