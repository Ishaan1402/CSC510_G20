export type VehicleType = "GAS" | "EV" | null;

export type TripContext = {
  origin: string;
  destination: string;
  pickupEtaMin: number;
  vehicleType?: VehicleType;
  refuelTimeMin?: number;
};

export type RestaurantSummary = {
  id: string;
  name: string;
  address: string;
  latitude?: number | null;
  longitude?: number | null;
};

export type MenuSection = {
  id: string;
  title: string;
  items: MenuItem[];
};

export type MenuItem = {
  id: string;
  name: string;
  description?: string | null;
  priceCents: number;
  isAvailable: boolean;
  tags?: string[];
};

export type CartItem = {
  menuItemId: string;
  name: string;
  priceCents: number;
  quantity: number;
};

export type OrderStatusValue = "PENDING" | "PREPARING" | "READY" | "COMPLETED" | "CANCELED";

export type OrderSummary = {
  id: string;
  status: OrderStatusValue;
  totalCents: number;
  pickupEtaMin: number;
  routeOrigin: string;
  routeDestination: string;
  items: Array<{
    id: string;
    menuItemId: string;
    quantity: number;
    priceCents: number;
    name?: string;
  }>;
  restaurant: RestaurantSummary;
  subtotalCents?: number;
  taxCents?: number;
};

export type RootStackParamList = {
  Login: undefined;
  Planner: undefined;
  Restaurants: { trip: TripContext };
  Menu: { restaurant: RestaurantSummary; trip: TripContext };
  Checkout: {
    cart: CartItem[];
    restaurant: RestaurantSummary;
    trip: TripContext;
  };
  OrderStatus: { order: OrderSummary };
  Orders: undefined;
  MerchantDashboard: undefined;
};

export type CustomerTabParamList = {
  Trip: undefined;
  PreviousOrders: undefined;
};
