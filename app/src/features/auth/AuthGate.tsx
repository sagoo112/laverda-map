import React, { useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "./AuthProvider";
import { API_URL } from "../../shared/api";
import { Button } from "../../shared/ui";
import { colors, space, ui } from "../../shared/theme";

export default function AuthGate({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const [password, setPassword] = useState("");
  const insets = useSafeAreaInsets();
  const submit = () => {
    if (auth.busy || !password || !API_URL) return;
    const value = password;
    setPassword("");
    void auth.signIn(value);
  };
  return (
    <View style={{ flex: 1 }}>
      {auth.hasSession && (
        <View
          style={{ flex: 1, display: auth.state === "authenticated" ? "flex" : "none" }}
          importantForAccessibility={
            auth.state === "authenticated" ? "auto" : "no-hide-descendants"
          }
        >
          {children}
        </View>
      )}
      {auth.state !== "authenticated" && (
        <KeyboardAvoidingView
          style={ui.screen}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[
              ui.content,
              {
                flexGrow: 1,
                justifyContent: "center",
                paddingTop: insets.top + space.xl,
                paddingBottom: insets.bottom + space.xl,
              },
            ]}
          >
            <Image
              source={require("../../../assets/laverda-logo.jpg")}
              style={{ width: 150, height: 90, marginBottom: space.xl }}
              resizeMode="contain"
              accessibilityLabel="Laverda logo"
            />
            <Text accessibilityRole="header" style={ui.title}>
              Welcome to Laverda
            </Text>
            <Text style={ui.body}>Enter the club password to access the directory.</Text>
            {auth.state === "checking" ? (
              <ActivityIndicator accessibilityLabel="Checking access" color={colors.accent} />
            ) : (
              <View style={{ gap: space.md }}>
                {auth.error && (
                  <Text accessibilityRole="alert" style={ui.body}>
                    {auth.error}
                  </Text>
                )}
                {auth.state === "locked" ? (
                  <>
                    <Button title="Verify access" onPress={auth.retry} />
                    <Button secondary title="Sign out" onPress={() => void auth.signOut()} />
                  </>
                ) : (
                  <>
                    {!API_URL && (
                      <Text style={ui.caption}>
                        An API address must be configured before signing in.
                      </Text>
                    )}
                    <Text style={ui.caption}>Club password</Text>
                    <TextInput
                      accessibilityLabel="Club password"
                      secureTextEntry
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete="current-password"
                      textContentType="password"
                      value={password}
                      onChangeText={setPassword}
                      editable={!auth.busy}
                      onSubmitEditing={submit}
                      returnKeyType="go"
                      style={{
                        borderWidth: 1,
                        borderColor: colors.border,
                        borderRadius: 12,
                        padding: space.md,
                        color: colors.ink,
                        fontSize: 17,
                      }}
                    />
                    <Button
                      title={auth.busy ? "Signing in…" : "Sign in"}
                      disabled={!API_URL || !password || auth.busy}
                      onPress={submit}
                    />
                    <Text style={ui.caption}>
                      Access is checked by the server. An internet connection is required.
                    </Text>
                  </>
                )}
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}
