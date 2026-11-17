import { StyleSheet } from "react-native";

export const colors = {
  background: "#f7f4ee",
  surface: "#ffffff",
  subtle: "#eeece6",
  ink: "#24241f",
  muted: "#626258",
  accent: "#b7351d",
  accentSoft: "#fbece5",
  border: "#dedbd3",
  success: "#296044",
  notice: "#77501b",
  noticeSoft: "#fff3dc",
  white: "#ffffff",
} as const;
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 10, card: 14, pill: 999 } as const;
export const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, gap: space.md, width: "100%", maxWidth: 760, alignSelf: "center" },
  title: {
    fontSize: 30,
    lineHeight: 37,
    fontWeight: "700",
    color: colors.ink,
    letterSpacing: -0.6,
  },
  heading: { fontSize: 20, lineHeight: 27, fontWeight: "600", color: colors.ink },
  body: { fontSize: 15, lineHeight: 23, color: colors.muted },
  caption: { fontSize: 13, lineHeight: 19, color: colors.muted },
  eyebrow: { fontSize: 12, fontWeight: "800", letterSpacing: 1.8, color: colors.accent },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: 18,
    gap: space.sm,
  },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm },
  section: {
    gap: space.md,
    paddingVertical: space.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
