import { Prisma, UserRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { HttpError } from "../errors/HttpError";
import {
  authenticateUser,
  createCustomer,
  createRestaurantOwner,
  serializeUser,
  updateUserProfile,
} from "../services/authService";
const hashPasswordMock = vi.hoisted(() => vi.fn(async (password: string) => `hashed:${password}`));
const verifyPasswordMock = vi.hoisted(() =>
  vi.fn(async (password: string, hash: string) => hash === `hashed:${password}`),
);

type PrismaMock = ReturnType<typeof createPrismaMock>;

function createPrismaMock(): PrismaMock {
  const mock: Record<string, any> = {};
  mock.user = { create: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() };
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

vi.mock("../utils/password", () => ({
  hashPassword: hashPasswordMock,
  verifyPassword: verifyPasswordMock,
}));

const createKnownRequestError = (code: string) =>
  ({
    code,
    message: "Prisma error",
  }) as unknown as Prisma.PrismaClientKnownRequestError;

describe("services/authService.serializeUser", () => {
  it("maps user fields and first restaurant id", () => {
    const serialized = serializeUser({
      id: "user-1",
      name: "Route Dash",
      email: "user@example.com",
      role: UserRole.RESTAURANT,
      restaurants: [{ id: "rest-1" }],
    });
    expect(serialized).toEqual({
      id: "user-1",
      name: "Route Dash",
      email: "user@example.com",
      role: UserRole.RESTAURANT,
      vehicleType: null,
      restaurantId: "rest-1",
    });
  });

  it("omits restaurantId when user has none", () => {
    const serialized = serializeUser({
      id: "user-1",
      name: "No Restaurant",
      email: "user@example.com",
      role: UserRole.CUSTOMER,
    });
    expect(serialized.restaurantId).toBeUndefined();
  });

  it("prefers the first restaurant when multiple exist", () => {
    const serialized = serializeUser({
      id: "user-1",
      name: "Multi Restaurant",
      email: "multi@example.com",
      role: UserRole.RESTAURANT,
      restaurants: [{ id: "rest-1" }, { id: "rest-2" }],
    });
    expect(serialized.restaurantId).toBe("rest-1");
  });
});

describe("services/authService.createCustomer", () => {
  beforeEach(() => {
    resetPrismaMock(prisma);
    hashPasswordMock.mockClear();
  });

  it("creates a customer with hashed password", async () => {
    prisma.user.create.mockResolvedValue({
      id: "user-1",
      name: "Customer",
      email: "customer@example.com",
      role: UserRole.CUSTOMER,
    } as any);

    const user = await createCustomer({
      name: "Customer",
      email: "customer@example.com",
      password: "password123",
    });

    expect(hashPasswordMock).toHaveBeenCalledWith("password123");
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: {
        name: "Customer",
        email: "customer@example.com",
        passwordHash: "hashed:password123",
        role: UserRole.CUSTOMER,
      },
    });
    expect(user.role).toBe(UserRole.CUSTOMER);
  });

  it("throws HttpError conflict when email already exists", async () => {
    prisma.user.create.mockRejectedValue(createKnownRequestError("P2002"));

    // console.log(createKnownRequestError("P2002") instanceof Prisma.PrismaClientKnownRequestError);

    try {
      await createCustomer({
        name: "Customer",
        email: "customer@example.com",
        password: "password123",
      });
      expect.fail("Expected createCustomer to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError);
      expect((error as HttpError).status).toBe(409);
    }
  });

  it("rethrows non-known prisma errors", async () => {
    const error = new Error("Unexpected");
    prisma.user.create.mockRejectedValue(error);

    await expect(
      createCustomer({
        name: "Customer",
        email: "customer@example.com",
        password: "password123",
      }),
    ).rejects.toBe(error);
  });

  it("does not swallow hash errors", async () => {
    const hashError = new Error("Hash failed");
    hashPasswordMock.mockRejectedValueOnce(hashError);

    await expect(
      createCustomer({
        name: "Customer",
        email: "customer@example.com",
        password: "password123",
      }),
    ).rejects.toBe(hashError);
  });
});

describe("services/authService.createRestaurantOwner", () => {
  beforeEach(() => {
    resetPrismaMock(prisma);
    hashPasswordMock.mockClear();
  });

  const ownerInput = {
    name: "Owner",
    email: "owner@example.com",
    password: "password123",
    restaurantName: "RouteDash Cafe",
    address: "123 Food Rd",
    latitude: 10,
    longitude: 20,
  };

  it("creates owner and restaurant within a transaction", async () => {
    const userRecord = { id: "user-1", role: UserRole.RESTAURANT } as any;
    const restaurantRecord = { id: "rest-1" } as any;

    prisma.$transaction.mockImplementation(async (callback) =>
      callback({
        user: {
          create: vi.fn().mockResolvedValue(userRecord),
        },
        restaurant: {
          create: vi.fn().mockResolvedValue(restaurantRecord),
        },
      } as any),
    );

    const result = await createRestaurantOwner(ownerInput);
    expect(hashPasswordMock).toHaveBeenCalledWith("password123");
    expect(result).toEqual({ user: userRecord, restaurant: restaurantRecord });
  });

  it("propagates unique constraint errors as HttpError", async () => {
    prisma.$transaction.mockRejectedValue(createKnownRequestError("P2002"));

    try {
      await createRestaurantOwner(ownerInput);
      expect.fail("Expected createRestaurantOwner to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError);
      expect((error as HttpError).status).toBe(409);
    }
  });

  it("rethrows unexpected errors", async () => {
    const err = new Error("boom");
    prisma.$transaction.mockRejectedValue(err);
    await expect(createRestaurantOwner(ownerInput)).rejects.toBe(err);
  });

  it("allows optional latitude/longitude values", async () => {
    const userRecord = { id: "user-1", role: UserRole.RESTAURANT } as any;
    const restaurantRecord = { id: "rest-1" } as any;
    const txUserCreate = vi.fn().mockResolvedValue(userRecord);
    const txRestaurantCreate = vi.fn().mockResolvedValue(restaurantRecord);

    prisma.$transaction.mockImplementation(async (callback) =>
      callback({
        user: { create: txUserCreate },
        restaurant: { create: txRestaurantCreate },
      } as any),
    );

    await createRestaurantOwner({ ...ownerInput, latitude: undefined, longitude: undefined });

    expect(txRestaurantCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        latitude: undefined,
        longitude: undefined,
      }),
    });
  });

  it("stores owner role as RESTAURANT during creation", async () => {
    const txUserCreate = vi.fn().mockResolvedValue({ id: "user-1" });
    const txRestaurantCreate = vi.fn().mockResolvedValue({ id: "rest-1" });

    prisma.$transaction.mockImplementation(async (callback) =>
      callback({
        user: { create: txUserCreate },
        restaurant: { create: txRestaurantCreate },
      } as any),
    );

    await createRestaurantOwner(ownerInput);

    expect(txUserCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        role: UserRole.RESTAURANT,
        email: "owner@example.com",
      }),
    });
  });
});

describe("services/authService.authenticateUser", () => {
  beforeEach(() => {
    resetPrismaMock(prisma);
    verifyPasswordMock.mockReset();
  });

  const userRecord = {
    id: "user-1",
    name: "Customer",
    email: "customer@example.com",
    role: UserRole.CUSTOMER,
    passwordHash: "hashed:password123",
    restaurants: [{ id: "rest-1" }],
  };

  it("returns the user when credentials are valid", async () => {
    prisma.user.findUnique.mockResolvedValue(userRecord);
    verifyPasswordMock.mockResolvedValue(true);

    const result = await authenticateUser("customer@example.com", "password123");
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: "customer@example.com" },
      include: { restaurants: { select: { id: true }, take: 1 } },
    });
    expect(result).toBe(userRecord);
  });

  it("throws when user is not found", async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(authenticateUser("missing@example.com", "password123")).rejects.toMatchObject({
      status: 401,
    });
  });

  it("throws when password does not match", async () => {
    prisma.user.findUnique.mockResolvedValue(userRecord);
    verifyPasswordMock.mockResolvedValue(false);

    await expect(authenticateUser("customer@example.com", "wrong")).rejects.toMatchObject({
      status: 401,
    });
  });

  it("calls verifyPassword with plaintext and stored hash", async () => {
    prisma.user.findUnique.mockResolvedValue(userRecord);
    verifyPasswordMock.mockResolvedValue(true);

    await authenticateUser("customer@example.com", "password123");
    expect(verifyPasswordMock).toHaveBeenCalledWith("password123", "hashed:password123");
  });

  it("supports users without restaurants", async () => {
    prisma.user.findUnique.mockResolvedValue({ ...userRecord, restaurants: [] });
    verifyPasswordMock.mockResolvedValue(true);

    const result = await authenticateUser("customer@example.com", "password123");
    expect(result.restaurants).toEqual([]);
  });

  it("requests only the first restaurant when including relations", async () => {
    prisma.user.findUnique.mockResolvedValue({
      ...userRecord,
      restaurants: [{ id: "rest-1" }, { id: "rest-2" }],
    });
    verifyPasswordMock.mockResolvedValue(true);

    await authenticateUser("customer@example.com", "password123");
    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        include: { restaurants: { select: { id: true }, take: 1 } },
      }),
    );
  });

  it("surfaces unexpected database errors", async () => {
    const err = new Error("db");
    prisma.user.findUnique.mockRejectedValue(err);

    await expect(authenticateUser("customer@example.com", "password123")).rejects.toBe(err);
  });

  it("supports multiple sequential authentications", async () => {
    prisma.user.findUnique.mockResolvedValue(userRecord);
    verifyPasswordMock.mockResolvedValue(true);
    const res1 = await authenticateUser("customer@example.com", "password123");
    expect(res1.id).toBe("user-1");

    prisma.user.findUnique.mockResolvedValue({
      ...userRecord,
      id: "user-2",
      email: "two@example.com",
    });
    const res2 = await authenticateUser("two@example.com", "password123");
    expect(res2.id).toBe("user-2");
  });
});

describe("services/authService.updateUserProfile", () => {
  beforeEach(() => {
    resetPrismaMock(prisma);
  });

  it("updates user vehicleType to GAS", async () => {
    const updatedUser = {
      id: "user-1",
      name: "Customer",
      email: "customer@example.com",
      role: UserRole.CUSTOMER,
      vehicleType: "GAS",
      restaurants: [],
    };
    prisma.user.update.mockResolvedValue(updatedUser as any);

    const result = await updateUserProfile("user-1", "GAS");

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { vehicleType: "GAS" },
      include: {
        restaurants: {
          select: { id: true },
          take: 1,
        },
      },
    });
    expect(result).toBe(updatedUser);
    expect(result.vehicleType).toBe("GAS");
  });

  it("updates user vehicleType to EV", async () => {
    const updatedUser = {
      id: "user-1",
      name: "Customer",
      email: "customer@example.com",
      role: UserRole.CUSTOMER,
      vehicleType: "EV",
      restaurants: [],
    };
    prisma.user.update.mockResolvedValue(updatedUser as any);

    const result = await updateUserProfile("user-1", "EV");

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { vehicleType: "EV" },
      include: {
        restaurants: {
          select: { id: true },
          take: 1,
        },
      },
    });
    expect(result.vehicleType).toBe("EV");
  });

  it("updates user vehicleType to null", async () => {
    const updatedUser = {
      id: "user-1",
      name: "Customer",
      email: "customer@example.com",
      role: UserRole.CUSTOMER,
      vehicleType: null,
      restaurants: [],
    };
    prisma.user.update.mockResolvedValue(updatedUser as any);

    const result = await updateUserProfile("user-1", null);

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { vehicleType: null },
      include: {
        restaurants: {
          select: { id: true },
          take: 1,
        },
      },
    });
    expect(result.vehicleType).toBeNull();
  });

  it("includes restaurants in response", async () => {
    const updatedUser = {
      id: "user-1",
      name: "Owner",
      email: "owner@example.com",
      role: UserRole.RESTAURANT,
      vehicleType: "GAS",
      restaurants: [{ id: "rest-1" }],
    };
    prisma.user.update.mockResolvedValue(updatedUser as any);

    const result = await updateUserProfile("user-1", "GAS");

    expect(result.restaurants).toEqual([{ id: "rest-1" }]);
  });

  it("handles database errors", async () => {
    const error = new Error("Database error");
    prisma.user.update.mockRejectedValue(error);

    await expect(updateUserProfile("user-1", "GAS")).rejects.toBe(error);
  });
});
