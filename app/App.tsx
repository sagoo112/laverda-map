import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import RootTabs from "./src/navigation/RootTabs";
import { PlacesProvider } from "./src/context/PlacesContext";

export default function App() {
  return (
    <PlacesProvider>
      <NavigationContainer>
        <RootTabs />
      </NavigationContainer>
    </PlacesProvider>
  );
}
