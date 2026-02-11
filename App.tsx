import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import MapScreen from "./src/screens/MapScreen";
import AboutScreen from "./src/screens/AboutScreen";

export type RootStackParamList = {
  Map: undefined;
  About: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Map" component={MapScreen} options={{ title: "Laverda Map" }} />
        <Stack.Screen name="About" component={AboutScreen} options={{ title: "About" }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
