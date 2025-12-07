// src/navigation/types.ts

import type { SavedTrip } from "../types/savedTrip";

export type VehicleType = "GAS" | "EV" | null;

export type TripContext = {
  origin: string;
  destination: string;
  pickupEtaMin: number;
  vehicleType: VehicleType;
  refuelTimeMin?: number;
};

export type RestaurantSummary = {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
};

export type RootStackParamList = {
  // Public
  Login: undefined;

  // Merchant flow
  MerchantDashboard: undefined;

  // Customer trip planning flow (inside TripStackNavigator)
  Planner:
    | undefined
    | {
        fromSavedTrip?: boolean;
        savedTrip?: SavedTrip;
      };

  SavedTrips: undefined;

  Restaurants:
    | {
        trip: TripContext;
      }
    | undefined; // allows Merchant flow to open Restaurants without trip if needed

  Menu: {
    restaurant: RestaurantSummary;
    trip?: TripContext; // optional so Merchant flow can reuse Menu without trip
  };

  Checkout: {
    restaurant: RestaurantSummary;
    trip: TripContext;
  };

  // Orders & status
  OrderStatus: {
    orderId?: string;
  };

  Orders: undefined;
};

export type CustomerTabParamList = {
  Trip: undefined;           // Tab showing TripStackNavigator
  PreviousOrders: undefined; // Tab showing OrdersStackNavigator
};
