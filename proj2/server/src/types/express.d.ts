import type { UserRole } from "@prisma/client";

declare global {
  namespace Express {
    interface UserContext {
      id: string;
      email: string;
      name: string;
      role: UserRole;
      vehicleType?: string | null;
      restaurantId?: string;
    }

    interface Request {
      user?: UserContext;
    }
  }
}

export {};
