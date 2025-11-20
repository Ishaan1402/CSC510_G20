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

import { apiFetch, apiPost } from "../api/client";

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

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isHydrating, setIsHydrating] = useState(true);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          setUser(JSON.parse(stored));
        }
        const me = await apiFetch<{ user: AuthUser }>("/api/auth/me");
        setUser(me.user);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(me.user));
      } catch {
        setUser(null);
        await AsyncStorage.removeItem(STORAGE_KEY);
      } finally {
        setIsHydrating(false);
      }
    };

    bootstrap().catch(() => {});
  }, []);

  const persistUser = useCallback(async (nextUser: AuthUser | null) => {
    setUser(nextUser);
    if (nextUser) {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextUser));
    } else {
      await AsyncStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const login = useCallback(
    async ({ email, password }: { email: string; password: string }) => {
      const response = await apiPost<{ user: AuthUser }>("/api/auth/login", {
        email,
        password,
      });
      await persistUser(response.user);
    },
    [persistUser],
  );

  const registerCustomer = useCallback(
    async (payload: { name: string; email: string; password: string }) => {
      const response = await apiPost<{ user: AuthUser }>("/api/auth/register-customer", payload);
      await persistUser(response.user);
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
      const response = await apiPost<{ user: AuthUser }>("/api/auth/register-restaurant", payload);
      await persistUser(response.user);
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
