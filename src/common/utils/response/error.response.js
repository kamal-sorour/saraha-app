import { logger } from "../logger.js";
import { rm } from "node:fs/promises";

export const globalErrorHandling = (error, req, res, next) => {
  if (res.headersSent) return next(error);
  for (const file of [...(req.files ?? []), ...(req.file ? [req.file] : [])]) {
    if (file.path) rm(file.path, { force: true }).catch(() => { });
  }

  const mapped = error.cause?.status
    ? { status: error.cause.status, message: error.message, extra: error.cause.extra }
    : error.isJoi
      ? { status: 400, message: "Invalid request" }
      : error.name === "CastError" || error.name === "ValidationError"
        ? { status: 400, message: "Invalid request" }
        : error.code === 11000
          ? { status: 409, message: "Resource already exists" }
          : error.name === "JsonWebTokenError" || error.name === "TokenExpiredError"
            ? { status: 401, message: "Invalid or expired credentials" }
            : error.name === "MulterError"
              ? { status: 400, message: "Invalid upload" }
              : { status: 500, message: "Internal server error" };

  if (mapped.status >= 500) {
    logger.error("request_failed", {
      requestId: req.id,
      method: req.method,
      path: req.path,
      errorName: error.name,
    });
  }

  return res.status(mapped.status).json({
    error: mapped.message,
    ...(mapped.extra ? { extra: mapped.extra } : {}),
    requestId: req.id,
  });
};

// general customized error method
export const ErrorResponse = ({ message = "Error", status = 400, extra = undefined } = {}) => {
  throw new Error(message, { cause: { status, extra } });
}

// error-templates
const options = (value, defaultMessage) => typeof value === "string"
  ? { message: value }
  : { message: defaultMessage, ...value };

export const badRequestException = (value) => ErrorResponse({ ...options(value, "Bad request"), status: 400 });
export const notFoundException = (value) => ErrorResponse({ ...options(value, "Not found"), status: 404 });
export const unauthorizedException = (value) => ErrorResponse({ ...options(value, "Unauthorized"), status: 401 });
export const conflictException = (value) => ErrorResponse({ ...options(value, "Conflict"), status: 409 });
export const forbiddenException = (value) => ErrorResponse({ ...options(value, "Forbidden"), status: 403 });
export const serviceUnavailableException = (value) => ErrorResponse({ ...options(value, "Service unavailable"), status: 503 });

// Temporary compatibility aliases; migrate callers to the correctly spelled names.
export const badRequestExpeption = badRequestException;
export const NotFoundExpeption = notFoundException;
export const unauthorizedExpeption = unauthorizedException;
export const conflictExpeption = conflictException;
export const forbiddenExpeption = forbiddenException;
