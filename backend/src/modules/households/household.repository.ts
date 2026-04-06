import type { Types } from "mongoose";
import { Household, type HouseholdDocument } from "./household.model.js";

/**
 * Persistence access for households.
 */
export class HouseholdRepository {
  async findById(id: Types.ObjectId): Promise<HouseholdDocument | null> {
    return Household.findById(id);
  }

  async create(name: string): Promise<HouseholdDocument> {
    return Household.create({ name });
  }

  async getOrCreateDefault(): Promise<HouseholdDocument> {
    const existing = await Household.findOne().sort({ createdAt: 1 });
    if (existing) return existing;
    return this.create("Nossa casa");
  }
}
