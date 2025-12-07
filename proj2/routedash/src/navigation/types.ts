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
    order: OrderSummary & {
      items: Array<OrderSummary["items"][number] & { name?: string; menuItem?: { name?: string | null } }>;
      createdAt?: string;
    };
  };

  Orders: undefined;
};

export type OrderSummary = {
  id: string;
  status: OrderStatusValue;
  totalCents: number;
  pickupEtaMin: number;
  routeOrigin: string;
  routeDestination: string;
  restaurant: {
    id: string;
    name: string;
    address: string;
  };
  items: Array<{
    id: string;
    menuItemId: string;
    quantity: number;
    priceCents: number;
    name?: string;
    menuItem?: { name?: string | null };
  }>;
  createdAt?: string;
};

export type OrderStatusValue = "PENDING" | "PREPARING" | "READY" | "COMPLETED" | "CANCELED";

export type CustomerTabParamList = {
  Trip: undefined;           // Tab showing TripStackNavigator
  PreviousOrders: undefined; // Tab showing OrdersStackNavigator
};
