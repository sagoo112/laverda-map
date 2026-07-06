import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { View, Text, StyleSheet, Platform } from "react-native";

import MapScreen from "../screens/MapScreen";
import BlogScreen from "../screens/BlogScreen";
import AboutScreen from "../screens/AboutScreen";

const Tab = createBottomTabNavigator();

const TAB_META = {
  Map: { icon: "map-search", label: "Map", accent: "#f97316" },
  Blog: { icon: "newspaper-variant-outline", label: "Blog", accent: "#64748b" },
  About: { icon: "information", label: "About", accent: "#64748b" }
} as const;

export default function RootTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: false,
        tabBarHideOnKeyboard: true,
        tabBarStyle: styles.tabBar,
        tabBarItemStyle: styles.tabBarItem,
        tabBarIconStyle: styles.tabBarIconStyle,
        tabBarIcon: ({ focused }) => {
          const meta = TAB_META[route.name as keyof typeof TAB_META];

          const iconColor = focused ? "#f97316" : "#475569";
          const labelColor = focused ? "#f97316" : "#475569";
          const circleStyle = focused ? styles.activeIconWrap : styles.inactiveIconWrap;

          return (
            <View style={styles.itemContent}>
              <View style={circleStyle}>
                <MaterialCommunityIcons
                  name={meta.icon as any}
                  size={24}
                  color={iconColor}
                />
              </View>

              <Text style={[styles.itemLabel, { color: labelColor }]}>
                {meta.label}
              </Text>
            </View>
          );
        }
      })}
    >
      <Tab.Screen name="Map" component={MapScreen} />
      <Tab.Screen name="Blog" component={BlogScreen} />
      <Tab.Screen name="About" component={AboutScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: Platform.OS === "ios" ? 18 : 12,

    height: 92,
    backgroundColor: "#efefef",
    borderRadius: 28,
    borderTopWidth: 0,
    borderWidth: 0,

    elevation: 10,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },

    paddingTop: 10,
    paddingBottom: 8
  },

  tabBarItem: {
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 0
  },

  tabBarIconStyle: {
    width: "100%",
    height: "100%"
  },

  itemContent: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center"
  },

  activeIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(249,115,22,0.14)",
    marginBottom: 4
  },

  inactiveIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    marginBottom: 4
  },

  itemLabel: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: "700",
    textAlign: "center"
  }
});