import type { RequestHandler } from "express";
import type { ZodType } from "zod";
import { HttpError } from "./http-error";

export const validateBody = (schema: ZodType): RequestHandler => (req, _res, next) => {
  const result = schema.safeParse(req.body);
  if (result.success) {
    req.body = result.data;
    return next();
  }
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? "body");
    (fieldErrors[key] ||= []).push(issue.message);
  }
  next(new HttpError(422, "VALIDATION_ERROR", "Dữ liệu không hợp lệ", fieldErrors));
};

const validatePart = (schema: ZodType, part: "query" | "params"): RequestHandler => (req, _res, next) => {
  const result = schema.safeParse(req[part]);
  if (result.success) {
    (req as unknown as Record<string, unknown>)[part] = result.data;
    return next();
  }
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? part);
    (fieldErrors[key] ||= []).push(issue.message);
  }
  next(new HttpError(422, "VALIDATION_ERROR", "Dữ liệu không hợp lệ", fieldErrors));
};

export const validateQuery = (schema: ZodType) => validatePart(schema, "query");
export const validateParams = (schema: ZodType) => validatePart(schema, "params");