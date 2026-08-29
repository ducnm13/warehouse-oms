import type { Express } from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import { runMigrations } from "@challenge/database";
import { requestIdMiddleware } from "./common/request-id";
import { errorHandler, notFoundHandler } from "./common/error-handler";
import { openApiDocument } from "./openapi";
import { v1Router } from "./router";

export async function mountV1Api(app: Express) {
  await runMigrations();
  const origins = (process.env.CORS_ORIGIN || "http://localhost:5173").split(",").map(value => value.trim());
  app.use("/api/v1", requestIdMiddleware, cors({ origin: origins, credentials: true }));
  app.use("/api/v1/docs", swaggerUi.serve, swaggerUi.setup(openApiDocument));
  app.use("/api/v1", v1Router, notFoundHandler, errorHandler);
}