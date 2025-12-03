import { OrderStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { HttpError } from "../errors/HttpError";
import {
  createOrder,
  getOrderForCustomer,
  listOrdersForRestaurant,
  listOrdersForUser,
  updateOrderStatusForRestaurant,
  updateOrderRoute,
} from "../services/orderService";

type PrismaMock = ReturnType<typeof createPrismaMock>;

function createPrismaMock(): PrismaMock {
  const mock: Record<string, any> = {};
  mock.user = { create: vi.fn(), findUnique: vi.fn(), findMany: vi.fn() };
  mock.restaurant = { create: vi.fn(), findUnique: vi.fn(), findMany: vi.fn() };
  mock.menuSection = {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
  mock.menuItem = {
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
  mock.menuItemChangeLog = { create: vi.fn() };
  mock.order = {
    create: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
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

describe("services/orderService", () => {
  beforeEach(() => {
    resetPrismaMock(prisma);
  });

  const restaurant = {
    id: "rest-1",
    isActive: true,
  };

  const menuItems = [
    { id: "item-1", restaurantId: "rest-1", priceCents: 700, isAvailable: true },
    { id: "item-2", restaurantId: "rest-1", priceCents: 500, isAvailable: true },
  ];

  const attachItemsToOrder = (items: typeof menuItems, quantities: number[]) =>
    items.map((item, index) => ({
      id: `order-item-${index}`,
      menuItemId: item.id,
      quantity: quantities[index],
      priceCents: item.priceCents,
    }));

  it("creates an order for available items", async () => {
    prisma.restaurant.findUnique.mockResolvedValue(restaurant as any);
    prisma.menuItem.findMany.mockResolvedValue(menuItems as any);
    prisma.order.create.mockResolvedValue({
      id: "order-1",
      totalCents: 2057,
      items: attachItemsToOrder(menuItems, [2, 1]),
    } as any);

    const order = await createOrder("user-1", {
      restaurantId: "rest-1",
      items: [
        { menuItemId: "item-1", quantity: 2 },
        { menuItemId: "item-2", quantity: 1 },
      ],
      pickupEtaMin: 15,
      routeOrigin: "Campus",
      routeDestination: "Downtown",
    });

    expect(order).toMatchObject({
      id: "order-1",
      totalCents: 2057,
      subtotalCents: 1900,
      taxCents: 157,
    });
    expect(prisma.order.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        customerId: "user-1",
        restaurantId: "rest-1",
        totalCents: 2057,
        items: {
          create: [
            { menuItemId: "item-1", quantity: 2, priceCents: 700 },
            { menuItemId: "item-2", quantity: 1, priceCents: 500 },
          ],
        },
      }),
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
  });

  it("throws 404 when restaurant is missing or inactive", async () => {
    prisma.restaurant.findUnique.mockResolvedValue(null);
    await expect(
      createOrder("user-1", {
        restaurantId: "rest-1",
        items: [{ menuItemId: "item-1", quantity: 1 }],
        pickupEtaMin: 10,
        routeOrigin: "Campus",
        routeDestination: "Downtown",
      }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("throws when menu items are missing or unavailable", async () => {
    prisma.restaurant.findUnique.mockResolvedValue(restaurant as any);
    prisma.menuItem.findMany.mockResolvedValue([menuItems[0]] as any);
    await expect(
      createOrder("user-1", {
        restaurantId: "rest-1",
        items: [
          { menuItemId: "item-1", quantity: 1 },
          { menuItemId: "missing", quantity: 1 },
        ],
        pickupEtaMin: 10,
        routeOrigin: "Campus",
        routeDestination: "Downtown",
      }),
    ).rejects.toMatchObject({ status: 400, message: "Some menu items are unavailable" });
  });

  it("calculates totals using item quantities and prices", async () => {
    prisma.restaurant.findUnique.mockResolvedValue(restaurant as any);
    prisma.menuItem.findMany.mockResolvedValue(menuItems as any);
    prisma.order.create.mockResolvedValue({
      id: "order-1",
      totalCents: 2627,
      items: attachItemsToOrder(menuItems, [1, 3]),
    } as any);

    await createOrder("user-1", {
      restaurantId: "rest-1",
      items: [
        { menuItemId: "item-1", quantity: 1 },
        { menuItemId: "item-2", quantity: 3 },
      ],
      pickupEtaMin: 10,
      routeOrigin: "Campus",
      routeDestination: "Downtown",
    });

    const createArgs = prisma.order.create.mock.calls[0][0];
    const subtotal = 1 * 700 + 3 * 500;
    const expectedTax = Math.round(subtotal * 0.0825);
    expect(createArgs.data.totalCents).toBe(subtotal + expectedTax);
  });

  it("lists orders for a customer", async () => {
    const orders = [
      {
        id: "order-1",
        totalCents: 2100,
        items: [{ priceCents: 700, quantity: 3 }],
      },
    ];
    prisma.order.findMany.mockResolvedValue(orders as any);
    const result = await listOrdersForUser("user-1");
    expect(result[0]).toMatchObject({
      subtotalCents: 2100,
      taxCents: 0,
    });
    expect(prisma.order.findMany).toHaveBeenCalledWith({
      where: { customerId: "user-1" },
      include: {
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
      },
      orderBy: { createdAt: "desc" },
    });
  });

  it("lists orders for a restaurant", async () => {
    const orders = [
      {
        id: "order-1",
        totalCents: 2100,
        items: [{ priceCents: 700, quantity: 3 }],
      },
    ];
    prisma.order.findMany.mockResolvedValue(orders as any);
    const result = await listOrdersForRestaurant("rest-1");
    expect(result[0]).toMatchObject({
      subtotalCents: 2100,
      taxCents: 0,
    });
    expect(prisma.order.findMany).toHaveBeenCalledWith({
      where: { restaurantId: "rest-1" },
      include: {
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
      },
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    });
  });

  const statusTransitions: Array<[OrderStatus, OrderStatus]> = [
    [OrderStatus.PENDING, OrderStatus.PREPARING],
    [OrderStatus.PENDING, OrderStatus.CANCELED],
    [OrderStatus.PREPARING, OrderStatus.READY],
    [OrderStatus.READY, OrderStatus.COMPLETED],
  ];

  it.each(statusTransitions)(
    "allows status transition from %s to %s",
    async (currentStatus, nextStatus) => {
      prisma.order.findUnique.mockResolvedValue({
        id: "order-1",
        restaurantId: "rest-1",
        status: currentStatus,
        totalCents: 1000,
        items: [{ priceCents: 500, quantity: 2 }],
      } as any);
      prisma.order.update.mockResolvedValue({
        id: "order-1",
        status: nextStatus,
        totalCents: 1000,
        items: [{ priceCents: 500, quantity: 2 }],
      } as any);

      const order = await updateOrderStatusForRestaurant("rest-1", "order-1", nextStatus);
      expect(order).toMatchObject({
        status: nextStatus,
        subtotalCents: 1000,
        taxCents: 0,
      });
    },
  );

  it("returns existing order when status is unchanged", async () => {
    const existing = {
      id: "order-1",
      restaurantId: "rest-1",
      status: OrderStatus.PENDING,
      totalCents: 1500,
      items: [{ priceCents: 500, quantity: 3 }],
    } as any;
    prisma.order.findUnique.mockResolvedValue(existing);

    const result = await updateOrderStatusForRestaurant("rest-1", "order-1", OrderStatus.PENDING);
    expect(result).toMatchObject({
      status: OrderStatus.PENDING,
      subtotalCents: 1500,
      taxCents: 0,
    });
    expect(prisma.order.update).not.toHaveBeenCalled();
  });

  it("throws when order not found", async () => {
    prisma.order.findUnique.mockResolvedValue(null);
    await expect(
      updateOrderStatusForRestaurant("rest-1", "order-1", OrderStatus.PREPARING),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("throws when order belongs to a different restaurant", async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: "order-1",
      restaurantId: "rest-2",
      status: OrderStatus.PENDING,
    } as any);
    await expect(
      updateOrderStatusForRestaurant("rest-1", "order-1", OrderStatus.PREPARING),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("blocks invalid status transitions", async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: "order-1",
      restaurantId: "rest-1",
      status: OrderStatus.COMPLETED,
    } as any);
    await expect(
      updateOrderStatusForRestaurant("rest-1", "order-1", OrderStatus.PENDING),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("fetches a customer order when ownership matches", async () => {
    const order = {
      id: "order-1",
      customerId: "user-1",
      totalCents: 1000,
      items: [{ priceCents: 500, quantity: 2 }],
    };
    prisma.order.findUnique.mockResolvedValue(order as any);
    const result = await getOrderForCustomer("order-1", "user-1");
    expect(result).toMatchObject({
      id: "order-1",
      subtotalCents: 1000,
      taxCents: 0,
    });
    expect(prisma.order.findUnique).toHaveBeenCalledWith({
      where: { id: "order-1" },
      include: {
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
      },
    });
  });

  it("throws when fetching order for different customer", async () => {
    prisma.order.findUnique.mockResolvedValue({ id: "order-1", customerId: "user-2" } as any);
    await expect(getOrderForCustomer("order-1", "user-1")).rejects.toMatchObject({ status: 404 });
  });

  it("throws when order does not exist for customer lookup", async () => {
    prisma.order.findUnique.mockResolvedValue(null);
    await expect(getOrderForCustomer("order-1", "user-1")).rejects.toMatchObject({ status: 404 });
  });

  it("ensures order items store captured price at time of order", async () => {
    prisma.restaurant.findUnique.mockResolvedValue(restaurant as any);
    prisma.menuItem.findMany.mockResolvedValue([menuItems[0]] as any);
    prisma.order.create.mockResolvedValue({ id: "order-1" } as any);

    await createOrder("user-1", {
      restaurantId: "rest-1",
      items: [{ menuItemId: "item-1", quantity: 3 }],
      pickupEtaMin: 20,
      routeOrigin: "Point A",
      routeDestination: "Point B",
    });

    const orderItems = prisma.order.create.mock.calls[0][0].data.items.create;
    expect(orderItems[0]).toEqual({ menuItemId: "item-1", quantity: 3, priceCents: 700 });
  });

  it("honours different restaurants for listOrdersForRestaurant", async () => {
    prisma.order.findMany.mockResolvedValue([]);
    await listOrdersForRestaurant("rest-99");
    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { restaurantId: "rest-99" } }),
    );
  });

  it("produces descriptive HttpError instances", async () => {
    prisma.restaurant.findUnique.mockResolvedValue(null);
    await expect(
      createOrder("user-1", {
        restaurantId: "rest-1",
        items: [{ menuItemId: "item-1", quantity: 1 }],
        pickupEtaMin: 10,
        routeOrigin: "A",
        routeDestination: "B",
      }),
    ).rejects.toBeInstanceOf(HttpError);
  });

  describe("updateOrderRoute", () => {
    const baseOrder = {
      id: "order-1",
      customerId: "user-1",
      restaurantId: "rest-1",
      status: OrderStatus.PENDING,
      pickupEtaMin: 15,
      routeOrigin: "Campus",
      routeDestination: "Downtown",
      totalCents: 2000,
      items: [{ priceCents: 1000, quantity: 2 }],
      restaurant: { id: "rest-1", name: "Test Restaurant", address: "123 Main St" },
    };

    it("updates route origin for pending order", async () => {
      prisma.order.findUnique.mockResolvedValue(baseOrder as any);
      prisma.order.update.mockResolvedValue({
        ...baseOrder,
        routeOrigin: "New Origin",
      } as any);

      const result = await updateOrderRoute("order-1", "user-1", {
        routeOrigin: "New Origin",
      });

      expect(result).toMatchObject({
        routeOrigin: "New Origin",
        routeDestination: "Downtown",
        pickupEtaMin: 15,
      });
      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: "order-1" },
        data: { routeOrigin: "New Origin" },
        include: expect.any(Object),
      });
    });

    it("updates route destination for pending order", async () => {
      prisma.order.findUnique.mockResolvedValue(baseOrder as any);
      prisma.order.update.mockResolvedValue({
        ...baseOrder,
        routeDestination: "New Destination",
      } as any);

      const result = await updateOrderRoute("order-1", "user-1", {
        routeDestination: "New Destination",
      });

      expect(result).toMatchObject({
        routeOrigin: "Campus",
        routeDestination: "New Destination",
      });
    });

    it("updates pickupEtaMin for pending order", async () => {
      prisma.order.findUnique.mockResolvedValue(baseOrder as any);
      prisma.order.update.mockResolvedValue({
        ...baseOrder,
        pickupEtaMin: 20,
      } as any);

      const result = await updateOrderRoute("order-1", "user-1", {
        pickupEtaMin: 20,
      });

      expect(result).toMatchObject({
        pickupEtaMin: 20,
      });
    });

    it("updates all route fields at once", async () => {
      prisma.order.findUnique.mockResolvedValue(baseOrder as any);
      prisma.order.update.mockResolvedValue({
        ...baseOrder,
        routeOrigin: "Origin A",
        routeDestination: "Destination B",
        pickupEtaMin: 25,
      } as any);

      const result = await updateOrderRoute("order-1", "user-1", {
        routeOrigin: "Origin A",
        routeDestination: "Destination B",
        pickupEtaMin: 25,
      });

      expect(result).toMatchObject({
        routeOrigin: "Origin A",
        routeDestination: "Destination B",
        pickupEtaMin: 25,
      });
    });

    it("allows route update for PREPARING status", async () => {
      const preparingOrder = { ...baseOrder, status: OrderStatus.PREPARING };
      prisma.order.findUnique.mockResolvedValue(preparingOrder as any);
      prisma.order.update.mockResolvedValue({
        ...preparingOrder,
        routeOrigin: "Updated Origin",
      } as any);

      const result = await updateOrderRoute("order-1", "user-1", {
        routeOrigin: "Updated Origin",
      });

      expect(result).toMatchObject({
        routeOrigin: "Updated Origin",
      });
    });

    it("throws 404 when order not found", async () => {
      prisma.order.findUnique.mockResolvedValue(null);
      await expect(
        updateOrderRoute("order-1", "user-1", { routeOrigin: "New Origin" }),
      ).rejects.toMatchObject({ status: 404 });
    });

    it("throws 404 when order belongs to different customer", async () => {
      prisma.order.findUnique.mockResolvedValue({
        ...baseOrder,
        customerId: "user-2",
      } as any);
      await expect(
        updateOrderRoute("order-1", "user-1", { routeOrigin: "New Origin" }),
      ).rejects.toMatchObject({ status: 404 });
    });

    it("throws 400 when order status is READY", async () => {
      const readyOrder = { ...baseOrder, status: OrderStatus.READY };
      prisma.order.findUnique.mockResolvedValue(readyOrder as any);
      await expect(
        updateOrderRoute("order-1", "user-1", { routeOrigin: "New Origin" }),
      ).rejects.toMatchObject({
        status: 400,
        message: expect.stringContaining("READY"),
      });
    });

    it("throws 400 when order status is COMPLETED", async () => {
      const completedOrder = { ...baseOrder, status: OrderStatus.COMPLETED };
      prisma.order.findUnique.mockResolvedValue(completedOrder as any);
      await expect(
        updateOrderRoute("order-1", "user-1", { routeOrigin: "New Origin" }),
      ).rejects.toMatchObject({
        status: 400,
        message: expect.stringContaining("COMPLETED"),
      });
    });

    it("throws 400 when order status is CANCELED", async () => {
      const canceledOrder = { ...baseOrder, status: OrderStatus.CANCELED };
      prisma.order.findUnique.mockResolvedValue(canceledOrder as any);
      await expect(
        updateOrderRoute("order-1", "user-1", { routeOrigin: "New Origin" }),
      ).rejects.toMatchObject({
        status: 400,
        message: expect.stringContaining("CANCELED"),
      });
    });

    it("throws 400 when pickupEtaMin is not positive", async () => {
      prisma.order.findUnique.mockResolvedValue(baseOrder as any);
      await expect(
        updateOrderRoute("order-1", "user-1", { pickupEtaMin: 0 }),
      ).rejects.toMatchObject({ status: 400 });
      await expect(
        updateOrderRoute("order-1", "user-1", { pickupEtaMin: -5 }),
      ).rejects.toMatchObject({ status: 400 });
    });

    it("throws 400 when no route fields are provided", async () => {
      prisma.order.findUnique.mockResolvedValue(baseOrder as any);
      await expect(updateOrderRoute("order-1", "user-1", {})).rejects.toMatchObject({
        status: 400,
        message: expect.stringContaining("At least one route field"),
      });
    });
  });
});
