import { useCallback, useMemo, useState } from "react";

import { apiFetch } from "../api/client";
import type { Coordinate } from "../utils/polyline";
import { distanceInMeters, pickTargetCoordinate } from "../utils/routeCalculations";

export type Restaurant = {
  id: string;
  name: string;
  rating: number | null;
  ratingCount: number | null;
  travelTimeMinutes: number;
  address: string;
  priceLevel?: string;
  iconUrl?: string;
  location: Coordinate;
};

type RecommendationState = {
  isLoading: boolean;
  error: string | null;
  items: Restaurant[];
  targetTravelMinutes: number | null;
};

export const useRestaurantRecommendations = () => {
  const [{ isLoading, error, items, targetTravelMinutes }, setState] =
    useState<RecommendationState>({
      isLoading: false,
      error: null,
      items: [],
      targetTravelMinutes: null,
    });

  const fetchRestaurants = useCallback(
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

      setState({
        isLoading: true,
        error: null,
        items: [],
        targetTravelMinutes: target.minuteMark,
      });

      try {
        const { restaurants } = await apiFetch<{
          restaurants: {
            id: string;
            name: string;
            address: string;
            latitude: number | null;
            longitude: number | null;
          }[];
        }>("/api/restaurants", { requireAuth: false });

        // Filter restaurants that are within reasonable distance of the ENTIRE route
        // Calculate distances to both the target point and to the nearest point on the route
        const nextItems: Restaurant[] = restaurants
          .map((restaurant) => {
            const location =
              restaurant.latitude && restaurant.longitude
                ? {
                    latitude: restaurant.latitude,
                    longitude: restaurant.longitude,
                  }
                : target.coordinate;
            
            // Find minimum distance to any point on the route
            let minDistanceToRoute = Infinity;
            for (const coord of coordinates) {
              const d = distanceInMeters(coord, location);
              if (d < minDistanceToRoute) {
                minDistanceToRoute = d;
              }
            }
            
            return {
              id: restaurant.id,
              name: restaurant.name,
              rating: null,
              ratingCount: null,
              travelTimeMinutes: target.minuteMark,
              address: restaurant.address,
              location,
              distanceToRoute: minDistanceToRoute,
            };
          })
          // Show restaurants within 50km of any point on the route
          .filter((restaurant) => restaurant.distanceToRoute <= 50000 || restaurant.distanceToRoute === 0)
          .sort((a, b) => a.distanceToRoute - b.distanceToRoute)
          .slice(0, 10)
          .map(({ distanceToRoute: _distance, ...rest }) => rest);

        setState({
          isLoading: false,
          error: null,
          items: nextItems,
          targetTravelMinutes: target.minuteMark,
        });
      } catch (placesError) {
        console.warn("RouteDash useRestaurantRecommendations: failed", placesError);
        setState({
          isLoading: false,
          error:
            "We couldn't load restaurant ideas near this route right now. Please try again shortly.",
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
      fetchRestaurants,
      reset,
    }),
    [error, fetchRestaurants, isLoading, items, reset, targetTravelMinutes],
  );
};
