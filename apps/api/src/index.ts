import express, { type Express } from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import { runMigrations, runWithAuditContext } from "@challenge/database";
import { requestIdMiddleware } from "./common/request-id";
import { errorHandler, notFoundHandler } from "./common/error-handler";
import { openApiDocument } from "./openapi";
import { v1Router } from "./router";
import { emitDocumentChanged } from "./common/realtime";

export { attachRealtime, emitChatMessage, emitChatConversationEvent, emitChatTyping } from "./common/realtime";

export async function mountV1Api(app: Express) {
  await runMigrations();
  const origins = (process.env.CORS_ORIGIN || "http://localhost:5173").split(",").map(value => value.trim());
  app.use("/api/v1", requestIdMiddleware, cors({ origin: origins, credentials: true }));
  app.use("/api/v1", (req, _res, next) => {
    const forwarded = req.headers["x-forwarded-for"];
    const ipAddress = String(
      (Array.isArray(forwarded) ? forwarded[0] : forwarded) ||
        req.socket?.remoteAddress ||
        "",
    )
      .replace(/^::ffff:/, "")
      .trim();
    runWithAuditContext(
      {
        ipAddress: ipAddress || null,
        userAgent: String(req.headers["user-agent"] || "").slice(0, 500) || null,
      },
      next,
    );
  });
  app.use("/api/v1", express.json({ limit: "10mb" }));
  app.use("/api/v1", express.urlencoded({ extended: true, limit: "10mb" }));
  app.use("/api/v1/docs", swaggerUi.serve, swaggerUi.setup(openApiDocument));
  app.use("/api/v1", (req, res, next) => {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
    const path = req.originalUrl.split("?")[0];
    if (path.startsWith("/api/v1/chat") || path.startsWith("/api/v1/auth")) return next();
    res.on("finish", () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        emitDocumentChanged({ method: req.method, path });
      }
    });
    next();
  });
  app.use("/api/v1", v1Router, notFoundHandler, errorHandler);
}