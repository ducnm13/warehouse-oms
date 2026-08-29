import type { ErrorRequestHandler, RequestHandler } from "express";
import { HttpError } from "./http-error";

export const notFoundHandler: RequestHandler = (_req, _res, next) =>
  next(new HttpError(404, "NOT_FOUND", "Không tìm thấy API"));

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  const known = error instanceof HttpError;
  const status = known ? error.status : 500;
  if (!known) console.error(`[${res.locals.requestId}]`, error);
  res.status(status).json({
    success: false,
    message: known ? error.message : "Lỗi hệ thống",
    code: known ? error.code : "INTERNAL_ERROR",
    ...(known && error.fieldErrors ? { fieldErrors: error.fieldErrors } : {}),
    requestId: res.locals.requestId,
  });
};