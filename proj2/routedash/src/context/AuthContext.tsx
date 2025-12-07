import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { apiFetch, apiPost, setAuthToken } from "../api/client";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: "CUSTOMER" | "RESTAURANT";
  vehicleType?: "GAS" | "EV" | null;
  restaurantId?: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isHydrating: boolean;
  login: (payload: { email: string; password: string }) => Promise<void>;
  registerCustomer: (payload: { name: string; email: string; password: string }) => Promise<void>;
  registerRestaurant: (payload: {
    name: string;
    email: string;
    password: string;
    restaurantName: string;
    address: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const STORAGE_KEY = "@routedash/auth/user";
const TOKEN_KEY = "@routedash/auth/token";

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isHydrating, setIsHydrating] = useState(true);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        // Restore token from storage first
        const storedToken = await AsyncStorage.getItem(TOKEN_KEY);
        if (storedToken) {
          setAuthToken(storedToken);
        }

        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          setUser(JSON.parse(stored));
        }

        // Verify session with server
        const me = await apiFetch<{ user: AuthUser }>("/api/auth/me");
        setUser(me.user);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(me.user));
      } catch {
        setUser(null);
        setAuthToken(null);
        await AsyncStorage.removeItem(STORAGE_KEY);
        await AsyncStorage.removeItem(TOKEN_KEY);
      } finally {
        setIsHydrating(false);
      }
    };

    bootstrap().catch(() => {});
  }, []);

  const persistUser = useCallback(async (nextUser: AuthUser | null, token?: string | null) => {
    setUser(nextUser);
    if (nextUser) {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextUser));
      if (token) {
        setAuthToken(token);
        await AsyncStorage.setItem(TOKEN_KEY, token);
      }
    } else {
      setAuthToken(null);
      await AsyncStorage.removeItem(STORAGE_KEY);
      await AsyncStorage.removeItem(TOKEN_KEY);
    }
  }, []);

  const login = useCallback(
    async ({ email, password }: { email: string; password: string }) => {
      const response = await apiPost<{ user: AuthUser; token: string }>("/api/auth/login", {
        email,
        password,
      });
      await persistUser(response.user, response.token);
    },
    [persistUser],
  );

  const registerCustomer = useCallback(
    async (payload: { name: string; email: string; password: string }) => {
      const response = await apiPost<{ user: AuthUser; token: string }>("/api/auth/register-customer", payload);
      await persistUser(response.user, response.token);
    },
    [persistUser],
  );

  const registerRestaurant = useCallback(
    async (payload: {
      name: string;
      email: string;
      password: string;
      restaurantName: string;
      address: string;
    }) => {
      const response = await apiPost<{ user: AuthUser; token: string }>("/api/auth/register-restaurant", payload);
      await persistUser(response.user, response.token);
    },
    [persistUser],
  );

  const logout = useCallback(async () => {
    await apiPost("/api/auth/logout");
    await persistUser(null);
  }, [persistUser]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isHydrating,
      login,
      registerCustomer,
      registerRestaurant,
      logout,
    }),
    [isHydrating, login, logout, registerCustomer, registerRestaurant, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
