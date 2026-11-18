import React, { useState } from "react";
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePlaces } from "../places/PlacesProvider";
import PlacesStatus from "../places/PlacesStatus";
import { Button, Icon, TextAction } from "../../shared/ui";
import { colors, space, ui } from "../../shared/theme";
import { openWebsite } from "../../shared/links";
import { useAuth } from "../auth/AuthProvider";
import ProposalForm from "./ProposalForm";
import { contactConfigured, contactEmail } from "./proposal";
import { prepareEmail } from "./mail";

export default function ClubScreen() {
  const { signOut } = useAuth();
  const { places } = usePlaces();
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [proposalOpen, setProposalOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const countries = new Set(
    places.map((place) => place.country).filter((country) => country !== "unknown"),
  ).size;
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      style={ui.screen}
      contentContainerStyle={[ui.content, { paddingTop: insets.top + space.md, gap: 0 }]}
    >
      <Text accessibilityRole="header" style={ui.title}>
        Club
      </Text>
      <View style={styles.intro}>
        <Image
          source={require("../../../assets/laverda-logo.jpg")}
          style={styles.logo}
          resizeMode="contain"
          accessibilityLabel="Laverda logo"
        />
        <Text style={ui.heading}>For the love of Laverda.</Text>
        <Text style={ui.body}>
          People, places and knowledge that keep our motorcycles on the road.
        </Text>
      </View>
      <View style={styles.stats}>
        <View style={{ flex: 1, gap: space.xs }}>
          <Text style={styles.number}>{places.length}</Text>
          <Text style={ui.caption}>directory entries</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={{ flex: 1, gap: space.xs }}>
          <Text style={styles.number}>{countries}</Text>
          <Text style={ui.caption}>countries</Text>
        </View>
      </View>
      <Button
        title="Laverda Club Schweiz"
        icon="open-in-new"
        onPress={() => void openWebsite("https://www.laverdaclub.ch/")}
      />
      <View style={[ui.section, { marginTop: space.xl }]}>
        <Text style={ui.heading}>Contact & suggestions</Text>
        <Text style={ui.body}>
          Know a workshop, club or collection? Help fellow riders find it. Share its website and
          accurate location with the club.
        </Text>
        <Text selectable style={ui.caption}>
          {contactEmail}
          {!contactConfigured ? " · placeholder; recipient not configured yet" : ""}
        </Text>
        {!contactConfigured && (
          <Text style={ui.caption}>
            Email drafts open without a recipient until the club address is configured. Add the real
            recipient before sending.
          </Text>
        )}
        <TextAction
          title="Contact the club"
          icon="email-outline"
          onPress={() => {
            void prepareEmail("Laverda app enquiry", "Hello Laverda team,\n\n").catch((failure) =>
              Alert.alert(
                "Could not open email",
                failure instanceof Error ? failure.message : "Please set up an email app.",
              ),
            );
          }}
        />
        {!proposalOpen && (
          <Button title="Suggest a new entry" icon="plus" onPress={() => setProposalOpen(true)} />
        )}
        {proposalOpen && <ProposalForm onClose={() => setProposalOpen(false)} />}
      </View>
      <View style={ui.section}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Offline & privacy"
          accessibilityState={{ expanded: privacyOpen }}
          aria-expanded={privacyOpen}
          onPress={() => setPrivacyOpen(!privacyOpen)}
          style={styles.disclosure}
        >
          <Text style={[ui.heading, { flex: 1 }]}>Offline & privacy</Text>
          <Icon name={privacyOpen ? "chevron-up" : "chevron-down"} color={colors.muted} />
        </Pressable>
        {privacyOpen && (
          <View style={{ gap: space.md }}>
            <Text style={ui.body}>
              The directory is loaded after server-verified sign-in and kept in memory for this
              session. An internet connection is required to sign in and verify access. Only
              bookmark IDs stay on this device.
            </Text>
            <Text style={ui.body}>
              Location is optional and used only when you choose Near me. It is never sent to this
              API or stored by the app.
            </Text>
            <Text style={ui.caption}>
              Always confirm opening hours and visiting arrangements before travelling.
            </Text>
          </View>
        )}
      </View>
      <PlacesStatus />
      <Button title="Sign out" secondary onPress={() => void signOut()} />
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  intro: { gap: space.md, paddingTop: space.xl },
  logo: { width: 136, height: 80, alignSelf: "flex-start", marginBottom: space.sm },
  stats: { flexDirection: "row", alignItems: "center", gap: space.xl, paddingVertical: space.xl },
  number: { fontSize: 26, lineHeight: 32, color: colors.ink, fontWeight: "600" },
  statDivider: { width: 1, height: 36, backgroundColor: colors.border },
  disclosure: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: space.md },
});
