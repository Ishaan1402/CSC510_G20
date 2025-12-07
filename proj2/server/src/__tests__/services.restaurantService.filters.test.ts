import { beforeEach, describe, expect, it, vi } from "vitest";

import { getActiveRestaurants } from "../services/restaurantService";

type PrismaMock = ReturnType<typeof createPrismaMock>;

function createPrismaMock(): PrismaMock {
  const mock: Record<string, any> = {};
  mock.restaurant = { findMany: vi.fn() };
  mock.menuItem = { findMany: vi.fn() };
  const prismaMock = mock as PrismaMock;
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
}

const prisma: PrismaMock = vi.hoisted(() => createPrismaMock());

vi.mock("../lib/prisma", () => ({
  prisma,
}));

describe("services/restaurantService - Traveler Filters", () => {
  beforeEach(() => {
    resetPrismaMock(prisma);
  });

  it("filters restaurants by fastService", async () => {
    const fastRestaurants = [
      { id: "rest-1", name: "Fast Food", address: "1 St", latitude: 0, longitude: 0 },
    ];
    prisma.restaurant.findMany.mockResolvedValue(fastRestaurants as any);

    const result = await getActiveRestaurants({ fastService: true });

    expect(prisma.restaurant.findMany).toHaveBeenCalledWith({
      where: { isActive: true, isFastService: true },
      select: {
        id: true,
        name: true,
        address: true,
        latitude: true,
        longitude: true,
      },
      orderBy: { name: "asc" },
    });
    expect(result).toBe(fastRestaurants);
  });

  it("filters restaurants by localFavorites", async () => {
    const favoriteRestaurants = [
      { id: "rest-2", name: "Local Gem", address: "2 St", latitude: 0, longitude: 0 },
    ];
    prisma.restaurant.findMany.mockResolvedValue(favoriteRestaurants as any);

    const result = await getActiveRestaurants({ localFavorites: true });

    expect(prisma.restaurant.findMany).toHaveBeenCalledWith({
      where: { isActive: true, isLocalFavorite: true },
      select: {
        id: true,
        name: true,
        address: true,
        latitude: true,
        longitude: true,
      },
      orderBy: { name: "asc" },
    });
    expect(result).toBe(favoriteRestaurants);
  });

  it("filters restaurants by priceLevel", async () => {
    const budgetRestaurants = [
      { id: "rest-3", name: "Budget Eats", address: "3 St", latitude: 0, longitude: 0 },
    ];
    prisma.restaurant.findMany.mockResolvedValue(budgetRestaurants as any);

    const result = await getActiveRestaurants({ priceLevel: "BUDGET" });

    expect(prisma.restaurant.findMany).toHaveBeenCalledWith({
      where: { isActive: true, priceLevel: "BUDGET" },
      select: {
        id: true,
        name: true,
        address: true,
        latitude: true,
        longitude: true,
      },
      orderBy: { name: "asc" },
    });
    expect(result).toBe(budgetRestaurants);
  });

  it("filters restaurants by dietary needs (vegetarian)", async () => {
    const allRestaurants = [
      { id: "rest-1", name: "Veg Place", address: "1 St", latitude: 0, longitude: 0 },
      { id: "rest-2", name: "Meat Place", address: "2 St", latitude: 0, longitude: 0 },
    ];
    prisma.restaurant.findMany.mockResolvedValue(allRestaurants as any);
    prisma.menuItem.findMany.mockResolvedValue([
      { restaurantId: "rest-1" },
    ] as any);

    const result = await getActiveRestaurants({ dietaryNeeds: "vegetarian" });

    expect(prisma.menuItem.findMany).toHaveBeenCalledWith({
      where: {
        restaurant: { isActive: true },
        tags: { has: "vegetarian" },
        isAvailable: true,
      },
      select: { restaurantId: true },
      distinct: ["restaurantId"],
    });
    expect(result).toEqual([allRestaurants[0]]);
  });

  it("filters restaurants by dietary needs (vegan)", async () => {
    const allRestaurants = [
      { id: "rest-1", name: "Vegan Place", address: "1 St", latitude: 0, longitude: 0 },
      { id: "rest-2", name: "Regular Place", address: "2 St", latitude: 0, longitude: 0 },
    ];
    prisma.restaurant.findMany.mockResolvedValue(allRestaurants as any);
    prisma.menuItem.findMany.mockResolvedValue([
      { restaurantId: "rest-1" },
    ] as any);

    const result = await getActiveRestaurants({ dietaryNeeds: "vegan" });

    expect(prisma.menuItem.findMany).toHaveBeenCalledWith({
      where: {
        restaurant: { isActive: true },
        tags: { has: "vegan" },
        isAvailable: true,
      },
      select: { restaurantId: true },
      distinct: ["restaurantId"],
    });
    expect(result).toEqual([allRestaurants[0]]);
  });

  it("combines multiple filters (fastService + priceLevel)", async () => {
    const filteredRestaurants = [
      { id: "rest-1", name: "Fast Mid", address: "1 St", latitude: 0, longitude: 0 },
    ];
    prisma.restaurant.findMany.mockResolvedValue(filteredRestaurants as any);

    const result = await getActiveRestaurants({ fastService: true, priceLevel: "MID" });

    expect(prisma.restaurant.findMany).toHaveBeenCalledWith({
      where: { isActive: true, isFastService: true, priceLevel: "MID" },
      select: {
        id: true,
        name: true,
        address: true,
        latitude: true,
        longitude: true,
      },
      orderBy: { name: "asc" },
    });
    expect(result).toBe(filteredRestaurants);
  });

  it("combines all filters including dietary needs", async () => {
    const allRestaurants = [
      { id: "rest-1", name: "Perfect Match", address: "1 St", latitude: 0, longitude: 0 },
      { id: "rest-2", name: "No Match", address: "2 St", latitude: 0, longitude: 0 },
    ];
    prisma.restaurant.findMany.mockResolvedValue(allRestaurants as any);
    prisma.menuItem.findMany.mockResolvedValue([
      { restaurantId: "rest-1" },
    ] as any);

    const result = await getActiveRestaurants({
      fastService: true,
      localFavorites: true,
      priceLevel: "MID",
      dietaryNeeds: "vegetarian",
    });

    expect(prisma.restaurant.findMany).toHaveBeenCalledWith({
      where: {
        isActive: true,
        isFastService: true,
        isLocalFavorite: true,
        priceLevel: "MID",
      },
      select: {
        id: true,
        name: true,
        address: true,
        latitude: true,
        longitude: true,
      },
      orderBy: { name: "asc" },
    });
    expect(result).toEqual([allRestaurants[0]]);
  });

  it("returns empty array on database error", async () => {
    prisma.restaurant.findMany.mockRejectedValue(new Error("Database error"));

    const result = await getActiveRestaurants({ fastService: true });

    expect(result).toEqual([]);
  });

  it("handles dietary filter errors gracefully", async () => {
    const allRestaurants = [
      { id: "rest-1", name: "Place", address: "1 St", latitude: 0, longitude: 0 },
    ];
    prisma.restaurant.findMany.mockResolvedValue(allRestaurants as any);
    prisma.menuItem.findMany.mockRejectedValue(new Error("Dietary filter error"));

    const result = await getActiveRestaurants({ dietaryNeeds: "vegetarian" });

    // Should return all restaurants when dietary filter fails
    expect(result).toBe(allRestaurants);
  });

  it("returns all restaurants when no filters provided", async () => {
    const allRestaurants = [
      { id: "rest-1", name: "A", address: "1 St", latitude: 0, longitude: 0 },
      { id: "rest-2", name: "B", address: "2 St", latitude: 0, longitude: 0 },
    ];
    prisma.restaurant.findMany.mockResolvedValue(allRestaurants as any);

    const result = await getActiveRestaurants();

    expect(prisma.restaurant.findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        address: true,
        latitude: true,
        longitude: true,
      },
      orderBy: { name: "asc" },
    });
    expect(result).toBe(allRestaurants);
  });
});


