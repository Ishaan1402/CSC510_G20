import { useCallback, useMemo, useState } from "react";

import { apiPatch } from "../api/client";
import type { AuthUser } from "../context/AuthContext";

type ProfileState = {
  isLoading: boolean;
  error: string | null;
};

export const useUserProfile = () => {
  const [{ isLoading, error }, setState] = useState<ProfileState>({
    isLoading: false,
    error: null,
  });

  const updateVehicleType = useCallback(async (vehicleType: "GAS" | "EV" | null) => {
    setState({ isLoading: true, error: null });

    try {
      const response = await apiPatch<{ user: AuthUser }>("/api/auth/profile", {
        vehicleType,
      });
      return response.user;
    } catch (profileError) {
      console.warn("RouteDash useUserProfile: failed to update vehicle type", profileError);
      setState({
        isLoading: false,
        error: "We couldn't update your vehicle type. Please try again.",
      });
      throw profileError;
    } finally {
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, []);

  return useMemo(
    () => ({
      isLoading,
      error,
      updateVehicleType,
    }),
    [error, isLoading, updateVehicleType],
  );
};

