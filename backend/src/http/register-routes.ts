import multipart from "@fastify/multipart";
import type { FastifyInstance } from "fastify";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { z } from "zod";
import type { Env } from "../config/env.js";
import { PREDEFINED_CATEGORIES } from "../modules/categories/predefined-categories.js";
import type { CategoryRepository } from "../modules/categories/category.repository.js";
import type { DashboardService } from "../modules/monthly/dashboard.service.js";
import type { MonthlyLifecycleService } from "../modules/monthly/monthly-lifecycle.service.js";
import type { MonthlySnapshotRepository } from "../modules/monthly/monthly-snapshot.repository.js";
import type { FixedIncomeRepository } from "../modules/incomes/fixed-income.repository.js";
import type { StoredFileRepository } from "../modules/files/stored-file.repository.js";
import type { HouseholdRepository } from "../modules/households/household.repository.js";
import type { TransactionRepository } from "../modules/transactions/transaction.repository.js";
import type { TransactionService } from "../modules/transactions/transaction.service.js";
import type { StatementExtractionService } from "../modules/extraction/statement-extraction.service.js";
import { currentMonthKey } from "../shared/month-key.js";
import { objectIdString } from "./zod-utils.js";
import { serializeDoc } from "./serialize.js";

const paymentMethodSchema = z.enum(["card", "pix", "cash", "debit", "transfer", "other"]);
const ownerSchema = z.enum(["me", "wife"]);
const fileKindSchema = z.enum(["credit_card_invoice", "bank_statement", "other"]);

export type ApiContainer = {
  env: Env;
  householdRepo: HouseholdRepository;
  categoryRepo: CategoryRepository;
  snapshotRepo: MonthlySnapshotRepository;
  fixedIncomeRepo: FixedIncomeRepository;
  transactionRepo: TransactionRepository;
  storedFileRepo: StoredFileRepository;
  lifecycle: MonthlyLifecycleService;
  transactions: TransactionService;
  dashboard: DashboardService;
  extraction: StatementExtractionService;
};

/**
 * Registers HTTP routes for households, months, transactions, and file metadata.
 */
export async function registerRoutes(app: FastifyInstance, c: ApiContainer): Promise<void> {
  await app.register(multipart, { limits: { fileSize: 15 * 1024 * 1024 } });

  app.get("/health", async () => ({ ok: true }));

  app.post("/api/bootstrap", async (_req, reply) => {
    await c.categoryRepo.ensurePredefinedSeed([...PREDEFINED_CATEGORIES]);
    const household = await c.householdRepo.getOrCreateDefault();
    const snapshot = await c.lifecycle.ensureCurrentMonth(household._id);
    return reply.send(
      serializeDoc({
        householdId: household._id,
        householdName: household.name,
        snapshotId: snapshot._id,
        monthKey: snapshot.monthKey,
        isClosed: snapshot.isClosed,
        calendarMonthKey: currentMonthKey(),
        snapshotStatus: snapshot.status ?? (snapshot.isClosed ? "archived" : "active"),
      })
    );
  });

  app.get("/api/households/:householdId/snapshots", async (request, reply) => {
    const { householdId } = z.object({ householdId: objectIdString }).parse(request.params);
    const hid = new mongoose.Types.ObjectId(householdId);
    const rows = await c.snapshotRepo.listByHousehold(hid);
    return reply.send(rows.map((s) => serializeDoc(s.toObject())));
  });

  app.get("/api/households/:householdId/snapshots/:snapshotId/dashboard", async (request, reply) => {
    const { householdId, snapshotId } = z
      .object({ householdId: objectIdString, snapshotId: objectIdString })
      .parse(request.params);
    const data = await c.dashboard.getDashboard(
      new mongoose.Types.ObjectId(householdId),
      new mongoose.Types.ObjectId(snapshotId)
    );
    return reply.send(serializeDoc(data as unknown as Record<string, unknown>));
  });

  app.get("/api/households/:householdId/snapshots/:snapshotId/month-summary", async (request, reply) => {
    const { householdId, snapshotId } = z
      .object({ householdId: objectIdString, snapshotId: objectIdString })
      .parse(request.params);
    const data = await c.dashboard.getMonthSummary(
      new mongoose.Types.ObjectId(householdId),
      new mongoose.Types.ObjectId(snapshotId)
    );
    return reply.send(serializeDoc(data as unknown as Record<string, unknown>));
  });

  app.get("/api/households/:householdId/snapshots/:snapshotId/transactions", async (request, reply) => {
    const { snapshotId } = z.object({ snapshotId: objectIdString }).parse(request.params);
    const rows = await c.transactionRepo.listBySnapshot(new mongoose.Types.ObjectId(snapshotId));
    return reply.send(rows.map((t) => serializeDoc(t.toObject())));
  });

  app.post("/api/households/:householdId/snapshots/:snapshotId/transactions/quick", async (request, reply) => {
    const { householdId, snapshotId } = z
      .object({ householdId: objectIdString, snapshotId: objectIdString })
      .parse(request.params);
    const body = z
      .object({
        text: z.string().min(1),
        categoryId: objectIdString.optional(),
      })
      .parse(request.body);

    const result = await c.transactions.createFromQuickText(
      new mongoose.Types.ObjectId(householdId),
      new mongoose.Types.ObjectId(snapshotId),
      body.text,
      body.categoryId ? new mongoose.Types.ObjectId(body.categoryId) : undefined
    );
    if (Array.isArray(result)) {
      return reply.status(201).send({
        installmentPlan: true,
        count: result.length,
        transactions: result.map((d) => serializeDoc(d.toObject())),
      });
    }
    return reply.status(201).send(serializeDoc(result.toObject()));
  });

  app.post("/api/households/:householdId/snapshots/:snapshotId/transactions", async (request, reply) => {
    const { householdId, snapshotId } = z
      .object({ householdId: objectIdString, snapshotId: objectIdString })
      .parse(request.params);
    const body = z
      .object({
        title: z.string().min(1),
        description: z.string().optional(),
        amount: z.number().positive(),
        type: z.enum(["income", "expense"]),
        categoryId: objectIdString,
        subcategory: z.string().optional(),
        date: z.union([z.string().datetime({ offset: true }), z.coerce.date()]),
        paymentMethod: paymentMethodSchema.default("other"),
        notes: z.string().optional(),
      })
      .parse(request.body);

    const doc = await c.transactions.create({
      householdId: new mongoose.Types.ObjectId(householdId),
      snapshotId: new mongoose.Types.ObjectId(snapshotId),
      title: body.title,
      description: body.description ?? body.title,
      amount: body.amount,
      type: body.type,
      categoryId: new mongoose.Types.ObjectId(body.categoryId),
      subcategory: body.subcategory,
      date: typeof body.date === "string" ? new Date(body.date) : body.date,
      paymentMethod: body.paymentMethod,
      notes: body.notes,
      source: "manual",
    });
    return reply.status(201).send(serializeDoc(doc.toObject()));
  });

  app.patch("/api/households/:householdId/snapshots/:snapshotId/transactions/:transactionId", async (request, reply) => {
    const { snapshotId, transactionId } = z
      .object({ snapshotId: objectIdString, transactionId: objectIdString })
      .parse(request.params);
    const body = z
      .object({
        title: z.string().min(1).optional(),
        amount: z.number().positive().optional(),
        categoryId: objectIdString.optional(),
        subcategory: z.string().optional(),
        date: z.union([z.string().datetime({ offset: true }), z.coerce.date()]).optional(),
        paymentMethod: paymentMethodSchema.optional(),
        notes: z.string().optional(),
      })
      .parse(request.body);

    const doc = await c.transactions.update(
      new mongoose.Types.ObjectId(snapshotId),
      new mongoose.Types.ObjectId(transactionId),
      {
        ...body,
        categoryId: body.categoryId ? new mongoose.Types.ObjectId(body.categoryId) : undefined,
        date: body.date ? (typeof body.date === "string" ? new Date(body.date) : body.date) : undefined,
      }
    );
    return reply.send(serializeDoc(doc!.toObject()));
  });

  app.delete("/api/households/:householdId/snapshots/:snapshotId/transactions/:transactionId", async (request, reply) => {
    const { snapshotId, transactionId } = z
      .object({ snapshotId: objectIdString, transactionId: objectIdString })
      .parse(request.params);
    await c.transactions.delete(new mongoose.Types.ObjectId(snapshotId), new mongoose.Types.ObjectId(transactionId));
    return reply.status(204).send();
  });

  app.get("/api/households/:householdId/categories", async (request, reply) => {
    const { householdId } = z.object({ householdId: objectIdString }).parse(request.params);
    const rows = await c.categoryRepo.listForHousehold(new mongoose.Types.ObjectId(householdId));
    return reply.send(rows.map((r) => serializeDoc(r.toObject())));
  });

  app.post("/api/households/:householdId/fixed-incomes", async (request, reply) => {
    const { householdId } = z.object({ householdId: objectIdString }).parse(request.params);
    const body = z
      .object({
        owner: ownerSchema,
        amount: z.number().positive(),
        description: z.string().min(1),
      })
      .parse(request.body);
    const doc = await c.fixedIncomeRepo.create({
      householdId: new mongoose.Types.ObjectId(householdId),
      owner: body.owner,
      amount: body.amount,
      description: body.description,
    });
    return reply.status(201).send(serializeDoc(doc.toObject()));
  });

  app.get("/api/households/:householdId/fixed-incomes", async (request, reply) => {
    const { householdId } = z.object({ householdId: objectIdString }).parse(request.params);
    const rows = await c.fixedIncomeRepo.listByHousehold(new mongoose.Types.ObjectId(householdId));
    return reply.send(rows.map((r) => serializeDoc(r.toObject())));
  });

  app.put("/api/households/:householdId/salaries", async (request, reply) => {
    const { householdId } = z.object({ householdId: objectIdString }).parse(request.params);
    const body = z
      .object({
        mySalary: z.number().min(0),
        wifeSalary: z.number().min(0),
        myLabel: z.string().max(120).optional(),
        wifeLabel: z.string().max(120).optional(),
      })
      .parse(request.body);
    const hid = new mongoose.Types.ObjectId(householdId);
    const myLabel = body.myLabel?.trim() || "Meu salário";
    const wifeLabel = body.wifeLabel?.trim() || "Salário — esposa";
    const mine = await c.fixedIncomeRepo.upsertSalary(hid, "me", body.mySalary, myLabel, myLabel);
    const hers = await c.fixedIncomeRepo.upsertSalary(hid, "wife", body.wifeSalary, wifeLabel, wifeLabel);
    await c.lifecycle.syncFixedIncomesToOpenSnapshots(hid);
    return reply.send(
      serializeDoc({
        me: mine.toObject(),
        wife: hers.toObject(),
      })
    );
  });

  app.post("/api/households/:householdId/files/:fileId/preview", async (request, reply) => {
    const { householdId, fileId } = z
      .object({ householdId: objectIdString, fileId: objectIdString })
      .parse(request.params);
    const result = await c.extraction.previewFile(
      new mongoose.Types.ObjectId(householdId),
      new mongoose.Types.ObjectId(fileId)
    );
    return reply.send(result);
  });

  app.post("/api/households/:householdId/files/:fileId/extract", async (request, reply) => {
    const { householdId, fileId } = z
      .object({ householdId: objectIdString, fileId: objectIdString })
      .parse(request.params);
    const result = await c.extraction.extractFile(
      new mongoose.Types.ObjectId(householdId),
      new mongoose.Types.ObjectId(fileId)
    );
    return reply.send(result);
  });

  app.delete("/api/households/:householdId/fixed-incomes/:fixedIncomeId", async (request, reply) => {
    const { householdId, fixedIncomeId } = z
      .object({ householdId: objectIdString, fixedIncomeId: objectIdString })
      .parse(request.params);
    const ok = await c.fixedIncomeRepo.delete(
      new mongoose.Types.ObjectId(fixedIncomeId),
      new mongoose.Types.ObjectId(householdId)
    );
    if (!ok) return reply.status(404).send({ error: "NOT_FOUND" });
    return reply.status(204).send();
  });

  app.post("/api/households/:householdId/snapshots/:snapshotId/files", async (request, reply) => {
    const { householdId, snapshotId } = z
      .object({ householdId: objectIdString, snapshotId: objectIdString })
      .parse(request.params);

    const snap = await c.snapshotRepo.findById(new mongoose.Types.ObjectId(snapshotId));
    if (!snap || String(snap.householdId) !== householdId) {
      return reply.status(404).send({ error: "NOT_FOUND" });
    }

    let kind: z.infer<typeof fileKindSchema> = "other";
    let buffer: Buffer | null = null;
    let filename = "upload";
    let mimetype = "application/octet-stream";

    for await (const part of request.parts()) {
      if (part.type === "file") {
        buffer = await part.toBuffer();
        filename = part.filename;
        mimetype = part.mimetype;
      } else if (part.fieldname === "kind" && typeof part.value === "string") {
        const parsed = fileKindSchema.safeParse(part.value);
        if (parsed.success) kind = parsed.data;
      }
    }

    if (!buffer) {
      return reply.status(400).send({ error: "FILE_REQUIRED" });
    }

    const safeBase = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, "_");
    const rel = path.join(householdId, snapshotId, `${randomUUID()}-${safeBase}`);
    const abs = path.join(c.env.UPLOAD_DIR, rel);
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, buffer);

    const doc = await c.storedFileRepo.create({
      householdId: new mongoose.Types.ObjectId(householdId),
      snapshotId: new mongoose.Types.ObjectId(snapshotId),
      monthKey: snap.monthKey,
      kind,
      originalName: filename,
      mimeType: mimetype,
      sizeBytes: buffer.length,
      storageRelativePath: rel,
    });

    return reply.status(201).send(serializeDoc(doc.toObject()));
  });

  app.get("/api/households/:householdId/snapshots/:snapshotId/files", async (request, reply) => {
    const { householdId, snapshotId } = z
      .object({ householdId: objectIdString, snapshotId: objectIdString })
      .parse(request.params);
    const snap = await c.snapshotRepo.findById(new mongoose.Types.ObjectId(snapshotId));
    if (!snap || String(snap.householdId) !== householdId) {
      return reply.status(404).send({ error: "NOT_FOUND" });
    }
    const rows = await c.storedFileRepo.listByHouseholdAndMonth(
      new mongoose.Types.ObjectId(householdId),
      snap.monthKey
    );
    return reply.send(rows.map((r) => serializeDoc(r.toObject())));
  });
}
