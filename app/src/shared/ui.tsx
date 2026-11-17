import React, { type ComponentProps } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { colors, radius, space, ui } from "./theme";

export type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];
export function Icon({
  name,
  color = colors.ink,
  size = 22,
}: {
  name: IconName;
  color?: string;
  size?: number;
}) {
  return (
    <MaterialCommunityIcons
      name={name}
      size={size}
      color={color}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      aria-hidden
    />
  );
}
export function IconButton({
  label,
  icon,
  onPress,
  selected,
  disabled = false,
  testID,
}: {
  label: string;
  icon: IconName;
  onPress: () => void;
  selected?: boolean;
  disabled?: boolean;
  testID?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        pressed && styles.pressed,
        disabled && styles.dim,
      ]}
    >
      <Icon name={icon} color={selected ? colors.accent : colors.muted} />
    </Pressable>
  );
}
export function TextAction({
  title,
  icon,
  onPress,
  busy = false,
  selected = false,
}: {
  title: string;
  icon?: IconName;
  onPress: () => void;
  busy?: boolean;
  selected?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ busy, disabled: busy, selected }}
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => [styles.textAction, pressed && styles.dim]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={colors.accent} />
      ) : (
        icon && <Icon name={icon} size={18} color={selected ? colors.accent : colors.muted} />
      )}
      <Text style={[styles.actionText, selected && { color: colors.accent }]}>{title}</Text>
    </Pressable>
  );
}
export function SearchField({
  value,
  onChangeText,
  label,
  placeholder,
  testID,
}: {
  value: string;
  onChangeText: (value: string) => void;
  label: string;
  placeholder: string;
  testID?: string;
}) {
  const [focused, setFocused] = React.useState(false);
  return (
    <View style={[styles.search, focused && styles.searchFocused]}>
      <Icon name="magnify" color={colors.muted} size={21} />
      <TextInput
        accessibilityLabel={label}
        testID={testID}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={styles.input}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        onSubmitEditing={() => Keyboard.dismiss()}
      />
      {!!value && <IconButton label="Clear search" icon="close" onPress={() => onChangeText("")} />}
    </View>
  );
}
export function Button({
  title,
  onPress,
  icon,
  secondary = false,
  disabled = false,
  busy = false,
  testID,
}: {
  title: string;
  onPress: () => void;
  icon?: IconName;
  secondary?: boolean;
  disabled?: boolean;
  busy?: boolean;
  testID?: string;
}) {
  const foreground = secondary ? colors.ink : colors.white;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: disabled || busy, busy }}
      testID={testID}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.secondary,
        (pressed || disabled || busy) && styles.dim,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={foreground} />
      ) : (
        icon && <Icon name={icon} color={foreground} size={20} />
      )}
      <Text style={[styles.buttonText, { color: foreground }]}>{title}</Text>
    </Pressable>
  );
}
export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: { title: string; onPress: () => void };
}) {
  return (
    <View style={ui.card}>
      <Text style={ui.heading}>{title}</Text>
      <Text style={ui.body}>{body}</Text>
      {action && <TextAction title={action.title} icon="arrow-left" onPress={action.onPress} />}
    </View>
  );
}
const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: space.sm,
  },
  secondary: { backgroundColor: colors.subtle },
  buttonText: { fontSize: 15, fontWeight: "700", flexShrink: 1, textAlign: "center" },
  dim: { opacity: 0.65 },
  pressed: { backgroundColor: colors.subtle },
  iconButton: {
    width: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.sm,
  },
  textAction: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.xs,
    alignSelf: "flex-start",
  },
  actionText: { fontSize: 13, fontWeight: "600", color: colors.muted, flexShrink: 1 },
  search: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: space.md,
    backgroundColor: colors.subtle,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: "transparent",
  },
  searchFocused: { borderColor: colors.accent },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    padding: space.md,
    fontSize: 15,
    color: colors.ink,
  },
});
