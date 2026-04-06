import cors from "@fastify/cors";
import Fastify from "fastify";
import type { Env } from "./config/env.js";
import { fastifyLoggerOptions } from "./lib/logger.js";
import { registerErrorHandler } from "./middleware/error-handler.js";
import { CategoryRepository } from "./modules/categories/category.repository.js";
import { DashboardService } from "./modules/monthly/dashboard.service.js";
import { MonthlyLifecycleService } from "./modules/monthly/monthly-lifecycle.service.js";
import { MonthlySnapshotRepository } from "./modules/monthly/monthly-snapshot.repository.js";
import { FixedIncomeRepository } from "./modules/incomes/fixed-income.repository.js";
import { StoredFileRepository } from "./modules/files/stored-file.repository.js";
import { HouseholdRepository } from "./modules/households/household.repository.js";
import { TransactionRepository } from "./modules/transactions/transaction.repository.js";
import { TransactionService } from "./modules/transactions/transaction.service.js";
import { StatementExtractionService } from "./modules/extraction/statement-extraction.service.js";
import { registerRoutes, type ApiContainer } from "./http/register-routes.js";

/**
 * Builds the Fastify app with DI-wired services and route modules.
 */
export async function buildApp(env: Env) {
  const app = Fastify({ logger: fastifyLoggerOptions(env) });

  await app.register(cors, { origin: env.CORS_ORIGIN });

  const householdRepo = new HouseholdRepository();
  const categoryRepo = new CategoryRepository();
  const snapshotRepo = new MonthlySnapshotRepository();
  const fixedIncomeRepo = new FixedIncomeRepository();
  const transactionRepo = new TransactionRepository();
  const storedFileRepo = new StoredFileRepository();

  const lifecycle = new MonthlyLifecycleService(snapshotRepo, fixedIncomeRepo, transactionRepo, categoryRepo);
  const transactions = new TransactionService(transactionRepo, snapshotRepo, categoryRepo, lifecycle);
  const dashboard = new DashboardService(snapshotRepo, transactionRepo, categoryRepo);
  const extraction = new StatementExtractionService(env, storedFileRepo, snapshotRepo, categoryRepo, transactions);

  const container: ApiContainer = {
    env,
    householdRepo,
    categoryRepo,
    snapshotRepo,
    fixedIncomeRepo,
    transactionRepo,
    storedFileRepo,
    lifecycle,
    transactions,
    dashboard,
    extraction,
  };

  await registerRoutes(app, container);

  app.setErrorHandler(registerErrorHandler());

  return app;
}
