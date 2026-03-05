import { ComponentType } from "react";
import { TextProps } from "react-native";

type IconProps = TextProps & {
  name: string;
  size?: number;
  color?: string;
};

declare module "@expo/vector-icons" {
  export const MaterialCommunityIcons: ComponentType<IconProps>;
}
