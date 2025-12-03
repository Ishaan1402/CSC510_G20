import { prisma } from "../lib/prisma";

export type PopularItem = {
  menuItemId: string;
  menuItemName: string;
  totalQuantity: number;
  orderCount: number;
  revenueCents: number;
};

export type PeakTime = {
  hour: number;
  orderCount: number;
  revenueCents: number;
};

export type RestaurantAnalytics = {
  popularItems: PopularItem[];
  peakTimes: PeakTime[];
  totalOrders: number;
  totalRevenueCents: number;
};

/**
 * Get popular items for a restaurant
 * Returns items ordered by total quantity, with order count and revenue
 */
export const getPopularItems = async (
  restaurantId: string,
  limit: number = 10,
): Promise<PopularItem[]> => {
  const orderItems = await prisma.orderItem.findMany({
    where: {
      order: {
        restaurantId,
        status: { not: "CANCELED" },
      },
    },
    include: {
      menuItem: {
        select: {
          id: true,
          name: true,
        },
      },
      order: {
        select: {
          id: true,
        },
      },
    },
  });

  // Aggregate by menu item
  const itemMap = new Map<
    string,
    {
      menuItemId: string;
      menuItemName: string;
      totalQuantity: number;
      orderIds: Set<string>;
      revenueCents: number;
    }
  >();

  for (const orderItem of orderItems) {
    const menuItemId = orderItem.menuItemId;
    const existing = itemMap.get(menuItemId);

    if (existing) {
      existing.totalQuantity += orderItem.quantity;
      existing.orderIds.add(orderItem.order.id);
      existing.revenueCents += orderItem.priceCents * orderItem.quantity;
    } else {
      itemMap.set(menuItemId, {
        menuItemId,
        menuItemName: orderItem.menuItem.name,
        totalQuantity: orderItem.quantity,
        orderIds: new Set([orderItem.order.id]),
        revenueCents: orderItem.priceCents * orderItem.quantity,
      });
    }
  }

  // Convert to array and sort by total quantity
  const popularItems: PopularItem[] = Array.from(itemMap.values())
    .map((item) => ({
      menuItemId: item.menuItemId,
      menuItemName: item.menuItemName,
      totalQuantity: item.totalQuantity,
      orderCount: item.orderIds.size,
      revenueCents: item.revenueCents,
    }))
    .sort((a, b) => b.totalQuantity - a.totalQuantity)
    .slice(0, limit);

  return popularItems;
};

/**
 * Get peak times for a restaurant
 * Returns hourly order statistics
 */
export const getPeakTimes = async (restaurantId: string): Promise<PeakTime[]> => {
  const orders = await prisma.order.findMany({
    where: {
      restaurantId,
      status: { not: "CANCELED" },
    },
    select: {
      id: true,
      totalCents: true,
      createdAt: true,
    },
  });

  // Initialize hour map (0-23)
  const hourMap = new Map<number, { orderCount: number; revenueCents: number }>();
  for (let hour = 0; hour < 24; hour++) {
    hourMap.set(hour, { orderCount: 0, revenueCents: 0 });
  }

  // Aggregate by hour
  for (const order of orders) {
    const hour = order.createdAt.getHours();
    const existing = hourMap.get(hour)!;
    existing.orderCount += 1;
    existing.revenueCents += order.totalCents;
  }

  // Convert to array and sort by order count
  const peakTimes: PeakTime[] = Array.from(hourMap.entries())
    .map(([hour, stats]) => ({
      hour,
      orderCount: stats.orderCount,
      revenueCents: stats.revenueCents,
    }))
    .sort((a, b) => b.orderCount - a.orderCount);

  return peakTimes;
};

/**
 * Get comprehensive analytics for a restaurant
 */
export const getRestaurantAnalytics = async (
  restaurantId: string,
  popularItemsLimit: number = 10,
): Promise<RestaurantAnalytics> => {
  const [popularItems, peakTimes, orderStats] = await Promise.all([
    getPopularItems(restaurantId, popularItemsLimit),
    getPeakTimes(restaurantId),
    prisma.order.aggregate({
      where: {
        restaurantId,
        status: { not: "CANCELED" },
      },
      _count: {
        id: true,
      },
      _sum: {
        totalCents: true,
      },
    }),
  ]);

  return {
    popularItems,
    peakTimes,
    totalOrders: orderStats._count.id,
    totalRevenueCents: orderStats._sum.totalCents ?? 0,
  };
};

