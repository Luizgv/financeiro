import mongoose from "mongoose";
import type { FastifyBaseLogger } from "fastify";

/**
 * Connects to MongoDB and logs connection state.
 */
export async function connectMongo(uri: string, log: FastifyBaseLogger): Promise<void> {
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri);
  log.info("MongoDB connected");
}
