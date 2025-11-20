import Constants from "expo-constants";
import { useCallback, useMemo, useState } from "react";

import type { Coordinate } from "../utils/polyline";
import { distanceInMeters, pickTargetCoordinate } from "../utils/routeCalculations";

export type EVStation = {
  id: string;
  name: string;
  address: string;
  travelTimeMinutes: number;
  location: Coordinate;
  rating?: number | null;
  ratingCount?: number | null;
};

type EVStationState = {
  isLoading: boolean;
  error: string | null;
  items: EVStation[];
  targetTravelMinutes: number | null;
};

const NEARBY_SEARCH_ENDPOINT = "https://maps.googleapis.com/maps/api/place/nearbysearch/json";

const getApiKey = (): string => {
  const extra = Constants?.expoConfig?.extra ?? Constants?.manifest?.extra;
  return (extra?.googleMapsApiKey as string | undefined) ?? "";
};

export const useEVStations = () => {
  const [{ isLoading, error, items, targetTravelMinutes }, setState] = useState<EVStationState>({
    isLoading: false,
    error: null,
    items: [],
    targetTravelMinutes: null,
  });

  const fetchEVStations = useCallback(
    async (coordinates: Coordinate[], durationSeconds: number, preferredMinuteMark: number) => {
      if (!coordinates.length) {
        setState((prev) => ({
          ...prev,
          items: [],
          error: null,
          isLoading: false,
          targetTravelMinutes: null,
        }));
        return;
      }

      const target = pickTargetCoordinate(coordinates, durationSeconds, preferredMinuteMark);
      if (!target) {
        setState({
          isLoading: false,
          error: "We couldn't determine a midpoint for this route. Try plotting a different trip.",
          items: [],
          targetTravelMinutes: null,
        });
        return;
      }

      const apiKey = getApiKey();
      if (!apiKey) {
        setState({
          isLoading: false,
          error: "Missing Google Maps API key. Add GOOGLE_MAPS_API_KEY to your .env file.",
          items: [],
          targetTravelMinutes: null,
        });
        return;
      }

      setState({
        isLoading: true,
        error: null,
        items: [],
        targetTravelMinutes: target.minuteMark,
      });

      try {
        const params = new URLSearchParams({
          location: `${target.coordinate.latitude},${target.coordinate.longitude}`,
          radius: "8000",
          type: "electric_vehicle_charging_station",
          key: apiKey,
        });

        const response = await fetch(`${NEARBY_SEARCH_ENDPOINT}?${params.toString()}`);
        const payload = await response.json();

        if (payload.status !== "OK" && payload.status !== "ZERO_RESULTS") {
          throw new Error(payload.error_message ?? "EV station search failed");
        }

        const places = Array.isArray(payload.results) ? payload.results : [];

        const nextItems: EVStation[] = places
          .map((place: any) => {
            const location = place.geometry?.location
              ? {
                  latitude: place.geometry.location.lat,
                  longitude: place.geometry.location.lng,
                }
              : target.coordinate;
            const distance = distanceInMeters(target.coordinate, location);
            return {
              id: place.place_id,
              name: place.name || "EV Charging Station",
              address: place.vicinity || place.formatted_address || "Address not available",
              travelTimeMinutes: target.minuteMark,
              location,
              rating: place.rating ?? null,
              ratingCount: place.user_ratings_total ?? null,
              distance,
            };
          })
          .filter((station: EVStation & { distance: number }) => station.distance <= 8000)
          .slice(0, 10)
          .map(({ distance: _distance, ...rest }: EVStation & { distance: number }) => rest);

        setState({
          isLoading: false,
          error: null,
          items: nextItems,
          targetTravelMinutes: target.minuteMark,
        });
      } catch (placesError) {
        console.warn("RouteDash useEVStations: failed", placesError);
        setState({
          isLoading: false,
          error:
            "We couldn't load EV charging stations near this route right now. Please try again shortly.",
          items: [],
          targetTravelMinutes: null,
        });
      }
    },
    [],
  );

  const reset = useCallback(() => {
    setState({
      isLoading: false,
      error: null,
      items: [],
      targetTravelMinutes: null,
    });
  }, []);

  return useMemo(
    () => ({
      isLoading,
      error,
      items,
      targetTravelMinutes,
      fetchEVStations,
      reset,
    }),
    [error, fetchEVStations, isLoading, items, reset, targetTravelMinutes],
  );
};

