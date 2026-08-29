import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { loginSchema, refreshSchema } from "@challenge/contracts";
import { asyncHandler } from "../../common/async-handler";
import { validateBody } from "../../common/validate";
import { authController } from "./auth.controller";
import { authenticateV1 } from "../../common/authenticate";

export const authRouter = Router();
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { success: false, code: "LOGIN_RATE_LIMIT", message: "Thử đăng nhập quá nhiều lần, vui lòng thử lại sau" },
});

authRouter.post("/login", loginLimiter, validateBody(loginSchema), asyncHandler(authController.login));
authRouter.post("/refresh", validateBody(refreshSchema), asyncHandler(authController.refresh));
authRouter.post("/logout", validateBody(refreshSchema), asyncHandler(authController.logout));
authRouter.get("/me", authenticateV1, asyncHandler(authController.me));