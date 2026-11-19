import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import ExploreScreen from "../features/places/ExploreScreen";
import ResourcesScreen from "../features/resources/ResourcesScreen";
import ClubScreen from "../features/club/ClubScreen";
import { Icon, type IconName } from "../shared/ui";
import { colors } from "../shared/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Platform, useWindowDimensions } from "react-native";

export type RootTabsParamList = { Explore: undefined; Resources: undefined; Club: undefined };
const Tab = createBottomTabNavigator<RootTabsParamList>();
const icons: Record<keyof RootTabsParamList, IconName> = {
  Explore: "map-search-outline",
  Resources: "book-open-outline",
  Club: "motorbike",
};
export default function RootTabs() {
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  return (
    <Tab.Navigator
      // Android MapView can lose its markers when an inactive tab is detached.
      detachInactiveScreens={Platform.OS !== "android"}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: Math.max(64, 38 + 18 * fontScale) + insets.bottom,
          paddingBottom: insets.bottom + 4,
          paddingTop: 4,
        },
        tabBarLabelPosition: "below-icon",
        tabBarLabelStyle: { fontSize: 12, lineHeight: 18, fontWeight: "600" },
        tabBarAllowFontScaling: true,
        tabBarIcon: ({ color, size }) => (
          <Icon name={icons[route.name]} color={color} size={size} />
        ),
      })}
    >
      <Tab.Screen name="Explore" component={ExploreScreen} />
      <Tab.Screen name="Resources" component={ResourcesScreen} />
      <Tab.Screen name="Club" component={ClubScreen} />
    </Tab.Navigator>
  );
}
