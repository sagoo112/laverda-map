import type { IconName } from "../../shared/ui";
import type { PlaceType } from "./schema";

export const categories: Record<PlaceType, { label: string; icon: IconName; color: string }> = {
  club: { label: "Clubs", icon: "motorbike", color: "#b7351d" },
  service: { label: "Workshops", icon: "wrench-outline", color: "#34596e" },
  museum: { label: "Museums", icon: "bank-outline", color: "#685374" },
  private: { label: "Collections", icon: "home-outline", color: "#626258" },
  blog: { label: "Blogs", icon: "book-open-outline", color: "#296044" },
  forum: { label: "Forums", icon: "forum-outline", color: "#34596e" },
  registry: { label: "Registries", icon: "clipboard-text-outline", color: "#77501b" },
  shop: { label: "Shops", icon: "store-outline", color: "#296044" },
  event: { label: "Events", icon: "calendar-outline", color: "#b7351d" },
  other: { label: "Other", icon: "map-marker-outline", color: "#626258" },
};
