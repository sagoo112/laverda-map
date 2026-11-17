import React, { useState } from "react";
import { Alert, Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePlaces } from "../places/PlacesProvider";
import PlacesStatus from "../places/PlacesStatus";
import { Button, Icon, TextAction } from "../../shared/ui";
import { colors, space, ui } from "../../shared/theme";
import { openWebsite } from "../../shared/links";

const email = process.env.EXPO_PUBLIC_CONTACT_EMAIL?.trim();
const canContact = !!email && /^[^\s@?&#]+@[^\s@?&#]+\.[^\s@?&#]+$/.test(email);
export default function ClubScreen() {
  const { places } = usePlaces();
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const countries = new Set(
    places.map((place) => place.country).filter((country) => country !== "unknown"),
  ).size;
  return (
    <ScrollView
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
          <Text style={ui.caption}>public entries</Text>
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
        <Text style={ui.heading}>Share a good find</Text>
        <Text style={ui.body}>
          Know a workshop, club or collection? Help fellow riders find it. Share its website and
          accurate location with the club.
        </Text>
        {canContact ? (
          <TextAction
            title="Suggest a place"
            icon="email-outline"
            onPress={() => {
              void Linking.openURL(
                "mailto:" + email + "?subject=Laverda%20directory%20suggestion",
              ).catch(() => Alert.alert("Could not open email", "You can email " + email + "."));
            }}
          />
        ) : (
          <Text style={ui.caption}>Contact details are on the club website.</Text>
        )}
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
              The included directory and your last successful update stay available offline.
              Bookmarks stay on this device. Maps, websites and directions may still need a
              connection.
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
