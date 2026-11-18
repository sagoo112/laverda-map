import { z } from "zod";
import { placeDtoSchema, type PlaceDto, type PlaceType } from "../places/schema";
import { webUrl } from "../../shared/urls";

export const contactEmail = process.env.EXPO_PUBLIC_CONTACT_EMAIL?.trim() || "kontakt@example.org";
export const contactConfigured =
  /^[^\s@?&#]+@[^\s@?&#]+\.[^\s@?&#]+$/.test(contactEmail) &&
  !/@(?:example\.(?:org|com|net)|[^@]*\.invalid)$/i.test(contactEmail);
export type ProposalForm = {
  senderName: string;
  senderEmail: string;
  type: PlaceType;
  category: string;
  name: string;
  description: string;
  address: string;
  country: string;
  url: string;
  tags: string;
  latitude: string;
  longitude: string;
  mode: "none" | "exact" | "approx";
  locationLabel: string;
  navigationUrl: string;
  locationSource: string;
  linkType: string;
  priority: string;
  lastCheckedAt: string;
};
export const emptyProposal: ProposalForm = {
  senderName: "",
  senderEmail: "",
  type: "club",
  category: "",
  name: "",
  description: "",
  address: "",
  country: "",
  url: "",
  tags: "",
  latitude: "",
  longitude: "",
  mode: "none",
  locationLabel: "",
  navigationUrl: "",
  locationSource: "",
  linkType: "",
  priority: "0",
  lastCheckedAt: "",
};
const optional = (value: string, max = 2000) => z.string().max(max).parse(value.trim()) || null;
function url(value: string): string | null {
  const text = optional(value);
  if (text && !webUrl(text))
    throw new Error("Use complete http:// or https:// links without embedded passwords.");
  return text;
}
export function createProposal(
  form: ProposalForm,
  id = "proposal-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10),
) {
  const sender = {
    name: z.string().trim().min(1).max(200).parse(form.senderName),
    email: z.email().max(254).parse(form.senderEmail.trim()),
  };
  const name = z.string().trim().min(1).max(500).parse(form.name);
  if (!form.url.trim() && !form.address.trim()) {
    throw new Error("Add a website or address so the club can verify the place.");
  }
  const country = z
    .string()
    .regex(/^[A-Z]{2}$/)
    .parse(form.country.trim().toUpperCase());
  const tags = [
    ...new Set(
      form.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  ];
  z.array(z.string().max(100)).max(20).parse(tags);
  const hasCoords = !!form.latitude.trim() || !!form.longitude.trim();
  if (
    (form.mode === "none" && hasCoords) ||
    (form.mode !== "none" && (!form.latitude.trim() || !form.longitude.trim()))
  ) {
    throw new Error(
      "Choose exact/approximate and enter both coordinates, or leave both empty with no map location.",
    );
  }
  const entry: PlaceDto = placeDtoSchema.parse({
    id,
    type: form.type,
    category: optional(form.category, 100),
    name,
    description: optional(form.description),
    address: optional(form.address),
    country,
    url: url(form.url),
    status: "pending",
    visibility: "hidden",
    verified: false,
    tags,
    linkType: optional(form.linkType, 100),
    priority: z.coerce.number().int().min(-2147483648).max(2147483647).parse(form.priority),
    lastCheckedAt: form.lastCheckedAt.trim() ? z.iso.date().parse(form.lastCheckedAt.trim()) : null,
    location:
      form.mode === "none"
        ? null
        : {
            mode: form.mode,
            lat: Number(form.latitude.trim()),
            lng: Number(form.longitude.trim()),
            label: optional(form.locationLabel),
          },
    navigationUrl: url(form.navigationUrl),
    locationSource: optional(form.locationSource, 100),
  });
  return { sender, entry, json: JSON.stringify({ entries: [entry] }, null, 2) };
}
