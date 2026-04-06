import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import mongoose from "mongoose";
import { ZodError } from "zod";
import { AppError } from "../shared/app-error.js";
import { isMongoDuplicateKeyError } from "../shared/mongo-error.js";

const isProd = process.env.NODE_ENV === "production";

/**
 * Maps known errors to HTTP responses and logs unexpected failures.
 */
export function registerErrorHandler() {
  return async function errorHandler(
    error: FastifyError,
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        error: error.code,
        message: error.message,
        details: error.details,
      });
    }

    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: "VALIDATION_ERROR",
        message: "Invalid request body or params",
        details: error.flatten(),
      });
    }

    if (error.validation) {
      return reply.status(400).send({
        error: "VALIDATION_ERROR",
        message: error.message,
        details: error.validation,
      });
    }

    if (error instanceof mongoose.Error.ValidationError) {
      return reply.status(400).send({
        error: "VALIDATION_ERROR",
        message: error.message,
        details: error.errors,
      });
    }

    if (error instanceof mongoose.Error.CastError) {
      return reply.status(400).send({
        error: "CAST_ERROR",
        message: error.message,
      });
    }

    if (isMongoDuplicateKeyError(error)) {
      return reply.status(409).send({
        error: "DUPLICATE_KEY",
        message: isProd ? "Duplicate key" : String((error as Error).message),
      });
    }

    request.log.error({ err: error, path: request.url }, "Unhandled error");
    return reply.status(500).send({
      error: "INTERNAL_ERROR",
      message: isProd ? "Internal server error" : error.message || "Internal server error",
    });
  };
}
