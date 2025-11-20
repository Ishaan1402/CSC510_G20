import { OrderStatus } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

import { requireAuth, requireRole } from "../middleware/auth";
import { ensureRestaurantOwnership } from "../middleware/ownership";
import { listOrdersForRestaurant, updateOrderStatusForRestaurant } from "../services/orderService";
import {
  getActiveRestaurants,
  getRestaurantMenu,
  createMenuSection,
  updateMenuSection,
  deleteMenuSection,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
} from "../services/restaurantService";

const restaurantIdParam = z.object({
  restaurantId: z.string().uuid(),
});

const sectionPayload = z.object({
  title: z.string().min(1),
  position: z.number().int().nonnegative().optional(),
});

const sectionUpdatePayload = z.object({
  title: z.string().min(1).optional(),
  position: z.number().int().nonnegative().optional(),
});

const itemPayload = z.object({
  sectionId: z.string().uuid().nullable().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  priceCents: z.number().int().nonnegative(),
  isAvailable: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
});

const itemUpdatePayload = itemPayload.partial();

const orderStatusPayload = z.object({
  status: z.nativeEnum(OrderStatus),
});

const restaurantFiltersQuery = z.object({
  fastService: z.preprocess(
    (val) => (val === "true" ? true : val === "false" ? false : undefined),
    z.boolean().optional(),
  ),
  dietaryNeeds: z.enum(["vegetarian", "vegan"]).optional(),
  localFavorites: z.preprocess(
    (val) => (val === "true" ? true : val === "false" ? false : undefined),
    z.boolean().optional(),
  ),
  priceLevel: z.enum(["BUDGET", "MID", "UPSCALE"]).optional(),
});

export const restaurantRouter = Router();

restaurantRouter.get("/", async (req, res, next) => {
  try {
    // Safely parse query parameters with fallback to empty object
    let filters: {
      fastService?: boolean;
      dietaryNeeds?: "vegetarian" | "vegan";
      localFavorites?: boolean;
      priceLevel?: "BUDGET" | "MID" | "UPSCALE";
    } = {};

    try {
      const parsed = restaurantFiltersQuery.safeParse(req.query);
      if (parsed.success) {
        filters = {
          fastService: parsed.data.fastService ?? undefined,
          dietaryNeeds: parsed.data.dietaryNeeds,
          localFavorites: parsed.data.localFavorites ?? undefined,
          priceLevel: parsed.data.priceLevel,
        };
      }
    } catch (parseError) {
      // If parsing fails, continue with empty filters (show all restaurants)
      console.warn("Failed to parse restaurant filters:", parseError);
    }

    // Get restaurants with error handling
    const restaurants = await getActiveRestaurants(filters).catch((dbError) => {
      console.error("Database error fetching restaurants:", dbError);
      // Return empty array on error instead of throwing
      return [];
    });

    res.json({ restaurants: restaurants || [] });
  } catch (error) {
    // Final fallback - return empty array on any unexpected error
    console.error("Unexpected error in restaurants route:", error);
    res.json({ restaurants: [] });
  }
});

restaurantRouter.get("/:restaurantId/menu", async (req, res, next) => {
  try {
    const { restaurantId } = restaurantIdParam.parse(req.params);
    const result = await getRestaurantMenu(restaurantId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

restaurantRouter.get(
  "/:restaurantId/orders",
  requireAuth,
  requireRole("RESTAURANT"),
  ensureRestaurantOwnership,
  async (req, res, next) => {
    try {
      const { restaurantId } = restaurantIdParam.parse(req.params);
      const orders = await listOrdersForRestaurant(restaurantId);
      res.json({ orders });
    } catch (error) {
      next(error);
    }
  },
);

restaurantRouter.post(
  "/:restaurantId/menu/sections",
  requireAuth,
  requireRole("RESTAURANT"),
  ensureRestaurantOwnership,
  async (req, res, next) => {
    try {
      const { restaurantId } = restaurantIdParam.parse(req.params);
      const payload = sectionPayload.parse(req.body);
      const section = await createMenuSection(restaurantId, payload);
      res.status(201).json({ section });
    } catch (error) {
      next(error);
    }
  },
);

restaurantRouter.patch(
  "/:restaurantId/menu/sections/:sectionId",
  requireAuth,
  requireRole("RESTAURANT"),
  ensureRestaurantOwnership,
  async (req, res, next) => {
    try {
      const params = restaurantIdParam.extend({ sectionId: z.string().uuid() }).parse(req.params);
      const payload = sectionUpdatePayload.parse(req.body);
      const section = await updateMenuSection(params.restaurantId, params.sectionId, payload);
      res.json({ section });
    } catch (error) {
      next(error);
    }
  },
);

restaurantRouter.delete(
  "/:restaurantId/menu/sections/:sectionId",
  requireAuth,
  requireRole("RESTAURANT"),
  ensureRestaurantOwnership,
  async (req, res, next) => {
    try {
      const params = restaurantIdParam.extend({ sectionId: z.string().uuid() }).parse(req.params);
      await deleteMenuSection(params.restaurantId, params.sectionId);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  },
);

restaurantRouter.post(
  "/:restaurantId/menu/items",
  requireAuth,
  requireRole("RESTAURANT"),
  ensureRestaurantOwnership,
  async (req, res, next) => {
    try {
      const { restaurantId } = restaurantIdParam.parse(req.params);
      const payload = itemPayload.parse(req.body);
      const item = await createMenuItem(restaurantId, req.user!.id, payload);
      res.status(201).json({ item });
    } catch (error) {
      next(error);
    }
  },
);

restaurantRouter.patch(
  "/:restaurantId/menu/items/:itemId",
  requireAuth,
  requireRole("RESTAURANT"),
  ensureRestaurantOwnership,
  async (req, res, next) => {
    try {
      const params = restaurantIdParam.extend({ itemId: z.string().uuid() }).parse(req.params);
      const payload = itemUpdatePayload.parse(req.body);
      const item = await updateMenuItem(params.restaurantId, params.itemId, req.user!.id, payload);
      res.json({ item });
    } catch (error) {
      next(error);
    }
  },
);

restaurantRouter.delete(
  "/:restaurantId/menu/items/:itemId",
  requireAuth,
  requireRole("RESTAURANT"),
  ensureRestaurantOwnership,
  async (req, res, next) => {
    try {
      const params = restaurantIdParam.extend({ itemId: z.string().uuid() }).parse(req.params);
      await deleteMenuItem(params.restaurantId, params.itemId, req.user!.id);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  },
);

restaurantRouter.patch(
  "/:restaurantId/orders/:orderId",
  requireAuth,
  requireRole("RESTAURANT"),
  ensureRestaurantOwnership,
  async (req, res, next) => {
    try {
      const params = restaurantIdParam.extend({ orderId: z.string().uuid() }).parse(req.params);
      const payload = orderStatusPayload.parse(req.body);
      const order = await updateOrderStatusForRestaurant(
        params.restaurantId,
        params.orderId,
        payload.status,
      );
      res.json({ order });
    } catch (error) {
      next(error);
    }
  },
);
