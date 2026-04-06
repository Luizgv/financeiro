# Financeiro

Personal finance app for a household, **month-centric**: each calendar month is a `MonthlySnapshot`. When the API ensures the current month, past open months are **closed** (read-only). **Transactions are never copied** across months; **fixed incomes** are materialized as income lines on the new snapshot.

## Structure

| Path | Stack |
|------|--------|
| `backend/` | Node.js, **Fastify**, **Mongoose**, **Zod** on routes |
| `web/` | **Next.js 15** (App Router), **Tailwind**, **TanStack Query**, **Zustand**, **next-themes** |

### Backend modules

- `modules/households` — default household (single-family use)
- `modules/categories` — global predefined + optional per-household custom (slug rules + keyword hints)
- `modules/monthly` — snapshots, rollover, dashboard aggregates
- `modules/incomes` — recurring **FixedIncome** templates (copied into each new month only)
- `modules/transactions` — ledger lines, **PT-BR quick text parser**, guards when month is closed
- `modules/files` — uploads + **extractionStatus** + `transactionsCreatedCount`
- `modules/extraction` — PDF/text → heurística PT-BR → transações (`invoice` | `bank_statement`)
- `modules/users` — optional **User** model for future auth

### Frontend

- **Shell** (`FinanceShell`): sidebar “Mês atual” + **Histórico** (meses fechados), URL `?snapshot=`
- **Painel** (`/`): salários (duas rendas), upload fatura/extrato + extração, totais, salários no mês, origem manual vs importado, gráficos, entrada rápida, lista com *badges* de origem
- **`/history`** redireciona para `/` (histórico na sidebar)

## Prerequisites

- Node 20+
- MongoDB (local or Atlas)

## Setup

### API

```bash
cd backend
cp .env.example .env
# edit MONGODB_URI
npm install
npm run seed   # optional; bootstrap also upserts categories
npm run dev
```

API listens on `http://localhost:4000` by default. Uploads go under `UPLOAD_DIR` (default `./uploads`). Dependência **`pdf-parse`** para texto de PDFs na extração.

### Web

```bash
cd web
cp .env.example .env.local
# NEXT_PUBLIC_API_URL=http://localhost:4000
npm install
npm run dev
```

Open `http://localhost:3000`.

## Example API usage

**Bootstrap** (creates household if needed, seeds categories, runs month lifecycle, returns current snapshot):

```http
POST /api/bootstrap
```

**Quick transaction** (natural language, BRL):

```http
POST /api/households/{householdId}/snapshots/{snapshotId}/transactions/quick
Content-Type: application/json

{ "text": "cartão 500 mercado" }
```

Optional override: `{ "text": "uber 32", "categoryId": "<mongoId>" }`.

**Dashboard** (totals + category breakdown + top expenses):

```http
GET /api/households/{householdId}/snapshots/{snapshotId}/dashboard
```

**List transactions**:

```http
GET /api/households/{householdId}/snapshots/{snapshotId}/transactions
```

**Register fixed income** (copied on the next **new** month only):

```http
POST /api/households/{householdId}/fixed-incomes
Content-Type: application/json

{ "owner": "me", "amount": 8500, "description": "Salário" }
```

**Salários (duas rendas, upsert por dono)** — usado pelo painel:

```http
PUT /api/households/{householdId}/salaries
Content-Type: application/json

{ "mySalary": 5000, "wifeSalary": 3500, "myLabel": "Meu salário", "wifeLabel": "Salário — esposa" }
```

**Upload** (multipart `file` + campo texto `kind`: `credit_card_invoice` | `bank_statement`):

```http
POST /api/households/{householdId}/snapshots/{snapshotId}/files
```

**Extração** (após upload, gera transações com `source` apropriado):

```http
POST /api/households/{householdId}/files/{fileId}/extract
```

## Domain rules (summary)

- One row per month per household: `MonthlySnapshot` (`monthKey` = `YYYY-MM`), com `status` (`active` | `archived` | `closed`), `transactionCount`, `closedAt`, `carriedFixedIncome`.
- `ensureCurrentMonth` fecha snapshots anteriores (`isClosed`, `status: archived`, `closedAt`), cria o mês corrente e materializa apenas **FixedIncome** ativos (`source: recurring_income`).
- Transações: `source` ∈ `manual` | `invoice` | `bank_statement` | `recurring_income`; campos opcionais `extractedConfidence`, `rawText`, `description`.
- Updates/deletes em transações retornam `409 MONTH_CLOSED` quando `isClosed` é true.

## Currency

All amounts are **BRL**; UI uses `pt-BR` formatting.
