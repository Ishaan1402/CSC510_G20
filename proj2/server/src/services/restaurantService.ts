import type { MenuItem } from "@prisma/client";
import { MenuItemAction } from "@prisma/client";

import { HttpError } from "../errors/HttpError";
import { prisma } from "../lib/prisma";
import { log } from "../logger";

type SectionCreateInput = {
  title: string;
  position?: number;
};

type SectionUpdateInput = {
  title?: string;
  position?: number;
};

type ItemInput = {
  sectionId?: string | null;
  name?: string;
  description?: string;
  priceCents?: number;
  isAvailable?: boolean;
  tags?: string[];
};

type RestaurantFilters = {
  fastService?: boolean;
  dietaryNeeds?: "vegetarian" | "vegan";
  localFavorites?: boolean;
  priceLevel?: "BUDGET" | "MID" | "UPSCALE";
};

export const getActiveRestaurants = async (filters?: RestaurantFilters) => {
  try {
    const whereClause: any = { isActive: true };

    if (filters?.fastService === true) {
      whereClause.isFastService = true;
    }

    if (filters?.localFavorites === true) {
      whereClause.isLocalFavorite = true;
    }

    if (filters?.priceLevel) {
      whereClause.priceLevel = filters.priceLevel;
    }

    let restaurants = await prisma.restaurant.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        address: true,
        latitude: true,
        longitude: true,
      },
      orderBy: { name: "asc" },
    });

    // Filter by dietary needs if specified
    if (filters?.dietaryNeeds) {
      try {
        const dietaryTag = filters.dietaryNeeds;
        const restaurantIds = await prisma.menuItem.findMany({
          where: {
            restaurant: { isActive: true },
            tags: { has: dietaryTag },
            isAvailable: true,
          },
          select: { restaurantId: true },
          distinct: ["restaurantId"],
        });

        const validRestaurantIds = new Set(restaurantIds.map((item) => item.restaurantId));
        restaurants = restaurants.filter((restaurant) => validRestaurantIds.has(restaurant.id));
      } catch (dietaryError) {
        // If dietary filtering fails, log but continue with existing restaurants
        console.warn("Error filtering by dietary needs:", dietaryError);
      }
    }

    return restaurants;
  } catch (error) {
    console.error("Error in getActiveRestaurants:", error);
    // Return empty array on error instead of throwing
    return [];
  }
};

export const getRestaurantMenu = async (restaurantId: string) => {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId, isActive: true },
    include: {
      sections: {
        orderBy: { position: "asc" },
        include: {
          items: {
            orderBy: { name: "asc" },
          },
        },
      },
      menuItems: {
        where: { sectionId: null },
        orderBy: { name: "asc" },
      },
    },
  });

  if (!restaurant) {
    throw new HttpError(404, "Restaurant not found");
  }

  const sections = restaurant.sections.map((section) => ({
    id: section.id,
    title: section.title,
    position: section.position,
    items: section.items,
  }));

  if (restaurant.menuItems.length) {
    sections.push({
      id: "ungrouped",
      title: "Featured",
      position: sections.length,
      items: restaurant.menuItems,
    });
  }

  return {
    restaurant: {
      id: restaurant.id,
      name: restaurant.name,
      address: restaurant.address,
      latitude: restaurant.latitude,
      longitude: restaurant.longitude,
    },
    sections,
  };
};

export const createMenuSection = (restaurantId: string, input: SectionCreateInput) =>
  prisma.menuSection.create({
    data: {
      restaurantId,
      title: input.title,
      position: input.position ?? 0,
    },
  });

export const updateMenuSection = async (
  restaurantId: string,
  sectionId: string,
  input: SectionUpdateInput,
) => {
  const section = await prisma.menuSection.findUnique({
    where: { id: sectionId, restaurantId },
  });
  if (!section) {
    throw new HttpError(404, "Section not found");
  }

  return prisma.menuSection.update({
    where: { id: sectionId },
    data: {
      title: input.title ?? section.title,
      position: input.position ?? section.position,
    },
  });
};

export const deleteMenuSection = async (restaurantId: string, sectionId: string) => {
  const section = await prisma.menuSection.findUnique({
    where: { id: sectionId, restaurantId },
  });
  if (!section) {
    throw new HttpError(404, "Section not found");
  }

  await prisma.menuSection.delete({ where: { id: sectionId } });
};

const logMenuChange = async ({
  restaurantId,
  menuItemId,
  userId,
  action,
  before,
  after,
}: {
  restaurantId: string;
  menuItemId: string;
  userId: string;
  action: MenuItemAction;
  before?: MenuItem | null;
  after?: MenuItem | null;
}) => {
  await prisma.menuItemChangeLog.create({
    data: {
      restaurantId,
      menuItemId,
      userId,
      action,
      beforeJSON: before ? JSON.stringify(before) : undefined,
      afterJSON: after ? JSON.stringify(after) : undefined,
    },
  });

  log.info("menu_item_change", { action, restaurantId, menuItemId });
};

export const createMenuItem = async (restaurantId: string, userId: string, input: ItemInput) => {
  const item = await prisma.menuItem.create({
    data: {
      restaurantId,
      sectionId: input.sectionId ?? null,
      name: input.name ?? "Untitled Item",
      description: input.description ?? "",
      priceCents: input.priceCents ?? 0,
      isAvailable: input.isAvailable ?? true,
      tags: input.tags ?? [],
    },
  });

  await logMenuChange({
    restaurantId,
    menuItemId: item.id,
    userId,
    action: MenuItemAction.CREATE,
    after: item,
  });

  return item;
};

export const updateMenuItem = async (
  restaurantId: string,
  itemId: string,
  userId: string,
  input: ItemInput,
) => {
  const existing = await prisma.menuItem.findFirst({
    where: { id: itemId, restaurantId },
  });
  if (!existing) {
    throw new HttpError(404, "Menu item not found");
  }

  const updated = await prisma.menuItem.update({
    where: { id: itemId },
    data: {
      sectionId: input.sectionId === undefined ? existing.sectionId : input.sectionId,
      name: input.name ?? existing.name,
      description: input.description ?? existing.description,
      priceCents: input.priceCents ?? existing.priceCents,
      isAvailable: input.isAvailable ?? existing.isAvailable,
      tags: input.tags ?? existing.tags,
    },
  });

  await logMenuChange({
    restaurantId,
    menuItemId: itemId,
    userId,
    action: MenuItemAction.UPDATE,
    before: existing,
    after: updated,
  });

  return updated;
};

export const deleteMenuItem = async (restaurantId: string, itemId: string, userId: string) => {
  const existing = await prisma.menuItem.findFirst({
    where: { id: itemId, restaurantId },
  });
  if (!existing) {
    throw new HttpError(404, "Menu item not found");
  }

  await prisma.menuItem.delete({ where: { id: itemId } });

  await logMenuChange({
    restaurantId,
    menuItemId: itemId,
    userId,
    action: MenuItemAction.DELETE,
    before: existing,
  });
};
