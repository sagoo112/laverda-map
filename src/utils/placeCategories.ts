import { Entry } from "../types/entry";
import { MapItem } from "./normalizeEntries";

const CATEGORY_STYLES = {
  club: { label: "Club", color: "#f97316", icon: "motorbike" },
  service: { label: "Workshop", color: "#2563eb", icon: "wrench-cog" },
  museum: { label: "Museum", color: "#a855f7", icon: "bank" },
  private: { label: "Private Collection", color: "#0ea5e9", icon: "home-modern" },
  blog: { label: "Blog", color: "#14b8a6", icon: "newspaper-variant" },
  registry: { label: "Registry", color: "#facc15", icon: "clipboard-text" },
  forum: { label: "Forum", color: "#f472b6", icon: "forum" },
  shop: { label: "Shop", color: "#65a30d", icon: "cart" },
  event: { label: "Event", color: "#ef4444", icon: "calendar-star" },
  other: { label: "Spot", color: "#6b7280", icon: "map-marker" }
} as const;

export type CategoryKey = keyof typeof CATEGORY_STYLES;

export type CategoryMeta = {
  key: CategoryKey;
  label: string;
  color: string;
  icon: string;
};

const CATEGORY_ALIAS: Record<string, CategoryKey> = {
  club: "club",
  clubs: "club",
  "club - forum": "club",
  "club - register": "club",
  service: "service",
  workshop: "service",
  garage: "service",
  dealer: "shop",
  shop: "shop",
  "shop - service": "shop",
  museum: "museum",
  private: "private",
  "owners registry": "registry",
  registry: "registry",
  forum: "forum",
  "forum - registry": "forum",
  blog: "blog",
  media: "blog",
  event: "event",
  meetup: "event",
  other: "other"
};

const KEYWORD_TO_CATEGORY: Array<{ needle: RegExp; key: CategoryKey }> = [
  { needle: /\bclub\b/i, key: "club" },
  { needle: /\bforum\b/i, key: "forum" },
  { needle: /\bregistry\b/i, key: "registry" },
  { needle: /\bregister\b/i, key: "registry" },
  { needle: /\bblog\b/i, key: "blog" },
  { needle: /\bjournal\b/i, key: "blog" },
  { needle: /\bshop\b/i, key: "shop" },
  { needle: /\bstore\b/i, key: "shop" },
  { needle: /\bdealer\b/i, key: "shop" },
  { needle: /\bservice\b/i, key: "service" },
  { needle: /\bgarage\b/i, key: "service" },
  { needle: /\btuning\b/i, key: "service" },
  { needle: /\bmuseum\b/i, key: "museum" },
  { needle: /\bevent\b/i, key: "event" },
  { needle: /\brally\b/i, key: "event" },
  { needle: /\bmeet\b/i, key: "event" },
  { needle: /\bprivate\b/i, key: "private" },
  { needle: /\bcollection\b/i, key: "private" }
];

function sanitizeKey(value?: string | null) {
  if (!value) return null;
  const key = value.trim().toLowerCase();
  return key.length ? key : null;
}

function detectCategoryFromText(text?: string | null): CategoryKey | null {
  if (!text) return null;
  for (const map of KEYWORD_TO_CATEGORY) {
    if (map.needle.test(text)) return map.key;
  }
  return null;
}

export function resolveCategoryKey(place: Partial<Entry> & Partial<MapItem>): CategoryKey {
  const candidates = [place._type as string, place.type as string, place.category];
  for (const candidate of candidates) {
    const sanitized = sanitizeKey(candidate);
    if (!sanitized) continue;
    if (CATEGORY_ALIAS[sanitized]) return CATEGORY_ALIAS[sanitized];
    if (CATEGORY_STYLES[sanitized as CategoryKey]) return sanitized as CategoryKey;
  }

  const textHints = [
    place.category,
    place.description,
    place.tags?.join(" "),
    place.name
  ];

  for (const hint of textHints) {
    const detected = detectCategoryFromText(hint);
    if (detected) return detected;
  }

  return "other";
}

export function getCategoryMeta(place: Partial<Entry> & Partial<MapItem>): CategoryMeta {
  const key = resolveCategoryKey(place);
  const base = CATEGORY_STYLES[key];
  return { key, ...base };
}

export function getCategoryMetaByKey(key: string): CategoryMeta {
  const normalized = sanitizeKey(key);
  if (normalized && CATEGORY_STYLES[normalized as CategoryKey]) {
    const style = CATEGORY_STYLES[normalized as CategoryKey];
    return { key: normalized as CategoryKey, ...style };
  }
  return { key: "other", ...CATEGORY_STYLES.other };
}
