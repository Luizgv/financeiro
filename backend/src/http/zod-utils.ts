import mongoose from "mongoose";
import { z } from "zod";

/**
 * Zod schema for a 24-char Mongo ObjectId string.
 */
export const objectIdString = z.string().refine((id) => mongoose.Types.ObjectId.isValid(id), {
  message: "Invalid ObjectId",
});
