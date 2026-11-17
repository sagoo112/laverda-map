import React from "react";
import { DefaultTheme, NavigationContainer } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import Providers from "./src/app/Providers";
import RootTabs from "./src/app/RootTabs";
import { colors } from "./src/shared/theme";

const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.accent,
    background: colors.background,
    card: colors.surface,
    text: colors.ink,
    border: colors.border,
  },
};

export default function App() {
  return (
    <Providers>
      <StatusBar style="dark" />
      <NavigationContainer theme={theme}>
        <RootTabs />
      </NavigationContainer>
    </Providers>
  );
}
