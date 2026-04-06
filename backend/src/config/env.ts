import { config as loadEnv } from "dotenv";
import { z } from "zod";

loadEnv();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(4000),
  MONGODB_URI: z.string().min(1),
  LOG_LEVEL: z.string().default("info"),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  UPLOAD_DIR: z.string().default("./uploads"),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Loads and validates process environment for the API.
 */
export function loadEnvConfig(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const message = parsed.error.flatten().fieldErrors;
    throw new Error(`Invalid environment: ${JSON.stringify(message)}`);
  }
  return parsed.data;
}
