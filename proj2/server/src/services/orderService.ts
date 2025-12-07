import { OrderStatus } from "@prisma/client";

import { HttpError } from "../errors/HttpError";
import { prisma } from "../lib/prisma";

type OrderItemInput = {
  menuItemId: string;
  quantity: number;
};

type CreateOrderInput = {
  restaurantId: string;
  items: OrderItemInput[];
  pickupEtaMin: number;
  routeOrigin: string;
  routeDestination: string;
};

const TAX_RATE = 0.0825;

const calculateSubtotal = (items: Array<{ priceCents: number; quantity: number }>) =>
  items.reduce((total, item) => total + item.priceCents * item.quantity, 0);

const attachFinancials = <
  T extends { totalCents: number; items: Array<{ priceCents: number; quantity: number }> },
>(
  order: T,
  overrides?: { subtotalCents: number; taxCents: number },
) => {
  const subtotalCents = overrides?.subtotalCents ?? calculateSubtotal(order.items);
  const taxCents = overrides?.taxCents ?? Math.max(order.totalCents - subtotalCents, 0);

  return {
    ...order,
    subtotalCents,
    taxCents,
  };
};

export const createOrder = async (customerId: string, input: CreateOrderInput) => {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: input.restaurantId, isActive: true },
  });
  if (!restaurant) {
    throw new HttpError(404, "Restaurant not found");
  }

  const menuItems = await prisma.menuItem.findMany({
    where: {
      id: { in: input.items.map((item) => item.menuItemId) },
      restaurantId: restaurant.id,
      isAvailable: true,
    },
  });

  if (menuItems.length !== input.items.length) {
    throw new HttpError(400, "Some menu items are unavailable");
  }

  const subtotalCents = input.items.reduce((total, item) => {
    const menuItem = menuItems.find((i) => i.id === item.menuItemId)!;
    return total + menuItem.priceCents * item.quantity;
  }, 0);
  const taxCents = Math.round(subtotalCents * TAX_RATE);
  const totalCents = subtotalCents + taxCents;

  const order = await prisma.order.create({
    data: {
      customerId,
      restaurantId: restaurant.id,
      pickupEtaMin: input.pickupEtaMin,
      routeOrigin: input.routeOrigin,
      routeDestination: input.routeDestination,
      totalCents,
      items: {
        create: input.items.map((item) => ({
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          priceCents: menuItems.find((i) => i.id === item.menuItemId)!.priceCents,
        })),
      },
    },
    include: {
      items: {
        include: {
          menuItem: {
            select: { name: true },
          },
        },
      },
    },
  });

  return attachFinancials(order, { subtotalCents, taxCents });
};

const customerOrderInclude = {
  restaurant: {
    select: { id: true, name: true, address: true, latitude: true, longitude: true },
  },
  items: {
    include: {
      menuItem: {
        select: { name: true },
      },
    },
  },
} as const;

export const listOrdersForUser = async (customerId: string) => {
  const orders = await prisma.order.findMany({
    where: { customerId },
    include: customerOrderInclude,
    orderBy: { createdAt: "desc" },
  });

  return orders.map((order) => attachFinancials(order));
};

const restaurantOrderInclude = {
  customer: {
    select: { id: true, name: true },
  },
  items: {
    include: {
      menuItem: {
        select: { name: true },
      },
    },
  },
} as const;

export const listOrdersForRestaurant = async (restaurantId: string) => {
  const orders = await prisma.order.findMany({
    where: { restaurantId },
    include: restaurantOrderInclude,
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
  });

  return orders.map((order) => attachFinancials(order));
};

const STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.PREPARING, OrderStatus.CANCELED],
  [OrderStatus.PREPARING]: [OrderStatus.READY, OrderStatus.CANCELED],
  [OrderStatus.READY]: [OrderStatus.COMPLETED, OrderStatus.CANCELED],
  [OrderStatus.COMPLETED]: [],
  [OrderStatus.CANCELED]: [],
};

export const updateOrderStatusForRestaurant = async (
  restaurantId: string,
  orderId: string,
  nextStatus: OrderStatus,
) => {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: restaurantOrderInclude,
  });

  if (!order || order.restaurantId !== restaurantId) {
    throw new HttpError(404, "Order not found");
  }

  if (order.status === nextStatus) {
    return attachFinancials(order);
  }

  const allowedTransitions = STATUS_TRANSITIONS[order.status] ?? [];
  if (!allowedTransitions.includes(nextStatus)) {
    throw new HttpError(400, "Invalid status transition");
  }

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: { status: nextStatus },
    include: restaurantOrderInclude,
  });

  return attachFinancials(updated);
};

export const getOrderForCustomer = async (orderId: string, customerId: string) => {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: customerOrderInclude,
  });

  if (!order || order.customerId !== customerId) {
    throw new HttpError(404, "Order not found");
  }

  return attachFinancials(order);
};

export type PopularItem = {
  menuItemId: string;
  name: string;
  totalQuantity: number;
  totalRevenueCents: number;
};

export type TimeBasedStats = {
  date: string; // YYYY-MM-DD format
  orderCount: number;
  totalRevenueCents: number;
  averageOrderValueCents: number;
};

export type RestaurantAnalytics = {
  popularItems: PopularItem[];
  averageOrderCostCents: number;
  totalOrders: number;
  totalRevenueCents: number;
  ordersByDay: TimeBasedStats[];
  ordersByWeek: TimeBasedStats[];
  peakOrderingHours: Array<{ hour: number; orderCount: number }>;
};

export const getRestaurantAnalytics = async (restaurantId: string): Promise<RestaurantAnalytics> => {
  // Get all orders for this restaurant (excluding canceled orders)
  const orders = await prisma.order.findMany({
    where: {
      restaurantId,
      status: { not: "CANCELED" },
    },
    include: {
      items: {
        include: {
          menuItem: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });

  // Calculate total orders, revenue, and average cost
  const totalOrders = orders.length;
  const totalRevenueCents = orders.reduce((sum, order) => sum + order.totalCents, 0);
  const averageOrderCostCents = totalOrders > 0 ? Math.round(totalRevenueCents / totalOrders) : 0;

  // Time-based analytics: Orders by day
  const ordersByDayMap = new Map<string, { count: number; revenue: number }>();
  orders.forEach((order) => {
    const date = new Date(order.createdAt).toISOString().split("T")[0]; // YYYY-MM-DD
    const existing = ordersByDayMap.get(date);
    if (existing) {
      existing.count += 1;
      existing.revenue += order.totalCents;
    } else {
      ordersByDayMap.set(date, { count: 1, revenue: order.totalCents });
    }
  });

  const ordersByDay: TimeBasedStats[] = Array.from(ordersByDayMap.entries())
    .map(([date, data]) => ({
      date,
      orderCount: data.count,
      totalRevenueCents: data.revenue,
      averageOrderValueCents: Math.round(data.revenue / data.count),
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-30); // Last 30 days

  // Orders by week
  const ordersByWeekMap = new Map<string, { count: number; revenue: number }>();
  orders.forEach((order) => {
    const date = new Date(order.createdAt);
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay()); // Start of week (Sunday)
    const weekKey = weekStart.toISOString().split("T")[0];
    const existing = ordersByWeekMap.get(weekKey);
    if (existing) {
      existing.count += 1;
      existing.revenue += order.totalCents;
    } else {
      ordersByWeekMap.set(weekKey, { count: 1, revenue: order.totalCents });
    }
  });

  const ordersByWeek: TimeBasedStats[] = Array.from(ordersByWeekMap.entries())
    .map(([date, data]) => ({
      date,
      orderCount: data.count,
      totalRevenueCents: data.revenue,
      averageOrderValueCents: Math.round(data.revenue / data.count),
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-12); // Last 12 weeks

  // Peak ordering hours
  const hourCounts = new Map<number, number>();
  orders.forEach((order) => {
    const hour = new Date(order.createdAt).getHours();
    hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
  });

  const peakOrderingHours = Array.from(hourCounts.entries())
    .map(([hour, orderCount]) => ({ hour, orderCount }))
    .sort((a, b) => b.orderCount - a.orderCount)
    .slice(0, 5); // Top 5 hours

  // Aggregate popular items by menuItemId
  const itemMap = new Map<string, { name: string; totalQuantity: number; totalRevenueCents: number }>();

  orders.forEach((order) => {
    order.items.forEach((orderItem) => {
      const menuItemId = orderItem.menuItemId;
      const menuItemName = orderItem.menuItem?.name ?? "Unknown Item";
      const quantity = orderItem.quantity;
      const revenueCents = orderItem.priceCents * quantity;

      const existing = itemMap.get(menuItemId);
      if (existing) {
        existing.totalQuantity += quantity;
        existing.totalRevenueCents += revenueCents;
      } else {
        itemMap.set(menuItemId, {
          name: menuItemName,
          totalQuantity: quantity,
          totalRevenueCents: revenueCents,
        });
      }
    });
  });

  // Convert to array and sort by total quantity (most popular first)
  const popularItems: PopularItem[] = Array.from(itemMap.entries())
    .map(([menuItemId, data]) => ({
      menuItemId,
      name: data.name,
      totalQuantity: data.totalQuantity,
      totalRevenueCents: data.totalRevenueCents,
    }))
    .sort((a, b) => b.totalQuantity - a.totalQuantity);

  return {
    popularItems,
    averageOrderCostCents,
    totalOrders,
    totalRevenueCents,
    ordersByDay,
    ordersByWeek,
    peakOrderingHours,
  };
};
