import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";

import { env } from "./env";
import { HttpError } from "./errors/HttpError";
import { httpLogger, log } from "./logger";
import { authRouter } from "./routes/auth";
import { healthRouter } from "./routes/health";
import { ordersRouter } from "./routes/orders";
import { restaurantRouter } from "./routes/restaurants";

export const createApp = () => {
  const app = express();

  app.use(
    cors({
      origin: env.NODE_ENV === "production" ? [] : true,
      credentials: true,
    }),
  );
  app.use(helmet());
  app.use(httpLogger);
  app.use(express.json());
  app.use(cookieParser());

  app.use("/health", healthRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/restaurants", restaurantRouter);
  app.use("/api/orders", ordersRouter);

  app.use((req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  // Error handler - MUST have 4 parameters for Express to recognize it
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.message });
    }

    log.error("Unhandled error", { message: err.message, stack: err.stack });
    return res.status(500).json({ error: "Internal server error" });
  });

  return app;
};
