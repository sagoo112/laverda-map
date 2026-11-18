import React, { useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Button } from "../../shared/ui";
import { colors, space, ui } from "../../shared/theme";
import { categories } from "../places/categories";
import { placeTypes } from "../places/schema";
import { createProposal, emptyProposal, type ProposalForm as Form } from "./proposal";
import { prepareEmail } from "./mail";

const fields: {
  key: keyof Form;
  label: string;
  hint?: string;
  multiline?: boolean;
  max?: number;
}[] = [
  { key: "senderName", label: "Your name *", max: 200 },
  { key: "senderEmail", label: "Your email *", max: 254 },
  { key: "name", label: "Place name *", max: 500 },
  { key: "country", label: "Country code *", hint: "CH, DE, IT…", max: 2 },
  { key: "url", label: "Website", hint: "https://…" },
  { key: "description", label: "Description", multiline: true },
  { key: "address", label: "Address", multiline: true },
  { key: "category", label: "Category description", max: 100 },
  { key: "tags", label: "Tags", hint: "Comma-separated; up to 20 tags" },
  { key: "latitude", label: "Latitude", hint: "For example 46.948" },
  { key: "longitude", label: "Longitude", hint: "For example 7.447" },
  { key: "locationLabel", label: "Location label" },
  { key: "locationSource", label: "Coordinate source", max: 100 },
  { key: "navigationUrl", label: "Navigation URL", hint: "Optional https:// link" },
  { key: "linkType", label: "Link type", max: 100 },
  { key: "priority", label: "Priority", max: 12 },
  {
    key: "lastCheckedAt",
    label: "Last checked",
    hint: "YYYY-MM-DD; leave empty if unknown",
    max: 10,
  },
];
export default function ProposalForm({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState<Form>({ ...emptyProposal });
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const update = (key: keyof Form, value: string) => {
    setForm((current) => ({
      ...current,
      [key]: value,
      ...(key === "mode" && value === "none"
        ? { latitude: "", longitude: "", locationLabel: "", locationSource: "" }
        : {}),
    }));
    setPreview(null);
    setError(null);
  };
  const draft = async () => {
    setError(null);
    let proposal;
    try {
      proposal = createProposal(form);
      setPreview(proposal.json);
    } catch (failure) {
      setError(
        failure instanceof Error && !failure.message.startsWith("[")
          ? failure.message
          : "Check the required fields, country code, links, date and coordinate ranges.",
      );
      return;
    }
    setBusy(true);
    try {
      await prepareEmail(
        "Laverda entry proposal: " + proposal.entry.name,
        "Please review this entry before publication.\nFrom: " +
          proposal.sender.name +
          " <" +
          proposal.sender.email +
          ">\n\n" +
          "A places.json-compatible JSON file is attached. The entry is hidden, pending and unverified until approved.\n\n" +
          proposal.json,
        proposal.json,
      );
      Alert.alert(
        "Email draft opened",
        "Review the recipient and attachment in your email app, then send it there. Delivery is not confirmed by this app.",
      );
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "The email draft could not be opened.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={[ui.section, { gap: space.md }]}>
      <Text accessibilityRole="header" style={ui.heading}>
        Suggest a new entry
      </Text>
      <Text style={ui.body}>
        Fill in what you know. Required fields have *. Nothing is published automatically. Your
        contact details appear in the email only, outside the directory JSON.
      </Text>
      <Text style={ui.caption}>Entry type</Text>
      <ScrollView horizontal contentContainerStyle={{ gap: space.sm }}>
        {placeTypes.map((type) => (
          <Pressable
            key={type}
            accessibilityRole="button"
            accessibilityLabel={categories[type].label}
            accessibilityState={{ selected: form.type === type }}
            onPress={() => update("type", type)}
            style={{
              padding: space.md,
              borderRadius: 12,
              backgroundColor: form.type === type ? colors.subtle : colors.surface,
            }}
          >
            <Text style={ui.body}>{categories[type].label}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <Text style={ui.caption}>Map location</Text>
      <View style={ui.row}>
        {(["none", "exact", "approx"] as const).map((mode) => (
          <Pressable
            key={mode}
            accessibilityRole="button"
            accessibilityState={{ selected: form.mode === mode }}
            onPress={() => update("mode", mode)}
            style={{
              padding: space.md,
              backgroundColor: form.mode === mode ? colors.subtle : colors.surface,
            }}
          >
            <Text style={ui.body}>
              {mode === "none" ? "No coordinates" : mode === "exact" ? "Exact" : "Approximate"}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={ui.caption}>Include a website or address so the club can verify the entry.</Text>
      <Button
        title={advanced ? "Fewer details" : "More details (optional)"}
        secondary
        onPress={() => setAdvanced(!advanced)}
      />
      {fields
        .filter(
          (field) =>
            (advanced ||
              ![
                "category",
                "locationSource",
                "navigationUrl",
                "linkType",
                "priority",
                "lastCheckedAt",
              ].includes(field.key)) &&
            (form.mode !== "none" ||
              !["latitude", "longitude", "locationLabel", "locationSource"].includes(field.key)),
        )
        .map((field) => (
          <View key={field.key} style={{ gap: space.xs }}>
            <Text style={ui.caption}>{field.label}</Text>
            <TextInput
              accessibilityLabel={field.label}
              placeholder={field.hint}
              placeholderTextColor={colors.muted}
              value={form[field.key]}
              onChangeText={(value) => update(field.key, value)}
              multiline={field.multiline}
              maxLength={field.max ?? 2000}
              autoCapitalize={
                field.key === "country"
                  ? "characters"
                  : field.key === "senderEmail" || field.key.toLowerCase().includes("url")
                    ? "none"
                    : "sentences"
              }
              autoCorrect={false}
              keyboardType={field.key === "senderEmail" ? "email-address" : "default"}
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                padding: space.md,
                color: colors.ink,
                minHeight: field.multiline ? 90 : 48,
                textAlignVertical: "top",
              }}
            />
          </View>
        ))}
      {error && (
        <Text accessibilityRole="alert" style={ui.body}>
          {error}
        </Text>
      )}
      <Button
        title="Prepare proposal email"
        icon="email-outline"
        busy={busy}
        onPress={() => void draft()}
      />
      {preview && (
        <>
          <Text style={ui.caption}>
            Review JSON · select text to copy if no mail app is available
          </Text>
          <Text selectable style={[ui.caption, { fontFamily: "monospace" }]}>
            {preview}
          </Text>
        </>
      )}
      <Button title="Close proposal" secondary onPress={onClose} disabled={busy} />
    </View>
  );
}
