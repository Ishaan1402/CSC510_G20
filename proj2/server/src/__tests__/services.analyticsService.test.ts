import { OrderStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getPopularItems, getPeakTimes, getRestaurantAnalytics } from "../services/analyticsService";

type PrismaMock = ReturnType<typeof createPrismaMock>;

function createPrismaMock(): PrismaMock {
  const mock: Record<string, any> = {};
  mock.order = {
    findMany: vi.fn(),
    aggregate: vi.fn(),
  };
  mock.orderItem = {
    findMany: vi.fn(),
  };
  const prismaMock = mock as PrismaMock;
  prismaMock.$transaction = vi.fn(async (callback: (client: PrismaMock) => Promise<unknown>) =>
    callback(prismaMock),
  );
  return prismaMock;
}

function resetDeepMocks(obj: Record<string, any>) {
  Object.values(obj).forEach((value) => {
    if (typeof value === "function" && "mockReset" in value) {
      value.mockReset();
    } else if (value && typeof value === "object") {
      resetDeepMocks(value as Record<string, any>);
    }
  });
}

function resetPrismaMock(mock: PrismaMock) {
  resetDeepMocks(mock as Record<string, any>);
  mock.$transaction.mockImplementation(async (callback: (client: PrismaMock) => Promise<unknown>) =>
    callback(mock),
  );
}

const prisma: PrismaMock = vi.hoisted(() => createPrismaMock());

vi.mock("../lib/prisma", () => ({
  prisma,
}));

describe("services/analyticsService", () => {
  beforeEach(() => {
    resetPrismaMock(prisma);
  });

  describe("getPopularItems", () => {
    it("returns popular items sorted by total quantity", async () => {
      const orderItems = [
        {
          id: "oi-1",
          menuItemId: "item-1",
          quantity: 5,
          priceCents: 1000,
          menuItem: { id: "item-1", name: "Burger" },
          order: { id: "order-1" },
        },
        {
          id: "oi-2",
          menuItemId: "item-1",
          quantity: 3,
          priceCents: 1000,
          menuItem: { id: "item-1", name: "Burger" },
          order: { id: "order-2" },
        },
        {
          id: "oi-3",
          menuItemId: "item-2",
          quantity: 10,
          priceCents: 500,
          menuItem: { id: "item-2", name: "Fries" },
          order: { id: "order-1" },
        },
        {
          id: "oi-4",
          menuItemId: "item-3",
          quantity: 2,
          priceCents: 1500,
          menuItem: { id: "item-3", name: "Salad" },
          order: { id: "order-3" },
        },
      ];

      prisma.orderItem.findMany.mockResolvedValue(orderItems as any);

      const result = await getPopularItems("rest-1");

      expect(result).toHaveLength(3);
      expect(result[0]).toMatchObject({
        menuItemId: "item-2",
        menuItemName: "Fries",
        totalQuantity: 10,
        orderCount: 1,
        revenueCents: 5000,
      });
      expect(result[1]).toMatchObject({
        menuItemId: "item-1",
        menuItemName: "Burger",
        totalQuantity: 8,
        orderCount: 2,
        revenueCents: 8000,
      });
      expect(result[2]).toMatchObject({
        menuItemId: "item-3",
        menuItemName: "Salad",
        totalQuantity: 2,
        orderCount: 1,
        revenueCents: 3000,
      });
    });

    it("excludes canceled orders", async () => {
      prisma.orderItem.findMany.mockResolvedValue([]);
      await getPopularItems("rest-1");
      expect(prisma.orderItem.findMany).toHaveBeenCalledWith({
        where: {
          order: {
            restaurantId: "rest-1",
            status: { not: "CANCELED" },
          },
        },
        include: expect.any(Object),
      });
    });

    it("respects limit parameter", async () => {
      const orderItems = Array.from({ length: 20 }, (_, i) => ({
        id: `oi-${i}`,
        menuItemId: `item-${i}`,
        quantity: 20 - i,
        priceCents: 1000,
        menuItem: { id: `item-${i}`, name: `Item ${i}` },
        order: { id: `order-${i}` },
      }));

      prisma.orderItem.findMany.mockResolvedValue(orderItems as any);

      const result = await getPopularItems("rest-1", 5);
      expect(result).toHaveLength(5);
    });

    it("calculates revenue correctly", async () => {
      const orderItems = [
        {
          id: "oi-1",
          menuItemId: "item-1",
          quantity: 3,
          priceCents: 1000,
          menuItem: { id: "item-1", name: "Burger" },
          order: { id: "order-1" },
        },
        {
          id: "oi-2",
          menuItemId: "item-1",
          quantity: 2,
          priceCents: 1000,
          menuItem: { id: "item-1", name: "Burger" },
          order: { id: "order-2" },
        },
      ];

      prisma.orderItem.findMany.mockResolvedValue(orderItems as any);

      const result = await getPopularItems("rest-1");
      expect(result[0].revenueCents).toBe(5000); // (3 + 2) * 1000
    });
  });

  describe("getPeakTimes", () => {
    it("returns peak times sorted by order count", async () => {
      const now = new Date();
      const orders = [
        {
          id: "order-1",
          totalCents: 2000,
          createdAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0), // 12:00
        },
        {
          id: "order-2",
          totalCents: 1500,
          createdAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 30), // 12:30
        },
        {
          id: "order-3",
          totalCents: 3000,
          createdAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 18, 0), // 18:00
        },
        {
          id: "order-4",
          totalCents: 1000,
          createdAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 15), // 12:15
        },
      ];

      prisma.order.findMany.mockResolvedValue(orders as any);

      const result = await getPeakTimes("rest-1");

      // Should have 24 hours
      expect(result).toHaveLength(24);

      // Hour 12 should have 3 orders
      const hour12 = result.find((pt) => pt.hour === 12);
      expect(hour12).toMatchObject({
        hour: 12,
        orderCount: 3,
        revenueCents: 4500, // 2000 + 1500 + 1000
      });

      // Hour 18 should have 1 order
      const hour18 = result.find((pt) => pt.hour === 18);
      expect(hour18).toMatchObject({
        hour: 18,
        orderCount: 1,
        revenueCents: 3000,
      });

      // Should be sorted by order count descending
      expect(result[0].orderCount).toBeGreaterThanOrEqual(result[1].orderCount);
    });

    it("excludes canceled orders", async () => {
      prisma.order.findMany.mockResolvedValue([]);
      await getPeakTimes("rest-1");
      expect(prisma.order.findMany).toHaveBeenCalledWith({
        where: {
          restaurantId: "rest-1",
          status: { not: "CANCELED" },
        },
        select: {
          id: true,
          totalCents: true,
          createdAt: true,
        },
      });
    });

    it("returns all 24 hours even with no orders", async () => {
      prisma.order.findMany.mockResolvedValue([]);
      const result = await getPeakTimes("rest-1");
      expect(result).toHaveLength(24);
      expect(result.every((pt) => pt.orderCount === 0 && pt.revenueCents === 0)).toBe(true);
    });
  });

  describe("getRestaurantAnalytics", () => {
    it("returns comprehensive analytics", async () => {
      const orderItems = [
        {
          id: "oi-1",
          menuItemId: "item-1",
          quantity: 5,
          priceCents: 1000,
          menuItem: { id: "item-1", name: "Burger" },
          order: { id: "order-1" },
        },
      ];

      const orders = [
        {
          id: "order-1",
          totalCents: 5000,
          createdAt: new Date(2024, 0, 1, 12, 0),
        },
        {
          id: "order-2",
          totalCents: 3000,
          createdAt: new Date(2024, 0, 1, 18, 0),
        },
      ];

      prisma.orderItem.findMany.mockResolvedValue(orderItems as any);
      prisma.order.findMany.mockResolvedValue(orders as any);
      prisma.order.aggregate.mockResolvedValue({
        _count: { id: 2 },
        _sum: { totalCents: 8000 },
      } as any);

      const result = await getRestaurantAnalytics("rest-1");

      expect(result).toMatchObject({
        totalOrders: 2,
        totalRevenueCents: 8000,
      });
      expect(result.popularItems).toBeDefined();
      expect(result.peakTimes).toBeDefined();
    });

    it("respects popularItemsLimit parameter", async () => {
      const orderItems = Array.from({ length: 20 }, (_, i) => ({
        id: `oi-${i}`,
        menuItemId: `item-${i}`,
        quantity: 1,
        priceCents: 1000,
        menuItem: { id: `item-${i}`, name: `Item ${i}` },
        order: { id: `order-${i}` },
      }));

      prisma.orderItem.findMany.mockResolvedValue(orderItems as any);
      prisma.order.findMany.mockResolvedValue([]);
      prisma.order.aggregate.mockResolvedValue({
        _count: { id: 0 },
        _sum: { totalCents: 0 },
      } as any);

      const result = await getRestaurantAnalytics("rest-1", 5);
      expect(result.popularItems).toHaveLength(5);
    });

    it("handles zero orders gracefully", async () => {
      prisma.orderItem.findMany.mockResolvedValue([]);
      prisma.order.findMany.mockResolvedValue([]);
      prisma.order.aggregate.mockResolvedValue({
        _count: { id: 0 },
        _sum: { totalCents: null },
      } as any);

      const result = await getRestaurantAnalytics("rest-1");

      expect(result).toMatchObject({
        totalOrders: 0,
        totalRevenueCents: 0,
        popularItems: [],
        peakTimes: expect.any(Array),
      });
    });
  });
});

