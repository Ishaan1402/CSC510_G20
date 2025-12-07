// src/types/savedTrip.ts

export type SavedTripStopType = "food" | "gas" | "ev" | "mixed";

export type SavedTripFilters = {
  fastService: boolean;
  vegetarian: boolean;
  vegan: boolean;
  localFavorites: boolean;
  priceLevel: number | null;
};

export type SavedTripRestaurant = {
  id: string;
  name: string;
  address: string;
  rating: number | null;
  priceLevel: number | null | undefined;
};

export type SavedTripRouteSnapshot = {
  durationText: string;
  distanceText: string;
  coordinates: {
    latitude: number;
    longitude: number;
  }[];
};

export type SavedTripWaypoint = {
  latitude: number;
  longitude: number;
  address?: string | null;
  kind: "restaurant" | "gas" | "ev" | "unknown";
};

export type SavedTrip = {
  id: string;
  createdAt: string;

  origin: string;
  destination: string;

  stopType: SavedTripStopType;
  stopWindowMinutes: number;

  filters: SavedTripFilters;

  restaurant?: SavedTripRestaurant;
  orderSummary?: unknown;

  routeSnapshot?: SavedTripRouteSnapshot;
  waypoints?: SavedTripWaypoint[];
};