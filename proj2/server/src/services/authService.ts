import { Prisma, UserRole } from "@prisma/client";

import { HttpError } from "../errors/HttpError";
import { prisma } from "../lib/prisma";
import { hashPassword, verifyPassword } from "../utils/password";

type CreateCustomerInput = {
  name: string;
  email: string;
  password: string;
};

type CreateRestaurantInput = {
  name: string;
  email: string;
  password: string;
  restaurantName: string;
  address: string;
  latitude?: number;
  longitude?: number;
};

export const serializeUser = (user: {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  vehicleType?: string | null;
  restaurants?: { id: string }[];
}) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  vehicleType: user.vehicleType ?? null,
  restaurantId: user.restaurants?.[0]?.id,
});

export const createCustomer = async ({ name, email, password }: CreateCustomerInput) => {
  const passwordHash = await hashPassword(password);

  try {
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: UserRole.CUSTOMER,
      },
    });

    return user;
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new HttpError(409, "Email already registered");
    }
    throw error;
  }
};

export const createRestaurantOwner = async ({
  name,
  email,
  password,
  restaurantName,
  address,
  latitude,
  longitude,
}: CreateRestaurantInput) => {
  const passwordHash = await hashPassword(password);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name,
          email,
          passwordHash,
          role: UserRole.RESTAURANT,
        },
      });

      const restaurant = await tx.restaurant.create({
        data: {
          ownerUserId: user.id,
          name: restaurantName,
          address,
          latitude,
          longitude,
        },
      });

      return { user, restaurant };
    });

    return result;
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new HttpError(409, "Email already registered");
    }
    throw error;
  }
};

export const authenticateUser = async (email: string, password: string) => {
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      restaurants: {
        select: { id: true },
        take: 1,
      },
    },
  });

  if (!user) {
    throw new HttpError(401, "Invalid credentials");
  }

  const isValid = await verifyPassword(password, user.passwordHash);

  if (!isValid) {
    throw new HttpError(401, "Invalid credentials");
  }

  return user;
};

export const updateUserProfile = async (userId: string, vehicleType: "GAS" | "EV" | null) => {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { vehicleType },
    include: {
      restaurants: {
        select: { id: true },
        take: 1,
      },
    },
  });

  return user;
};

const isUniqueConstraintError = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError
    ? error.code === "P2002"
    : typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: string }).code === "P2002";
