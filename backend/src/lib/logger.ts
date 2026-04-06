import type { Env } from "../config/env.js";

/**
 * Pino options object for Fastify (Fastify 5+ expects a config object, not a pino instance).
 */
export function fastifyLoggerOptions(env: Env) {
  const isDev = env.NODE_ENV === "development";
  return {
    level: env.LOG_LEVEL,
    ...(isDev && {
      transport: {
        target: "pino-pretty",
        options: { colorize: true, translateTime: "SYS:standard" },
      },
    }),
  };
}
