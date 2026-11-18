import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState, Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { API_URL, ApiError, onUnauthorized, requestJson, setAccessToken } from "../../shared/api";
import { TENANT, removeLegacyDirectory } from "../places/cache";

const path = "/api/v1/tenants/" + TENANT + "/auth/";
const sessionSchema = z.object({ tenant: z.literal(TENANT), expiresAt: z.iso.datetime() });
const loginSchema = sessionSchema.extend({ token: z.string().regex(/^[a-f0-9]{64}$/) });
const storageKey =
  "laverda.session.v1." +
  Array.from(String(API_URL ?? "unset"))
    .map((c) => c.charCodeAt(0).toString(16))
    .join("");
type State = "checking" | "anonymous" | "authenticated" | "locked";
type AuthValue = {
  hasSession: boolean;
  state: State;
  error: string | null;
  busy: boolean;
  signIn: (password: string) => Promise<void>;
  signOut: () => Promise<void>;
  retry: () => void;
};
const Context = createContext<AuthValue | null>(null);
const removeToken = async () => {
  if (Platform.OS !== "web") await SecureStore.deleteItemAsync(storageKey);
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const [state, setState] = useState<State>("checking");
  const [hasSession, setHasSession] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [expires, setExpires] = useState<number | null>(null);
  const token = useRef<string | null>(null);
  const generation = useRef(0);
  const invalidate = useCallback(() => {
    generation.current++;
  }, []);
  const clear = useCallback(async () => {
    generation.current++;
    token.current = null;
    setHasSession(false);
    setAccessToken(null);
    setExpires(null);
    client.clear();
    setState("anonymous");
    try {
      await removeToken();
    } catch {
      setError("Saved sign-in could not be removed. Please check device storage.");
    }
  }, [client]);
  const validate = useCallback(
    async (blocking = true) => {
      const current = token.current;
      if (!current) {
        setState("anonymous");
        return;
      }
      const attempt = ++generation.current;
      if (blocking) setState("checking");
      setError(null);
      try {
        const session = sessionSchema.parse(await requestJson(path + "session"));
        if (attempt !== generation.current) return;
        const expiry = Date.parse(session.expiresAt);
        if (expiry <= Date.now()) {
          await clear();
          return;
        }
        setExpires(expiry);
        setHasSession(true);
        setState("authenticated");
      } catch (failure) {
        if (attempt !== generation.current) return;
        if (failure instanceof ApiError && failure.status === 401) await clear();
        else {
          setError("Connect to the API to verify your access, then try again.");
          setState("locked");
        }
      }
    },
    [clear],
  );
  useEffect(() => {
    let active = true;
    onUnauthorized(() => {
      if (active) void clear();
    });
    void (async () => {
      try {
        await removeLegacyDirectory(AsyncStorage);
        const saved = Platform.OS === "web" ? null : await SecureStore.getItemAsync(storageKey);
        if (!active) return;
        if (saved && /^[a-f0-9]{64}$/.test(saved)) {
          token.current = saved;
          setAccessToken(saved);
          await validate();
        } else setState("anonymous");
      } catch {
        if (active) {
          setError("Saved sign-in could not be read. Please sign in again.");
          setState("anonymous");
        }
      }
    })();
    return () => {
      active = false;
      invalidate();
      onUnauthorized(null);
      setAccessToken(null);
    };
  }, [clear, validate, invalidate]);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      if (!token.current) return;
      if (next === "active") void validate();
      else {
        generation.current++;
        setState("checking");
      }
    });
    return () => subscription.remove();
  }, [validate]);
  useEffect(() => {
    const timer = setInterval(() => {
      if (token.current && AppState.currentState === "active") void validate(false);
    }, 60000);
    return () => clearInterval(timer);
  }, [validate]);
  useEffect(() => {
    if (!expires) return;
    const timer = setTimeout(() => void clear(), Math.max(0, expires - Date.now()));
    return () => clearTimeout(timer);
  }, [expires, clear]);
  const signIn = async (password: string) => {
    const attempt = ++generation.current;
    setBusy(true);
    setError(null);
    try {
      if (!__DEV__ && API_URL && !API_URL.startsWith("https://"))
        throw new Error("HTTPS is required.");
      const session = loginSchema.parse(
        await requestJson(path + "login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        }),
      );
      if (attempt !== generation.current) return;
      if (Date.parse(session.expiresAt) <= Date.now()) throw new Error("Expired session.");
      if (Platform.OS !== "web")
        await SecureStore.setItemAsync(storageKey, session.token, {
          keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        });
      if (attempt !== generation.current) {
        await removeToken();
        return;
      }
      client.clear();
      token.current = session.token;
      setHasSession(true);
      setAccessToken(session.token);
      setExpires(Date.parse(session.expiresAt));
      setState("authenticated");
    } catch (failure) {
      if (attempt !== generation.current) return;
      setError(
        failure instanceof ApiError && failure.status === 401
          ? "Incorrect club password."
          : failure instanceof ApiError && failure.status === 429
            ? "Too many attempts. Please try again in 15 minutes."
            : "Sign-in failed. Check the API connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  const signOut = async () => {
    const pending = requestJson(path + "logout", { method: "POST" }).catch(() => undefined);
    await clear();
    await pending;
  };
  return (
    <Context.Provider
      value={{ hasSession, state, error, busy, signIn, signOut, retry: () => void validate() }}
    >
      {children}
    </Context.Provider>
  );
}
export function useAuth() {
  const value = useContext(Context);
  if (!value) throw new Error("useAuth requires AuthProvider.");
  return value;
}
