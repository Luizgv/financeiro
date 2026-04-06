import type { Types } from "mongoose";
import { FixedIncome, type FixedIncomeDocument } from "./fixed-income.model.js";

/**
 * Persistence access for recurring fixed income templates.
 */
export class FixedIncomeRepository {
  async listByHousehold(householdId: Types.ObjectId): Promise<FixedIncomeDocument[]> {
    return FixedIncome.find({ householdId }).sort({ createdAt: 1 });
  }

  async findByOwner(householdId: Types.ObjectId, owner: "me" | "wife"): Promise<FixedIncomeDocument | null> {
    return FixedIncome.findOne({ householdId, owner }).sort({ createdAt: -1 });
  }

  /**
   * Templates eligible to be copied into a month (active + within date window).
   */
  async listActiveForMaterialization(
    householdId: Types.ObjectId,
    monthStart: Date,
    monthEnd: Date
  ): Promise<FixedIncomeDocument[]> {
    const all = await FixedIncome.find({ householdId, active: true });
    return all.filter((fi) => {
      const startOk = !fi.startDate || fi.startDate <= monthEnd;
      const endOk = !fi.endDate || fi.endDate >= monthStart;
      return startOk && endOk;
    });
  }

  async create(input: {
    householdId: Types.ObjectId;
    owner: "me" | "wife";
    amount: number;
    description: string;
    label?: string;
  }): Promise<FixedIncomeDocument> {
    return FixedIncome.create({
      householdId: input.householdId,
      owner: input.owner,
      amount: input.amount,
      description: input.description,
      label: input.label?.trim() ?? "",
      recurring: true,
      active: true,
      startDate: new Date(),
      endDate: null,
    });
  }

  /**
   * One salary template per owner — upserts and removes older duplicates.
   */
  async upsertSalary(
    householdId: Types.ObjectId,
    owner: "me" | "wife",
    amount: number,
    label: string,
    description: string
  ): Promise<FixedIncomeDocument> {
    const dupes = await FixedIncome.find({ householdId, owner }).sort({ createdAt: 1 });
    if (dupes.length > 1) {
      const [, ...rest] = dupes;
      await FixedIncome.deleteMany({ _id: { $in: rest.map((d) => d._id) } });
    }
    const doc = await FixedIncome.findOneAndUpdate(
      { householdId, owner },
      {
        $set: {
          amount,
          label,
          description,
          active: true,
          recurring: true,
        },
        $setOnInsert: {
          householdId,
          owner,
          startDate: new Date(),
          endDate: null,
        },
      },
      { upsert: true, new: true }
    );
    return doc!;
  }

  async delete(id: Types.ObjectId, householdId: Types.ObjectId): Promise<boolean> {
    const res = await FixedIncome.deleteOne({ _id: id, householdId });
    return res.deletedCount === 1;
  }
}
