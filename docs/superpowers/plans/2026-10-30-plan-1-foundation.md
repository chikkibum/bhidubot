# bhidubot Plan 1 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A running bhidubot monorepo where the first user signs up as instance admin, creates a team, invites a
teammate (the email is caught by Mailpit), and the teammate joins. All of this happens in a Linear-styled app shell,
with the api → SQS → worker plumbing proven end to end, traced, and documented in ADRs.

**Architecture:**
- **Workspace:** Bun workspaces + Turborepo. Internal packages are TypeScript-source-only (no build step).
- **Infrastructure** runs in Docker Compose: Postgres+pgvector, Floci (S3/SQS), Mailpit, and optional Jaeger/
  cloudflared profiles. The three apps (`web`, `api`, `worker`) run on the host with hot reload.
- **Same-origin:** the web dev server proxies `/api` to the Elysia API so auth cookies are same-origin. Caddy will do
  the same in production (Plan 5).

**Tech Stack:** Bun, Turborepo, Biome, TypeScript (strict), Elysia 1.4 + `@elysia/eden`, Better Auth 1.7
(+ `@better-auth/drizzle-adapter`, organization plugin), Drizzle ORM + drizzle-kit + `postgres` (postgres-js),
pgvector, AWS SDK v3 (S3, SQS) → Floci, nodemailer → Mailpit, pino, OpenTelemetry, React 19 + Vite + TanStack
Router/Query/Form/Table, Tailwind CSS v4, cmdk, sonner, Playwright, zod.

**Spec:** `docs/superpowers/specs/2026-10-30-bhidubot-design.md`. Read §4.1, §5, §6.1–6.6, §6.8, §9, §10 and §11
before starting.

---

## Roadmap (Phase 1 is split into five plans; each ends in working software)

| Plan | Delivers | Written |
|---|---|---|
| **1 — Foundation (this plan)** | Monorepo, infrastructure, config, db, auth + teams + invites, api/worker skeletons with traced queue, design system, app shell, ⌘K, E2E, ADRs | now |
| 2 — Meeting pipeline | `packages/ai` (Ollama/OpenAI/OpenRouter), `MeetingBotProvider` + MeetingBaaS + fake adapter, authenticated webhook, "send bot now", ingest/summarize/index/notify steps, LISTEN/NOTIFY → SSE, basic meetings list | after Plan 1 lands |
| 3 — Calendar & scheduling | `packages/crypto`, Google Calendar connect + sync, team assignment + de-dup, private/1:1 rules, dispatch scheduler with advisory-lock leader, `invalid_grant` → reconnect flow | after Plan 2 |
| 4 — Meeting experience | Meeting page (player ↔ transcript), speaker renaming, action items + regenerate suggestions, meeting chat + Ask AI (hybrid retrieval, multi-turn), search/filters, team AI settings + test connection, bot persona | after Plan 3 |
| 5 — Deployment | Dockerfiles, `docker-compose.prod.yml`, Caddy, backups, `docs/DEPLOYMENT.md` (incl. Google verification checklist) | after Plan 4 |

## Global Constraints

- Repo root: `D:\learn\bhidubot`. The spec already exists at `docs/superpowers/specs/2026-10-30-bhidubot-design.md`.
- The development host is Windows 11. Every script must work from PowerShell and Git Bash: no `rm -rf` or bash-only
  syntax in `package.json` scripts (use Bun scripts for any file operations).
- Package scope: `@bhidubot/*`. Internal packages export TypeScript source via `"exports": { ".": "./src/index.ts" }`.
- Version floors (latest at plan time):
  - `elysia@^1.4.30`, `@elysia/eden@^1.4.10`
  - `better-auth@^1.7.14`, `@better-auth/drizzle-adapter@^1.7.14`
  - `drizzle-orm@^0.45.4`, `drizzle-kit@^0.31.11`, `postgres@^4.0.0`
  - `@aws-sdk/client-s3@^3.1160.0`, `@aws-sdk/client-sqs@^3.1160.0`
  - `@tanstack/react-router@^1.170.46`, `@tanstack/router-plugin@^1.168.48`, `@tanstack/react-query@^5.105.0`
  - `react@^19.3.1`, `vite@^8.3.5`, `tailwindcss@^4.3.3`, `@tailwindcss/vite@^4.3.3`
  - `turbo@^2.11.10`
- TypeScript: `strict: true`, `noUncheckedIndexedAccess: true`. `bun run typecheck` must pass at the end of every task.
- Ports: web `5173`, api `3001`, Postgres `5432`, Floci `4566`, Mailpit SMTP `1025` / UI `8025`, Jaeger UI `16686` /
  OTLP HTTP `4318`.
- Databases: `bhidubot` (dev), `bhidubot_test` (unit/integration tests), `bhidubot_e2e` (Playwright).
- AWS defaults for Floci: `AWS_ENDPOINT_URL=http://localhost:4566`, `AWS_REGION=us-east-1`,
  `AWS_ACCESS_KEY_ID=test`, `AWS_SECRET_ACCESS_KEY=test`. S3 clients use `forcePathStyle: true`.
- Linear design tokens (dark), verbatim from DESIGN.md: canvas `#010102`; surface-1 `#0f1011`; surface-2 `#141516`;
  surface-3 `#18191a`; surface-4 `#191a1b`; hairline `#23252a`; hairline-strong `#34343a`; ink `#f7f8f8`;
  ink-muted `#d0d6e0`; ink-subtle `#8a8f98`; ink-tertiary `#62666d`; primary `#5e6ad2`; primary-hover `#828fff`;
  primary-focus `#5e69d1`; on-primary `#ffffff`; success `#27a644`. Radii: xs 4, sm 6, md 8, lg 12, xl 16, pill
  9999. Spacing: 4/8/12/16/24/32/48/96.
- Invite-only copy (exact): **"Sign-up is invite-only. Ask your team admin for an invite."**
- Every architecture decision a task makes gets an ADR in `docs/decisions/NNNN-kebab-title.md` **in that task's
  commit**, using the template from Task 1. ADR numbers are assigned in task order.
- Commit messages: Conventional Commits, ending with the line
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Never trust identity from request bodies. Team-scoped routes resolve membership on the server (spec §5).

## Review Focus

1. **Two people race to be the first sign-up.** Expected: exactly one becomes instance admin; the other is rejected.
   → Task 6, `concurrent first sign-ups yield exactly one admin`.
2. **The invited email arrives with different casing or whitespace** (`" Ana@Team.DEV "` invited, `ana@team.dev`
   signs up). Expected: the sign-up is allowed. → Task 6, `invite matches email case-insensitively`.
3. **A stale invitation is used** (expired, cancelled or already accepted). Expected: the sign-up is rejected with the
   invite-only message. → Task 6, `expired or cancelled invitation does not allow sign-up`.
4. **A removed member keeps a valid session and calls a team route.** Expected: `404 team_not_found`, not their old
   data. → Task 9, `removed member gets 404 on team route`.
5. **Postgres or Floci is down when the api or worker boots.** Expected: the process exits within ~5s with a message
   naming the dependency, not a silent hang. → Task 10, `assertDependencies names the unreachable dependency`.

---

### Task 0: Prerequisites (one-time, on the developer machine)

- [ ] **Step 1: Install Bun**

Run (PowerShell): `powershell -c "irm bun.sh/install.ps1 | iex"`, then open a new terminal.
Expected: `bun -v` prints a version ≥ 1.2.

- [ ] **Step 2: Confirm Docker is running**

Run: `docker compose version`
Expected: prints `Docker Compose version v2+` (v5.1.4 is installed).

- [ ] **Step 3: Create the repo**

Run in `D:\learn\bhidubot`: `git init -b main`
Expected: `Initialized empty Git repository`. The spec and this plan are already in `docs/`.

Ollama isn't needed until Plan 2.

---

### Task 1: Monorepo skeleton

**Files:**
- Create: `package.json`, `turbo.json`, `tsconfig.base.json`, `biome.json`, `.gitignore`, `.editorconfig`,
  `README.md`, `docs/decisions/0000-template.md`, `docs/decisions/0001-monorepo-bun-turborepo.md`
- Create: `packages/shared/package.json`, `packages/shared/tsconfig.json`, `packages/shared/src/index.ts`,
  `packages/shared/src/roles.ts`
- Test: `packages/shared/src/roles.test.ts`

**Interfaces:**
- Produces:
  - `TEAM_ROLES = ['owner', 'admin', 'member'] as const`
  - `type TeamRole = (typeof TEAM_ROLES)[number]`
  - `isTeamRole(value: unknown): value is TeamRole`
  - All of these from `@bhidubot/shared`
- Produces root scripts: `dev`, `build`, `test`, `typecheck`, `lint`, `format`, all running through `turbo run <task>`
  (except `lint`/`format`, which run `biome`)

- [ ] **Step 1: Write the failing test** `packages/shared/src/roles.test.ts`

```ts
import { describe, expect, test } from 'bun:test'
import { isTeamRole, TEAM_ROLES } from './roles'

describe('team roles', () => {
  test('lists roles in privilege order', () => {
    expect(TEAM_ROLES).toEqual(['owner', 'admin', 'member'])
  })
  test('narrows known roles and rejects unknown values', () => {
    expect(isTeamRole('admin')).toBe(true)
    expect(isTeamRole('superuser')).toBe(false)
    expect(isTeamRole(undefined)).toBe(false)
  })
})
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `bun test packages/shared`
Expected: FAIL (cannot resolve `./roles`).

- [ ] **Step 3: Create the workspace files and `roles.ts`**

- Root `package.json`:
  - `"private": true`
  - `"workspaces": ["apps/*", "packages/*"]`
  - devDependencies: `turbo`, `typescript`, `@biomejs/biome`, `@types/bun`
- `turbo.json`:
  - tasks `dev` (`persistent: true`, `cache: false`), `build` (`outputs: ["dist/**"]`), `test`, `typecheck`
  - `test` and `typecheck` have no build dependency, because the packages are source-only
- `tsconfig.base.json`:
  - `target ES2022`, `module ESNext`, `moduleResolution bundler`
  - `strict`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`, `skipLibCheck`
  - `types: ["bun"]`
- Each package `tsconfig.json` extends `../../tsconfig.base.json` and has `"typecheck": "tsc --noEmit"`.
- `.gitignore`: `node_modules`, `.env`, `.env.*` (except `.env.example`), `dist`, `.turbo`, `coverage`,
  `playwright-report`, `test-results`, `.superpowers`.
- `docs/decisions/0000-template.md`: sections **Status · Context · Decision · Why · Pros · Cons · Alternatives
  considered · Consequences / follow-ups**.

- [ ] **Step 4: Run the tests, typecheck and lint**

Run: `bun install`, then `bun test packages/shared`, `bun run typecheck`, `bun run lint`
Expected: 2 tests pass; typecheck and lint exit 0.

- [ ] **Step 5: Write ADR 0001 (Bun workspaces + Turborepo, source-only packages, Biome)**

Cover these points:
- **Why:** a single language and runtime; Bun runs TypeScript natively; Turborepo caches and orders tasks.
- **Pros:** no package build step; fast installs; one lint/format tool.
- **Cons:** source-only packages require every consumer to compile TypeScript (fine for Bun and Vite); Biome has fewer
  rules than ESLint; Turborepo is an extra tool to learn.
- **Alternatives:** pnpm + Nx (heavier); Bun workspaces alone, without Turborepo (no caching or task graph); ESLint +
  Prettier (slower, two tools).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: scaffold bun + turborepo monorepo with shared roles"
```

---

### Task 2: Typed environment config (`packages/config`)

**Files:**
- Create: `packages/config/package.json`, `packages/config/src/index.ts`, `packages/config/src/load-env.ts`,
  `packages/config/src/schemas.ts`, `.env.example`
- Test: `packages/config/src/load-env.test.ts`

**Interfaces:**
- Produces `loadEnv<T extends z.ZodObject>(schema: T, source?: Record<string, string | undefined>): z.infer<T>`.
  `source` defaults to `process.env`. It throws `EnvError`, which has `missing: string[]` and `invalid: string[]` and
  a message listing **all** offending variable names.
- Produces the schema fragments `dbEnv`, `awsEnv`, `authEnv`, `smtpEnv`, `otelEnv`, `appEnv`, and the composed
  schemas `apiEnvSchema` and `workerEnvSchema`, with these exact variables:
  - `appEnv`:
    - `NODE_ENV` (`development | test | production`, default `development`)
    - `LOG_LEVEL` (default `info`)
    - `APP_URL` (url)
    - `API_PORT` (number, default `3001`)
  - `dbEnv`: `DATABASE_URL` (url)
  - `awsEnv`:
    - `AWS_ENDPOINT_URL` (optional url)
    - `AWS_REGION` (default `us-east-1`)
    - `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
    - `S3_BUCKET` (default `bhidubot-media`)
    - `SQS_JOBS_QUEUE` (default `bhidubot-jobs`), `SQS_JOBS_DLQ` (default `bhidubot-jobs-dlq`)
  - `authEnv`:
    - `BETTER_AUTH_SECRET` (min 32 chars)
    - `BETTER_AUTH_URL` (url)
    - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (optional)
    - `ALLOWED_SIGNUP_DOMAINS`: optional CSV, parsed to `string[]`, trimmed and lower-cased, default `[]`
  - `smtpEnv`:
    - `SMTP_URL` (default `smtp://localhost:1025`)
    - `EMAIL_FROM` (default `bhidubot <no-reply@bhidubot.local>`)
  - `otelEnv`: `OTEL_EXPORTER_OTLP_ENDPOINT` (optional url)
- `apiEnvSchema` = app + db + aws + auth + smtp + otel. `workerEnvSchema` = app + db + aws + smtp + otel.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, test } from 'bun:test'
import { EnvError, loadEnv } from './load-env'
import { apiEnvSchema, authEnv } from './schemas'

const valid = {
  APP_URL: 'http://localhost:5173', DATABASE_URL: 'postgres://u:p@localhost:5432/bhidubot',
  AWS_ACCESS_KEY_ID: 'test', AWS_SECRET_ACCESS_KEY: 'test',
  BETTER_AUTH_SECRET: 'x'.repeat(32), BETTER_AUTH_URL: 'http://localhost:5173',
}

describe('loadEnv', () => {
  test('reports every missing variable at once', () => {
    const { DATABASE_URL, BETTER_AUTH_SECRET, ...rest } = valid
    try { loadEnv(apiEnvSchema, rest); throw new Error('should have thrown') }
    catch (e) {
      expect(e).toBeInstanceOf(EnvError)
      expect((e as EnvError).missing.sort()).toEqual(['BETTER_AUTH_SECRET', 'DATABASE_URL'])
      expect((e as EnvError).message).toContain('DATABASE_URL')
      expect((e as EnvError).message).toContain('BETTER_AUTH_SECRET')
    }
  })
  test('applies defaults', () => {
    const env = loadEnv(apiEnvSchema, valid)
    expect(env.LOG_LEVEL).toBe('info')
    expect(env.API_PORT).toBe(3001)
    expect(env.SQS_JOBS_QUEUE).toBe('bhidubot-jobs')
  })
  test('parses ALLOWED_SIGNUP_DOMAINS into trimmed lower-case list', () => {
    const env = loadEnv(authEnv, { ...valid, ALLOWED_SIGNUP_DOMAINS: ' Acme.com, x.IO ,' })
    expect(env.ALLOWED_SIGNUP_DOMAINS).toEqual(['acme.com', 'x.io'])
  })
  test('rejects a short auth secret as invalid, not missing', () => {
    try { loadEnv(authEnv, { ...valid, BETTER_AUTH_SECRET: 'short' }); throw new Error('no') }
    catch (e) { expect((e as EnvError).invalid).toEqual(['BETTER_AUTH_SECRET']) }
  })
})
```

- [ ] **Step 2: Run them and confirm they fail.** Run: `bun test packages/config`. Expected: FAIL (module not found).

- [ ] **Step 3: Implement `load-env.ts` and `schemas.ts` with zod**

`.env.example` lists every variable above, with the local Floci, Mailpit and Postgres values from the Global
Constraints.

- [ ] **Step 4: Run them and confirm they pass.** Run: `bun test packages/config`. Expected: 4 pass.

- [ ] **Step 5: ADR 0002 — validated env config with zod**

- **Why:** fail at boot rather than at the first webhook (meeting-bot69 D18).
- **Pros:** one documented list of variables, and typed access.
- **Cons:** the schema has to be updated whenever a variable is added.
- **Alternatives:** t3-env (extra dependency, oriented to the web side); reading `process.env` ad hoc (the
  meeting-bot69 approach).

- [ ] **Step 6: Commit**

```bash
git add packages/config .env.example docs/decisions/0002-*.md
git commit -m "feat(config): validated env schemas with all-at-once error reporting"
```

---

### Task 3: Local infrastructure (Docker Compose)

**Files:**
- Create: `docker-compose.yml`, `docker/postgres/init/01-databases.sql`, `docs/decisions/0003-local-infra-floci.md`

**Interfaces:**
- Produces these services:
  - `postgres`: `pgvector/pgvector:pg17`, port 5432, user/password `bhidubot`/`bhidubot`. The init SQL creates the
    `bhidubot_test` and `bhidubot_e2e` databases. Uses a named volume.
  - `floci`: `floci/floci:<pin the latest release tag from github.com/floci-io/floci/releases>`, port 4566.
    - Env: `FLOCI_STORAGE_MODE=hybrid`, `FLOCI_STORAGE_PERSISTENT_PATH=/data`, `FLOCI_DEFAULT_REGION=us-east-1`.
    - Uses a named volume at `/data`.
  - `mailpit`: `axllent/mailpit`, ports 1025 and 8025.
  - profile `tracing` → `jaeger`: `jaegertracing/jaeger:2` (pin a minor version), ports 16686 and 4318.
  - profile `tunnel` → `cloudflared`: `cloudflare/cloudflared`, command
    `tunnel --no-autoupdate --url http://host.docker.internal:3001`.
  - profile `ollama` → `ollama`: `ollama/ollama` with GPU device reservations. This is for Linux hosts only; on this
    Windows machine Ollama runs natively (spec §6.7).
- Every default service has a healthcheck, so `docker compose up -d --wait` blocks until it's healthy.

- [ ] **Step 1: Write `docker-compose.yml` and the init SQL** as specified above.

- [ ] **Step 2: Start and verify**

Run: `docker compose up -d --wait`
Expected: postgres, floci and mailpit all report `Healthy`.

Run: `docker compose exec postgres psql -U bhidubot -lqt`
Expected: the output includes `bhidubot`, `bhidubot_test` and `bhidubot_e2e`.

Run: `curl -s http://localhost:4566/_localstack/health` → a JSON body listing `s3` and `sqs`.
Run: `curl -s http://localhost:8025/api/v1/info` → JSON with a `Version`.

- [ ] **Step 3: Verify the optional profiles start**

Run: `docker compose --profile tracing up -d --wait`
Expected: the Jaeger UI responds at `http://localhost:16686`.

- [ ] **Step 4: Write ADR 0003 — Docker Compose for infrastructure, apps on the host; Floci for S3/SQS**

- **Why:** hot reload for the apps; production parity for AWS APIs; no AWS account needed locally.
- **Pros:** about 100 MB of RAM for all of AWS; the same SDK code runs against real AWS; Mailpit means no real email
  is sent.
- **Cons:** Floci is young, so parity gaps are possible (spec §14 lists what to check); apps running on the host
  differ slightly from production containers (Plan 5 closes that gap).
- **Alternatives:** LocalStack (the community edition now needs an auth token); MinIO + ElasticMQ (two tools, and not
  AWS-identical); a Postgres-backed queue (pg-boss: fewer moving parts, but no AWS parity, and the user chose Floci).

- [ ] **Step 5: Commit**

```bash
git add docker-compose.yml docker docs/decisions/0003-*.md
git commit -m "chore(infra): docker compose with pgvector, floci, mailpit and optional profiles"
```

---

### Task 4: Database package (`packages/db`)

**Files:**
- Create: `packages/db/package.json`, `packages/db/drizzle.config.ts`, `packages/db/src/index.ts`,
  `packages/db/src/client.ts`, `packages/db/src/migrate.ts`, `packages/db/src/schema/index.ts`,
  `packages/db/src/schema/job-runs.ts`, `packages/db/src/testing.ts`, `packages/db/test/setup.ts`,
  `packages/db/bunfig.toml` (`[test] preload = ["./test/setup.ts"]`). Every later package with DB tests uses the same
  pattern, with its own `bunfig.toml` preload that calls `runMigrations(DATABASE_URL_TEST)` once.
- Create migration: `packages/db/drizzle/0000_*.sql`. Generated, then hand-edited so its first line is
  `CREATE EXTENSION IF NOT EXISTS vector;`.
- Test: `packages/db/src/db.test.ts`

**Interfaces:**
- Produces:
  - `createDb(url: string): { db: Db; client: Sql; close(): Promise<void> }`, where `Db` is
    `PostgresJsDatabase<typeof schema>`
  - `runMigrations(url: string): Promise<void>` (drizzle `migrate`, migrations folder `packages/db/drizzle`)
  - `resetTestDb(db: Db): Promise<void>`: truncates every table in `public` except `__drizzle_migrations`, with
    `RESTART IDENTITY CASCADE`
  - `jobRuns` table:

    | column | type |
    |---|---|
    | `id` | text pk (= job ID) |
    | `type` | text, not null |
    | `status` | pg enum `job_status`: `running`, `succeeded`, `failed` |
    | `attempt` | int, not null |
    | `trace_id` | text, null |
    | `last_error` | text, null |
    | `created_at`, `updated_at` | timestamptz, default now() |
- Package scripts:
  - `db:generate` (`drizzle-kit generate`)
  - `db:migrate` (`bun src/migrate.ts`, uses `DATABASE_URL`)
  - `test` (runs against `DATABASE_URL_TEST`, default `postgres://bhidubot:bhidubot@localhost:5432/bhidubot_test`;
    `test/setup.ts` runs migrations once)

- [ ] **Step 1: Write the failing tests**

```ts
import { afterAll, beforeEach, expect, test } from 'bun:test'
import { sql } from 'drizzle-orm'
import { createDb, jobRuns, resetTestDb } from './index'

const { db, close } = createDb(process.env.DATABASE_URL_TEST!)
beforeEach(() => resetTestDb(db))
afterAll(() => close())

test('pgvector extension is installed by migrations', async () => {
  const rows = await db.execute(sql`select extname from pg_extension where extname = 'vector'`)
  expect(rows.length).toBe(1)
})

test('job_runs round-trips a row', async () => {
  await db.insert(jobRuns).values({ id: 'job-1', type: 'system.ping', status: 'running', attempt: 1 })
  const [row] = await db.select().from(jobRuns)
  expect(row?.status).toBe('running')
  expect(row?.traceId).toBeNull()
})
```

- [ ] **Step 2: Run them and confirm they fail.** Run: `bun --cwd packages/db test`. Expected: FAIL (module missing).

- [ ] **Step 3: Implement the client, schema, migration runner and test helpers.** Then run `bun --cwd packages/db
  db:generate`, and prepend the `CREATE EXTENSION` line to the generated SQL.

- [ ] **Step 4: Run them and confirm they pass.** Run: `bun --cwd packages/db test`. Expected: 2 pass.

- [ ] **Step 5: ADR 0004 — Drizzle + postgres-js; pgvector in the same database**

Base this on the pgvector discussion: user-scoped retrieval means small candidate sets; one transaction covers rows
and their vectors; cascade deletes; SQL filters and hybrid search; no extra vendor.
- **Cons:** vectors bloat the database; HNSW builds use the app database's CPU; Prisma-style abstractions are absent.
- **Alternatives:** Pinecone; Prisma; Kysely.

- [ ] **Step 6: Commit**

```bash
git add packages/db docs/decisions/0004-*.md
git commit -m "feat(db): drizzle client, migrations with pgvector, job_runs table"
```

---

### Task 5: Email package (`packages/email`)

**Files:**
- Create: `packages/email/package.json`, `packages/email/src/index.ts`, `packages/email/src/mailer.ts`,
  `packages/email/src/templates/invitation.ts`, `packages/email/src/templates/escape.ts`
- Test: `packages/email/src/mailer.test.ts`, `packages/email/src/templates/invitation.test.ts`

**Interfaces:**
- Produces:
  - `interface EmailMessage { to: string; subject: string; html: string; text: string }`
  - `interface Mailer { send(msg: EmailMessage): Promise<void> }`
  - `createSmtpMailer(opts: { smtpUrl: string; from: string }): Mailer` (nodemailer)
  - `createMemoryMailer(): Mailer & { sent: EmailMessage[] }`, for tests
  - `renderInvitationEmail(p: { inviterName: string; teamName: string; acceptUrl: string }): Omit<EmailMessage, 'to'>`
- The invitation subject is exactly: `` `${inviterName} invited you to ${teamName} on bhidubot` ``

- [ ] **Step 1: Write the failing tests**

```ts
// invitation.test.ts
import { expect, test } from 'bun:test'
import { renderInvitationEmail } from './invitation'

test('invitation contains accept link and team, and escapes HTML', () => {
  const m = renderInvitationEmail({ inviterName: 'Bhaskar', teamName: '<script>x</script>', acceptUrl: 'http://localhost:5173/accept-invite/abc' })
  expect(m.subject).toBe('Bhaskar invited you to <script>x</script> on bhidubot')
  expect(m.html).toContain('href="http://localhost:5173/accept-invite/abc"')
  expect(m.html).toContain('&lt;script&gt;x&lt;/script&gt;')
  expect(m.html).not.toContain('<script>x')
  expect(m.text).toContain('http://localhost:5173/accept-invite/abc')
})
```

```ts
// mailer.test.ts (integration, needs mailpit running)
import { expect, test } from 'bun:test'
import { createSmtpMailer } from './mailer'

test('smtp mailer delivers to mailpit', async () => {
  const to = `mailer-${Date.now()}@test.dev`
  await createSmtpMailer({ smtpUrl: 'smtp://localhost:1025', from: 'bhidubot <no-reply@bhidubot.local>' })
    .send({ to, subject: 'hello', html: '<p>hi</p>', text: 'hi' })
  const res = await fetch(`http://localhost:8025/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`)
  const body = (await res.json()) as { messages: Array<{ Subject: string }> }
  expect(body.messages[0]?.Subject).toBe('hello')
})
```

- [ ] **Step 2: Run them and confirm they fail.** Run: `bun test packages/email`. Expected: FAIL.

- [ ] **Step 3: Implement the mailer, the memory mailer, `escape.ts` and the invitation template.** The HTML is
  minimal, uses inline styles in Linear colours, and has a primary button linking to `acceptUrl`.

- [ ] **Step 4: Run them and confirm they pass.** Run: `bun test packages/email`. Expected: 2 pass.

- [ ] **Step 5: ADR 0005 — email via SMTP, Mailpit locally**

- **Why:** provider-neutral; nothing is sent from a dev machine.
- **Pros:** any SMTP server or Resend's SMTP endpoint works in production unchanged.
- **Cons:** no provider features (templates, analytics).
- **Alternatives:** the Resend SDK directly (vendor lock-in); Gmail SMTP (poor deliverability; it's what meeting-bot69
  did).

- [ ] **Step 6: Commit**

```bash
git add packages/email docs/decisions/0005-*.md
git commit -m "feat(email): smtp + memory mailers and invitation template"
```

---

### Task 6: Auth, teams and invite-only sign-up (`packages/auth`)

**Files:**
- Create: `packages/auth/package.json`, `packages/auth/src/index.ts`, `packages/auth/src/create-auth.ts`,
  `packages/auth/src/signup-policy.ts`, `packages/auth/src/authorize.ts`
- Create: `packages/db/src/schema/auth.ts`, generated with `bunx auth generate --adapter drizzle` against
  `create-auth.ts` (so the organization plugin tables are included), then re-exported from `schema/index.ts`
- Create migration: a generated migration plus custom SQL
  `CREATE UNIQUE INDEX one_instance_admin ON "user" (is_instance_admin) WHERE is_instance_admin;`
- Test: `packages/auth/src/auth.test.ts`

**Interfaces:**
- Consumes: `Db` and `createDb` (Task 4); `Mailer` and `renderInvitationEmail` (Task 5); the `authEnv` and `appEnv`
  types (Task 2).
- Produces:
  - `createAuth(deps: { db: Db; mailer: Mailer; env: { APP_URL: string; BETTER_AUTH_SECRET: string; BETTER_AUTH_URL: string; ALLOWED_SIGNUP_DOMAINS: string[]; GOOGLE_CLIENT_ID?: string; GOOGLE_CLIENT_SECRET?: string } })`.
    It returns a Better Auth instance; export `type Auth = ReturnType<typeof createAuth>`. Configuration:
    - `basePath: '/api/auth'`, `emailAndPassword.enabled`, `trustedOrigins: [APP_URL]`
    - Google social provider only when both Google variables are set
    - `organization({ sendInvitationEmail })`. The accept URL is `${APP_URL}/accept-invite/${invitation.id}`.
    - user `additionalFields.isInstanceAdmin` (boolean, default false, `input: false`)
    - `databaseHooks.user.create.before`, which calls `evaluateSignup`
  - `evaluateSignup(db: Db, email: string, allowedDomains: string[]): Promise<{ allowed: true; isInstanceAdmin: boolean } | { allowed: false }>`.
    It normalises the email (trim + lower-case). Rules, in order:
    1. If there are no users yet → allowed, and the user becomes instance admin.
    2. If the email's domain is in `allowedDomains` → allowed.
    3. If there's a `pending` invitation for the email (case-insensitive) with `expiresAt > now` → allowed.
    4. Otherwise → not allowed.

    When not allowed, the hook throws `new APIError('FORBIDDEN', { message: 'Sign-up is invite-only. Ask your team admin for an invite.', code: 'NOT_INVITED' })`.
  - `getMembership(db: Db, userId: string, teamId: string): Promise<{ role: TeamRole } | null>` in `authorize.ts`.
    It reads the organization plugin's `member` table.

- [ ] **Step 1: Write the failing tests** (memory mailer, `bhidubot_test` database, `resetTestDb` before each test)

```ts
import { beforeEach, describe, expect, test } from 'bun:test'
import { sql } from 'drizzle-orm'
import { createDb, resetTestDb } from '@bhidubot/db'
import { createMemoryMailer } from '@bhidubot/email'
import { createAuth } from './create-auth'
import { getMembership } from './authorize'

const { db } = createDb(process.env.DATABASE_URL_TEST!)
const mailer = createMemoryMailer()
const env = { APP_URL: 'http://localhost:5173', BETTER_AUTH_SECRET: 's'.repeat(32), BETTER_AUTH_URL: 'http://localhost:5173', ALLOWED_SIGNUP_DOMAINS: ['partner.dev'] }
const auth = createAuth({ db, mailer, env })
const signUp = (email: string) => auth.api.signUpEmail({ body: { email, password: 'correct-horse-9', name: email.split('@')[0]! }, asResponse: false })

async function adminWithTeam() {
  const res = await auth.api.signUpEmail({ body: { email: 'boss@acme.dev', password: 'correct-horse-9', name: 'Boss' }, returnHeaders: true })
  const headers = new Headers({ cookie: res.headers.get('set-cookie')! })
  const team = await auth.api.createOrganization({ body: { name: 'Acme', slug: 'acme' }, headers })
  return { headers, teamId: team!.id }
}

beforeEach(async () => { await resetTestDb(db); mailer.sent.length = 0 })

describe('invite-only sign-up', () => {
  test('first sign-up becomes instance admin', async () => {
    const { user } = await signUp('boss@acme.dev')
    expect(user.isInstanceAdmin).toBe(true)
  })
  test('uninvited sign-up is rejected with the invite-only message', async () => {
    await signUp('boss@acme.dev')
    await expect(signUp('stranger@else.dev')).rejects.toThrow('Sign-up is invite-only. Ask your team admin for an invite.')
  })
  test('invite matches email case-insensitively and sends the accept link', async () => {
    const { headers, teamId } = await adminWithTeam()
    const inv = await auth.api.createInvitation({ body: { email: ' Ana@Team.DEV ', role: 'member', organizationId: teamId }, headers })
    expect(mailer.sent[0]?.html).toContain(`http://localhost:5173/accept-invite/${inv.id}`)
    const { user } = await signUp('ana@team.dev')
    expect(user.isInstanceAdmin).toBe(false)
  })
  test('expired or cancelled invitation does not allow sign-up', async () => {
    const { headers, teamId } = await adminWithTeam()
    const inv = await auth.api.createInvitation({ body: { email: 'late@team.dev', role: 'member', organizationId: teamId }, headers })
    await auth.api.cancelInvitation({ body: { invitationId: inv.id }, headers })
    await expect(signUp('late@team.dev')).rejects.toThrow('invite-only')
  })
  test('allowed domain may sign up without an invite', async () => {
    await signUp('boss@acme.dev')
    const { user } = await signUp('someone@partner.dev')
    expect(user.email).toBe('someone@partner.dev')
  })
  test('concurrent first sign-ups yield exactly one admin', async () => {
    const results = await Promise.allSettled([signUp('a@x.dev'), signUp('b@x.dev')])
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1)
    const admins = await db.execute(sql`select count(*)::int as n from "user" where is_instance_admin`)
    expect((admins[0] as { n: number }).n).toBe(1)
  })
})

describe('getMembership', () => {
  test('returns role for members and null for non-members', async () => {
    const { teamId } = await adminWithTeam()
    const boss = await db.query.user.findFirst()
    expect(await getMembership(db, boss!.id, teamId)).toEqual({ role: 'owner' })
    expect(await getMembership(db, 'nobody', teamId)).toBeNull()
  })
})
```

Add one more test for the expired case: set the invitation's `expiresAt` to yesterday with a direct update, then
assert the sign-up rejects.

- [ ] **Step 2: Run them and confirm they fail.** Run: `bun --cwd packages/auth test`. Expected: FAIL.

- [ ] **Step 3: Implement `create-auth.ts`, `signup-policy.ts` and `authorize.ts`.** Then generate the auth schema,
  generate the migration, append the partial unique index SQL, and run `bun --cwd packages/db db:migrate` against the
  dev and test databases.

  If the Better Auth 1.7 API names used in the tests differ (`createInvitation`, `cancelInvitation`,
  `createOrganization`), use the 1.7 names and keep the assertions unchanged.

- [ ] **Step 4: Run them and confirm they pass.** Run: `bun --cwd packages/auth test`. Expected: 8 pass.

- [ ] **Step 5: ADR 0006 — Better Auth + organization plugin; invite-only, first user is admin**

- **Why:** a self-hosted team tool must not spend credits on strangers (spec §4.1).
- **Pros:** sessions, organizations and invitations come for free; data lives in our own Postgres.
- **Cons:** the generated schema is coupled to Better Auth upgrades; the first-user rule needs a database constraint
  to be race-safe.
- **Alternatives:** Clerk (hosted, data outside our DB, and what meeting-bot69 used); Lucia (deprecated);
  hand-rolled auth.

- [ ] **Step 6: Commit**

```bash
git add packages/auth packages/db docs/decisions/0006-*.md
git commit -m "feat(auth): better auth with teams, invite-only signup and first-user admin"
```

---

### Task 7: Observability package (`packages/observability`)

**Files:**
- Create: `packages/observability/package.json`, `src/index.ts`, `src/logger.ts`, `src/tracing.ts`,
  `src/propagation.ts`
- Test: `packages/observability/src/propagation.test.ts`

**Interfaces:**
- Produces:
  - `createLogger(service: string, level?: string): Logger` (pino JSON, `base: { service }`). Export
    `type Logger = pino.Logger`.
  - `initTracing(opts: { serviceName: string; otlpEndpoint?: string }): { shutdown(): Promise<void> }`. This is the
    OpenTelemetry Node tracer provider with a batch OTLP HTTP exporter when an endpoint is set, and a no-op exporter
    otherwise. It registers the W3C trace-context propagator.
  - `injectTraceContext(): Record<string, string>`: returns `{ traceparent, tracestate? }` from the active context.
  - `withExtractedContext<T>(carrier: Record<string, string>, fn: () => Promise<T>): Promise<T>`
  - `currentTraceId(): string | undefined`
  - `tracer(name: string): Tracer`

- [ ] **Step 1: Write the failing test**

```ts
import { expect, test } from 'bun:test'
import { currentTraceId, initTracing, injectTraceContext, tracer, withExtractedContext } from './index'

initTracing({ serviceName: 'test' })

test('injected traceparent is restored by withExtractedContext', async () => {
  let carrier: Record<string, string> = {}
  let traceId = ''
  await tracer('t').startActiveSpan('producer', async span => {
    carrier = injectTraceContext()
    traceId = span.spanContext().traceId
    span.end()
  })
  expect(carrier.traceparent).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-0[01]$/)
  const seen = await withExtractedContext(carrier, async () =>
    tracer('t').startActiveSpan('consumer', async span => { const id = currentTraceId(); span.end(); return id }))
  expect(seen).toBe(traceId)
})
```

- [ ] **Step 2: Run it and confirm it fails.** Run: `bun test packages/observability`. Expected: FAIL.

- [ ] **Step 3: Implement the logger and tracing.** Use `@opentelemetry/sdk-trace-node`,
  `@opentelemetry/exporter-trace-otlp-http`, `@opentelemetry/api`, `@opentelemetry/core`
  (`W3CTraceContextPropagator`), and an `AsyncLocalStorageContextManager`.

- [ ] **Step 4: Run it and confirm it passes.** Run: `bun test packages/observability`. Expected: 1 pass.

- [ ] **Step 5: ADR 0007 — structured logs + OpenTelemetry; trace context travels in SQS message attributes**

- **Why:** the pipeline is asynchronous, so debugging needs one trace from webhook to email (spec §6.6).
- **Pros:** vendor-neutral; Jaeger locally; any OTLP backend in production.
- **Cons:** instrumentation code to maintain; Bun's OpenTelemetry auto-instrumentation is limited, so spans are
  manual.
- **Alternatives:** logs only (can't follow a job across processes); Sentry (one vendor, can be added later).

- [ ] **Step 6: Commit**

```bash
git add packages/observability docs/decisions/0007-*.md
git commit -m "feat(observability): pino logger, otel tracing and context propagation helpers"
```

---

### Task 8: Storage, queue and infrastructure bootstrap (`packages/storage`, `packages/queue`, `scripts/`)

**Files:**
- Create: `packages/storage/package.json`, `packages/storage/src/index.ts` (`createS3Client`, `ensureBucket`)
- Create: `packages/queue/package.json`, `packages/queue/src/index.ts`, `src/jobs.ts`, `src/client.ts`,
  `src/enqueue.ts`, `src/consume.ts`, `src/ensure-queues.ts`
- Create: `scripts/bootstrap-infra.ts` (root script `infra:bootstrap`)
- Test: `packages/queue/src/queue.test.ts`

**Interfaces:**
- Consumes: `injectTraceContext` and `withExtractedContext` (Task 7); `awsEnv` (Task 2).
- Produces:
  - `createS3Client(env: AwsEnv): S3Client` (`forcePathStyle: true` when `AWS_ENDPOINT_URL` is set)
  - `ensureBucket(s3: S3Client, bucket: string): Promise<void>` (idempotent)
  - `createSqsClient(env: AwsEnv): SQSClient`
  - `ensureQueues(sqs: SQSClient, opts: { queue: string; dlq: string; maxReceiveCount?: number; visibilityTimeoutSeconds?: number }): Promise<{ queueUrl: string; dlqUrl: string }>`.
    Idempotent; defaults are `maxReceiveCount` 5 and visibility timeout 300 seconds. Sets a `RedrivePolicy` from the
    queue to the DLQ.
  - `interface JobMap { 'system.ping': { note: string } }`, extended by later plans
  - `type JobType = keyof JobMap`
  - `createQueue(sqs: SQSClient, queueUrl: string): { enqueue<K extends JobType>(type: K, payload: JobMap[K], opts?: { delaySeconds?: number }): Promise<{ jobId: string; traceId: string | undefined }> }`.
    The message body is `{ type, payload }`. `MessageAttributes` carry `traceparent` (and `tracestate`). `jobId` is
    the SQS `MessageId`.
  - `type JobContext = { jobId: string; attempt: number; traceId: string | undefined }`
  - `type JobHandler<K extends JobType> = (payload: JobMap[K], ctx: JobContext) => Promise<void>`
  - `startConsumer(opts: { sqs: SQSClient; queueUrl: string; handle: (type: string, payload: unknown, ctx: JobContext) => Promise<void>; logger: Logger; signal: AbortSignal; waitTimeSeconds?: number }): Promise<void>`.
    It long-polls with `MaxNumberOfMessages` 1 and `WaitTimeSeconds` (default 20). Each message runs inside
    `withExtractedContext`. On success the message is deleted. On error it is logged and **not** deleted, so it retries
    after the visibility timeout and moves to the DLQ after `maxReceiveCount`. `attempt` comes from
    `ApproximateReceiveCount`. The returned promise resolves when `signal` aborts.
- `bun run infra:bootstrap` loads the worker env and calls `ensureBucket` and `ensureQueues`. It's safe to run
  repeatedly.

- [ ] **Step 1: Write the failing tests** (integration, against Floci; queue names have a unique suffix per run)

```ts
import { expect, test } from 'bun:test'
import { createQueue, createSqsClient, ensureQueues, startConsumer } from './index'
import { createLogger, initTracing, tracer } from '@bhidubot/observability'

initTracing({ serviceName: 'queue-test' })
const env = { AWS_ENDPOINT_URL: 'http://localhost:4566', AWS_REGION: 'us-east-1', AWS_ACCESS_KEY_ID: 'test', AWS_SECRET_ACCESS_KEY: 'test' }
const sqs = createSqsClient(env as never)
const logger = createLogger('queue-test', 'silent')
const names = (s: string) => ({ queue: `t-${s}-${Date.now()}`, dlq: `t-${s}-dlq-${Date.now()}` })

test('enqueued job is consumed with the producer trace id', async () => {
  const { queueUrl } = await ensureQueues(sqs, names('ok'))
  const { traceId } = await tracer('t').startActiveSpan('api', async s => { const r = await createQueue(sqs, queueUrl).enqueue('system.ping', { note: 'hi' }); s.end(); return r })
  const ac = new AbortController()
  let seen: { type: string; payload: unknown; traceId?: string } | undefined
  await startConsumer({ sqs, queueUrl, logger, signal: ac.signal, waitTimeSeconds: 1,
    handle: async (type, payload, ctx) => { seen = { type, payload, traceId: ctx.traceId }; ac.abort() } })
  expect(seen).toEqual({ type: 'system.ping', payload: { note: 'hi' }, traceId })
})

test('a job that always fails lands in the DLQ after maxReceiveCount', async () => {
  const { queueUrl, dlqUrl } = await ensureQueues(sqs, { ...names('dlq'), maxReceiveCount: 2, visibilityTimeoutSeconds: 1 })
  await createQueue(sqs, queueUrl).enqueue('system.ping', { note: 'boom' })
  const ac = new AbortController()
  setTimeout(() => ac.abort(), 8000)
  await startConsumer({ sqs, queueUrl, logger, signal: ac.signal, waitTimeSeconds: 1, handle: async () => { throw new Error('boom') } })
  const { ReceiveMessageCommand } = await import('@aws-sdk/client-sqs')
  const dlq = await sqs.send(new ReceiveMessageCommand({ QueueUrl: dlqUrl, WaitTimeSeconds: 2 }))
  expect(dlq.Messages?.length).toBe(1)
}, 15000)

test('ensureQueues is idempotent', async () => {
  const n = names('idem')
  const a = await ensureQueues(sqs, n)
  const b = await ensureQueues(sqs, n)
  expect(b).toEqual(a)
})
```

- [ ] **Step 2: Run them and confirm they fail.** Run: `bun test packages/queue`. Expected: FAIL.

- [ ] **Step 3: Implement storage, queue and `scripts/bootstrap-infra.ts`**

- [ ] **Step 4: Run them and confirm they pass.** Run: `bun test packages/queue` (expected: 3 pass), then
  `bun run infra:bootstrap` twice (expected: exits 0 both times).

  If the DLQ test fails because of a Floci redrive gap, record it in `docs/decisions/0008` under Consequences, file it
  in spec §14's verification list, and mark the test `test.skipIf(process.env.FLOCI_NO_REDRIVE)`. Do not delete it.

- [ ] **Step 5: ADR 0008 — SQS job queue with DLQ; at-least-once delivery; idempotent handlers**

- **Why:** retries and a DLQ without new infrastructure, plus AWS parity through Floci (spec §6.3).
- **Pros:** durable; visibility-timeout retries; a DLQ for inspection.
- **Cons:** at-least-once delivery means every handler must be idempotent; the 15-minute maximum visibility means
  long jobs must extend it; no built-in scheduling (the worker has interval ticks, in Plan 3).
- **Alternatives:** pg-boss (Postgres-only, simpler, but no AWS parity); BullMQ (needs Redis); Inngest (hosted).

- [ ] **Step 6: Commit**

```bash
git add packages/storage packages/queue scripts docs/decisions/0008-*.md package.json
git commit -m "feat(queue): sqs enqueue/consume with trace propagation, dlq and infra bootstrap"
```

---

### Task 9: API app (`apps/api`)

**Files:**
- Create: `apps/api/package.json`, `apps/api/src/main.ts`, `apps/api/src/app.ts`, `apps/api/src/plugins/auth.ts`,
  `apps/api/src/plugins/team.ts`, `apps/api/src/routes/health.ts`, `apps/api/src/routes/me.ts`,
  `apps/api/src/routes/dev.ts`, `apps/api/src/deps.ts`
- Test: `apps/api/src/app.test.ts`

**Interfaces:**
- Consumes: `createAuth`/`Auth` and `getMembership` (Task 6); `createQueue` and `JobMap` (Task 8); `createLogger`
  and `initTracing` (Task 7); `apiEnvSchema` and `loadEnv` (Task 2); `createDb` (Task 4).
- Produces:
  - `type AppDeps = { db: Db; auth: Auth; queue: ReturnType<typeof createQueue>; sqs: SQSClient; queueUrl: string; logger: Logger; env: ApiEnv }`
  - `createApp(deps: AppDeps)`, which returns the Elysia app. Export `type App = ReturnType<typeof createApp>`. The
    web app imports `type App` from `@bhidubot/api`, so the package `exports` includes `"./app": "./src/app.ts"`.
  - The `authPlugin` macro `auth: true` resolves `{ user, session }`, or returns 401 `{ error: 'unauthorized' }`.
  - The `teamPlugin` macro `team: true` (which implies `auth`) resolves `{ team: { id: string; role: TeamRole } }`
    from `session.activeOrganizationId` plus `getMembership`:
    - no active team → 409 `{ error: 'no_active_team' }`
    - not a member → 404 `{ error: 'team_not_found' }`
- Routes:
  - Better Auth mounted at `/api/auth/*`
  - `GET /health` → `{ ok: true, db: 'up' | 'down', queue: 'up' | 'down' }`, with status 200 when both are up and
    503 otherwise
  - `GET /api/me` (auth) → `{ id, email, name, isInstanceAdmin, activeTeamId: string | null }`
  - `GET /api/teams/current` (team) → `{ id, name, role }`
  - `POST /api/dev/ping` (auth; registered only when `NODE_ENV !== 'production'`), body `{ note: string }`
    → 202 `{ jobId, traceId }`
- `main.ts`: `loadEnv` → `initTracing({ serviceName: 'api' })` → `assertDependencies` (Task 10 export; until then,
  inline a db `select 1`) → `createApp(...).listen(API_PORT)`. Wrap the app with `@elysiajs/opentelemetry`.

- [ ] **Step 1: Write the failing tests** (using `app.handle(new Request(...))` against `bhidubot_test` and a Floci
  test queue)

```ts
import { beforeEach, describe, expect, test } from 'bun:test'
// build deps with createDb(DATABASE_URL_TEST), createMemoryMailer(), createAuth, ensureQueues(...)+createQueue
import { makeTestApp } from './test-helpers' // create in this task: returns { app, db, auth, sqs, queueUrl, signUpAndCookie(email), resetAll() }

const t = await makeTestApp()
beforeEach(() => t.resetAll())
const get = (path: string, cookie?: string) => t.app.handle(new Request(`http://localhost${path}`, { headers: cookie ? { cookie } : {} }))

describe('api', () => {
  test('health reports db and queue up', async () => {
    const res = await get('/health')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, db: 'up', queue: 'up' })
  })
  test('/api/me requires a session', async () => {
    expect((await get('/api/me')).status).toBe(401)
  })
  test('/api/me returns the signed-in instance admin', async () => {
    const cookie = await t.signUpAndCookie('boss@acme.dev')
    const body = await (await get('/api/me', cookie)).json()
    expect(body).toMatchObject({ email: 'boss@acme.dev', isInstanceAdmin: true, activeTeamId: null })
  })
  test('team route needs an active team', async () => {
    const cookie = await t.signUpAndCookie('boss@acme.dev')
    const res = await get('/api/teams/current', cookie)
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'no_active_team' })
  })
  test('removed member gets 404 on team route', async () => {
    const { ownerCookie, memberCookie, teamId, memberId } = await t.teamWithMember()  // helper: owner creates team, invites+accepts member, both set active
    expect((await get('/api/teams/current', memberCookie)).status).toBe(200)
    await t.auth.api.removeMember({ body: { memberIdOrEmail: memberId, organizationId: teamId }, headers: new Headers({ cookie: ownerCookie }) })
    const res = await get('/api/teams/current', memberCookie)
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'team_not_found' })
  })
  test('dev ping enqueues a job carrying the trace id', async () => {
    const cookie = await t.signUpAndCookie('boss@acme.dev')
    const res = await t.app.handle(new Request('http://localhost/api/dev/ping', { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ note: 'hi' }) }))
    expect(res.status).toBe(202)
    const { jobId } = await res.json()
    expect(typeof jobId).toBe('string')
  })
})
```

- [ ] **Step 2: Run them and confirm they fail.** Run: `bun --cwd apps/api test`. Expected: FAIL.

- [ ] **Step 3: Implement the plugins, routes, `app.ts`, `main.ts` and `test-helpers.ts`.** The `api` package script
  `dev` is `bun --watch src/main.ts`.

- [ ] **Step 4: Run them and confirm they pass**

Run: `bun --cwd apps/api test` → 6 pass.
Run: `bun --cwd apps/api dev`, then `curl -s localhost:3001/health` → `{"ok":true,"db":"up","queue":"up"}`.

- [ ] **Step 5: Write the ADRs**

**ADR 0009 — Elysia + Eden Treaty; auth and team macros as the only identity source**

- **Why:** end-to-end types with no client code; meeting-bot69 D1 and D15.
- **Pros:** one place enforces authentication and team membership; 404 rather than 403 for non-members avoids
  confirming that IDs exist.
- **Cons:** Eden type inference slows the TypeScript server on very large APIs; it ties the web app to the api's
  types.
- **Alternatives:** Hono + RPC; tRPC; OpenAPI codegen.

**ADR 0010 — same-origin `/api`**

- Use the Vite proxy in development and Caddy in production, so cookies are first-party and there's no CORS.
- **Cons:** the API isn't on its own subdomain.

- [ ] **Step 6: Commit**

```bash
git add apps/api docs/decisions/0009-*.md docs/decisions/0010-*.md
git commit -m "feat(api): elysia app with auth/team macros, health, me and dev ping"
```

---

### Task 10: Worker app (`apps/worker`)

**Files:**
- Create: `apps/worker/package.json`, `apps/worker/src/main.ts`, `apps/worker/src/run-job.ts`,
  `apps/worker/src/handlers/index.ts`, `apps/worker/src/handlers/system-ping.ts`,
  `apps/worker/src/dependencies.ts`
- Test: `apps/worker/src/run-job.test.ts`, `apps/worker/src/dependencies.test.ts`, `apps/worker/src/e2e.test.ts`

**Interfaces:**
- Consumes: `startConsumer`, `JobMap` and `JobHandler` (Task 8); `jobRuns` and `Db` (Task 4); logger and tracing
  (Task 7).
- Produces:
  - `type Handlers = { [K in JobType]: JobHandler<K> }`, exported as `handlers` from `handlers/index.ts`
  - `runJob(deps: { db: Db; logger: Logger; handlers: Handlers }, type: string, payload: unknown, ctx: JobContext): Promise<void>`.
    It upserts `job_runs(id = ctx.jobId)` with status `running` and the attempt and trace ID; calls the handler; then
    sets `succeeded`, or `failed` with `last_error` (and **rethrows**). An unknown `type` throws
    `Error('unknown_job_type: <type>')`.
  - `assertDependencies(opts: { databaseUrl: string; sqs: SQSClient; queueUrl: string; timeoutMs?: number }): Promise<void>`.
    The default timeout is 5000. It throws `DependencyError` with `dependency: 'postgres' | 'sqs'` and a message
    `` `Cannot reach ${dependency}: <cause>` ``.
  - The `system.ping` handler logs `note` and returns.
  - `main.ts`: `loadEnv(workerEnvSchema)` → `initTracing({ serviceName: 'worker' })` → `assertDependencies` (exit 1 on
    failure) → `startConsumer` with an `AbortController` aborted on SIGINT/SIGTERM. The current job finishes, then the
    process exits 0.

- [ ] **Step 1: Write the failing tests**

```ts
// run-job.test.ts
test('records success with attempt and trace id', async () => {
  await runJob(deps, 'system.ping', { note: 'x' }, { jobId: 'j1', attempt: 1, traceId: 'abc' })
  const [row] = await db.select().from(jobRuns)
  expect(row).toMatchObject({ id: 'j1', status: 'succeeded', attempt: 1, traceId: 'abc', lastError: null })
})
test('records failure and rethrows so SQS retries', async () => {
  const failing = { ...deps, handlers: { 'system.ping': async () => { throw new Error('nope') } } }
  await expect(runJob(failing, 'system.ping', { note: 'x' }, { jobId: 'j2', attempt: 3, traceId: undefined })).rejects.toThrow('nope')
  const [row] = await db.select().from(jobRuns)
  expect(row).toMatchObject({ id: 'j2', status: 'failed', attempt: 3, lastError: 'nope' })
})
test('unknown job type fails loudly', async () => {
  await expect(runJob(deps, 'nope.job', {}, { jobId: 'j3', attempt: 1, traceId: undefined })).rejects.toThrow('unknown_job_type: nope.job')
})
```

```ts
// dependencies.test.ts
test('assertDependencies names the unreachable dependency', async () => {
  const started = Date.now()
  await expect(assertDependencies({ databaseUrl: 'postgres://x:y@localhost:5999/none', sqs, queueUrl, timeoutMs: 2000 }))
    .rejects.toThrow('Cannot reach postgres')
  expect(Date.now() - started).toBeLessThan(5000)
})
```

```ts
// e2e.test.ts — api ping → worker → job_runs, same trace
test('dev ping flows api → sqs → worker with one trace id', async () => {
  // POST /api/dev/ping via the api test app (Task 9 helpers), then run startConsumer+runJob until one job processed
  // expect job_runs row { id: jobId, status: 'succeeded', traceId: <traceId returned by the api> }
})
```

- [ ] **Step 2: Run them and confirm they fail.** Run: `bun --cwd apps/worker test`. Expected: FAIL.

- [ ] **Step 3: Implement `run-job.ts`, `dependencies.ts`, the handlers and `main.ts`.** Also switch `apps/api`'s
  `main.ts` to use `assertDependencies`.

- [ ] **Step 4: Run them and confirm they pass**

Run: `bun --cwd apps/worker test` → 5 pass.

Manual check: `docker compose --profile tracing up -d --wait`, run the api and the worker, sign up via curl, POST
`/api/dev/ping` with `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318`. Expected: Jaeger shows one trace spanning
`api` and `worker`.

- [ ] **Step 5: ADR 0011 — a dedicated long-running worker process; job bookkeeping in `job_runs`; fail-fast
  dependency checks**

- **Why:** no serverless timeouts; failures are visible (meeting-bot69 D7 and D8).
- **Pros:** simple to run, debug and scale horizontally.
- **Cons:** one more process to deploy; scheduler ticks need leader election (Plan 3: advisory lock).
- **Alternatives:** processing inside the API with `after()` (loses work on restart); Lambda consumers (cold starts,
  and a split codebase, as in meeting-bot69).

- [ ] **Step 6: Commit**

```bash
git add apps/worker apps/api/src/main.ts docs/decisions/0011-*.md
git commit -m "feat(worker): sqs consumer with job_runs bookkeeping, dependency checks and graceful shutdown"
```

---

### Task 11: Design system (`packages/ui`)

**Files:**
- Create: `docs/design/DESIGN.md` (from `npx getdesign@latest add linear.app`, moved into place)
- Create: `packages/ui/package.json`, `packages/ui/src/styles/tokens.css`, `packages/ui/src/styles/theme.css`
  (Tailwind v4 `@theme` mapping), `packages/ui/src/lib/cn.ts`, `packages/ui/src/components/{button,input,card,kbd,skeleton,avatar,dialog,dropdown-menu,command,toaster}.tsx`,
  `packages/ui/src/index.ts`, `packages/ui/test/setup.ts` (happy-dom + Testing Library), `packages/ui/bunfig.toml`
- Test: `packages/ui/src/styles/contrast.test.ts`, `packages/ui/src/components/button.test.tsx`

**Interfaces:**
- Produces:
  - CSS variables on `:root[data-theme="dark"]` and `:root[data-theme="light"]`: `--canvas`, `--surface-1`…
    `--surface-4`, `--hairline`, `--hairline-strong`, `--ink`, `--ink-muted`, `--ink-subtle`, `--ink-tertiary`,
    `--primary`, `--primary-hover`, `--primary-focus`, `--on-primary`, `--success`, `--danger`
    - Dark values are verbatim from Global Constraints.
    - Light values start from DESIGN.md's inverse tokens (`#ffffff`, `#f5f6f6`, `#f6f7f7`, ink `#000000`); the
      builder picks the rest so the contrast test passes.
  - Tailwind utilities through `@theme` (`bg-canvas`, `text-ink-muted`, `border-hairline`, `rounded-md`, and so on)
  - Components: `Button` (`variant: 'primary' | 'secondary' | 'ghost' | 'danger'`, `size: 'sm' | 'md'`, renders
    `data-variant`), `Input`, `Card`, `Kbd`, `Skeleton`, `Avatar`, `Dialog`, `DropdownMenu`, `Command*`
    (cmdk-based), `Toaster` (sonner)
  - Fonts: **Inter Variable** for text and display, and **JetBrains Mono** for mono, via `@fontsource-variable`.
    Linear's fonts are proprietary, so these are substitutes.

- [ ] **Step 1: Install the UI skills** (user-requested)

Run: `npx skills add Leonxlnx/taste-skill` and `npx skills add emilkowalski/skill`
Expected: both report installed. Then invoke `pick-ui-library` to confirm the primitives: Radix or Base UI for
Dialog and DropdownMenu, cmdk, and sonner. Record its answer in ADR 0012.

- [ ] **Step 2: Write the failing tests**

```ts
// contrast.test.ts — parses tokens.css, computes WCAG 2.2 contrast ratios
import { expect, test } from 'bun:test'
import { contrast, readTokens } from './contrast-utils' // create: readTokens('dark'|'light') → Record<string,string>

for (const theme of ['dark', 'light'] as const) {
  const t = readTokens(theme)
  test(`${theme}: body text pairs meet AA (4.5:1)`, () => {
    expect(contrast(t['--ink']!, t['--canvas']!)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(t['--ink-muted']!, t['--surface-1']!)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(t['--ink-subtle']!, t['--canvas']!)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(t['--on-primary']!, t['--primary']!)).toBeGreaterThanOrEqual(4.5)
  })
  test(`${theme}: tertiary ink and focus ring meet non-text 3:1`, () => {
    expect(contrast(t['--ink-tertiary']!, t['--canvas']!)).toBeGreaterThanOrEqual(3)
    expect(contrast(t['--primary-focus']!, t['--canvas']!)).toBeGreaterThanOrEqual(3)
  })
}
test('dark tokens are verbatim from DESIGN.md', () => {
  const t = readTokens('dark')
  expect(t['--canvas']).toBe('#010102'); expect(t['--primary']).toBe('#5e6ad2'); expect(t['--hairline']).toBe('#23252a')
})
```

```tsx
// button.test.tsx
test('renders variant, disables accessibly, shows focus ring class', () => {
  const { getByRole } = render(<Button variant="primary" disabled>Send bot</Button>)
  const b = getByRole('button', { name: 'Send bot' })
  expect(b.dataset.variant).toBe('primary')
  expect(b).toBeDisabled()
  expect(b.className).toContain('focus-visible:ring')
})
```

- [ ] **Step 3: Run them and confirm they fail.** Run: `bun --cwd packages/ui test`. Expected: FAIL.

- [ ] **Step 4: Implement the tokens, the theme and the components**

Follow DESIGN.md (component specs: `button-primary` uses `padding 8px 14px` and radius md, and so on) and the taste
and `emil-design-eng` guidance. Motion: 150–200 ms ease-out on enter, none on hover colour changes, and everything
disabled under `prefers-reduced-motion`.

- [ ] **Step 5: Run them and confirm they pass.** Run: `bun --cwd packages/ui test`. Expected: all pass. If a dark
  pair fails, **stop and report it**. Don't alter the verbatim dark tokens; instead use a stronger ink token for that
  pairing and note it in the ADR.

- [ ] **Step 6: ADR 0012 — design system: Linear DESIGN.md as the source of truth; CSS variables + Tailwind v4
  `@theme`; substitute fonts; chosen primitives**

- **Why:** the user's choice, plus a consistent and dense UI.
- **Pros:** themeable and testable for contrast; the components belong to us.
- **Cons:** light mode is partly derived rather than specified; the fonts aren't Linear's.
- **Alternatives:** shadcn defaults (generic look, which is an anti-goal); a full component kit like MUI or Mantine
  (fights the DESIGN.md).

- [ ] **Step 7: Commit**

```bash
git add docs/design packages/ui docs/decisions/0012-*.md
git commit -m "feat(ui): linear design tokens, contrast-tested themes and base components"
```

---

### Task 12: Web app shell (`apps/web`)

**Files:**
- Create: `apps/web/package.json`, `apps/web/index.html` (with an inline no-flash theme script), `vite.config.ts`
  (TanStack Router plugin, `@tailwindcss/vite`, proxy `/api` → `http://localhost:3001`), `src/main.tsx`,
  `src/lib/api.ts` (Eden), `src/lib/auth-client.ts`, `src/lib/theme.ts`, `src/lib/query.ts`
- Routes (file-based): `src/routes/__root.tsx`, `sign-in.tsx`, `sign-up.tsx`, `accept-invite.$invitationId.tsx`,
  `_app.tsx` (guarded layout + sidebar), `_app/index.tsx` (Home), `_app/settings/team.tsx`,
  `_app/settings/profile.tsx`
- Components: `src/components/app-sidebar.tsx`, `team-switcher.tsx`, `create-team-dialog.tsx`, `invite-form.tsx`,
  `members-table.tsx`, `command-palette.tsx`, `theme-toggle.tsx`
- Test: `apps/web/src/components/invite-form.test.tsx`, `apps/web/src/lib/theme.test.ts`

**Interfaces:**
- Consumes: `type App` from `@bhidubot/api/app` (Task 9); `@bhidubot/ui` (Task 11); the Better Auth React client
  with `organizationClient()`.
- Produces:
  - `api = treaty<App>(window.location.origin)` in `src/lib/api.ts`
  - `authClient = createAuthClient({ baseURL: window.location.origin, basePath: '/api/auth', plugins: [organizationClient()] })`
  - `theme.ts`: `type ThemePref = 'system' | 'light' | 'dark'`, `getThemePref(): ThemePref`,
    `setThemePref(p: ThemePref): void` (stored in localStorage key `bhidubot-theme`; sets
    `document.documentElement.dataset.theme`), and `resolveTheme(p, prefersDark: boolean): 'light' | 'dark'`
  - Route behaviour:
    - `_app` `beforeLoad` → no session redirects to `/sign-in?redirect=<path>`
    - signed in with no teams → Home shows a "Create your team" empty state
    - sign-up shows the exact invite-only copy when the server returns `NOT_INVITED`
    - `/accept-invite/$invitationId`: when signed out, it shows the invited email and links to sign up or sign in
      with `redirect` back; when signed in, it accepts, sets the team active, and navigates to `/`
  - ⌘K / Ctrl+K opens the palette with these commands: Go to Home, Go to Team settings, Go to Profile, Switch theme
    (System/Light/Dark), and Switch team (one entry per team). `?` opens a shortcuts dialog.

- [ ] **Step 1: Write the failing tests**

```ts
// theme.test.ts
test('resolveTheme honours explicit choice and system preference', () => {
  expect(resolveTheme('light', true)).toBe('light')
  expect(resolveTheme('dark', false)).toBe('dark')
  expect(resolveTheme('system', true)).toBe('dark')
  expect(resolveTheme('system', false)).toBe('light')
})
test('setThemePref persists and applies data-theme', () => {
  setThemePref('light')
  expect(localStorage.getItem('bhidubot-theme')).toBe('light')
  expect(document.documentElement.dataset.theme).toBe('light')
})
```

```tsx
// invite-form.test.tsx
test('rejects an invalid email before calling the server', async () => {
  const onInvite = mock(async () => {})
  const { getByLabelText, getByRole, findByText } = render(<InviteForm onInvite={onInvite} />)
  await userEvent.type(getByLabelText('Email'), 'not-an-email')
  await userEvent.click(getByRole('button', { name: 'Send invite' }))
  expect(await findByText('Enter a valid email address')).toBeTruthy()
  expect(onInvite).not.toHaveBeenCalled()
})
test('submits trimmed email and role', async () => {
  const onInvite = mock(async () => {})
  const { getByLabelText, getByRole } = render(<InviteForm onInvite={onInvite} />)
  await userEvent.type(getByLabelText('Email'), '  ana@team.dev ')
  await userEvent.click(getByRole('button', { name: 'Send invite' }))
  expect(onInvite).toHaveBeenCalledWith({ email: 'ana@team.dev', role: 'member' })
})
```

- [ ] **Step 2: Run them and confirm they fail.** Run: `bun --cwd apps/web test`. Expected: FAIL.

- [ ] **Step 3: Implement the app shell, routes and components**

- Data uses TanStack Query (members and invitations through `authClient.organization.*`, `me` through Eden).
- Forms use TanStack Form + zod; the members table uses TanStack Table.
- Every list has a skeleton loading state and a purposeful empty state.
- Toggles and invite revocations update optimistically.
- Run the `taste-skill` and `emil-design-eng` reviews on each screen, and `break-ui` with these data: a 60-character
  team name, 50 members, and zero invitations.

- [ ] **Step 4: Run the tests and confirm they pass; then verify manually**

Run: `bun --cwd apps/web test` → 4 pass.
Run: `bun dev` (turbo: api + worker + web). Open `http://localhost:5173`, sign up, create a team, invite
`ana@test.dev`. Expected: the email appears in Mailpit at `http://localhost:8025`. Toggling the theme doesn't flash
on reload.

- [ ] **Step 5: ADR 0013 — TanStack Router single-page app (not Start); TanStack Query for server state; Better Auth
  client for auth and teams; Eden for app routes**

- **Why:** a signed-in tool; static hosting; Elysia is the server (spec §6.1).
- **Pros:** simple deploys, typed routes, cache invalidation.
- **Cons:** no SSR for future public share pages (Plan/Phase 2 handles those with an API endpoint plus an SPA route);
  the first paint shows skeletons.
- **Alternatives:** TanStack Start; Next.js; React Router v7 framework mode.

- [ ] **Step 6: Commit**

```bash
git add apps/web docs/decisions/0013-*.md
git commit -m "feat(web): tanstack spa shell with auth, teams, invites, command palette and theming"
```

---

### Task 13: End-to-end tests, developer workflow and architecture docs

**Files:**
- Create: `e2e/package.json`, `e2e/playwright.config.ts`, `e2e/global-setup.ts` (resets `bhidubot_e2e`: drop all
  tables, run migrations, purge the e2e SQS queues and the Mailpit inbox), `e2e/tests/onboarding.spec.ts`,
  `e2e/tests/shell.spec.ts`
- Create/modify: `README.md` (prerequisites, quickstart, scripts, ports, troubleshooting), `docs/ARCHITECTURE.md`,
  `docs/decisions/README.md` (ADR index)
- Modify: root `package.json` scripts: `dev`, `e2e` (`playwright test` with `DATABASE_URL` pointing at
  `bhidubot_e2e`, `SQS_JOBS_QUEUE=bhidubot-jobs-e2e`), `setup` (`docker compose up -d --wait && bun run
  infra:bootstrap && bun --cwd packages/db db:migrate`)

**Interfaces:**
- Consumes everything above. Playwright `webServer` starts api, worker and web against the e2e env.

- [ ] **Step 1: Write the failing E2E tests**

```ts
// onboarding.spec.ts
test('first user becomes admin, creates a team, invites and the invitee joins', async ({ browser, page, request }) => {
  await page.goto('/sign-up')
  await page.getByLabel('Name').fill('Boss'); await page.getByLabel('Email').fill('boss@acme.dev'); await page.getByLabel('Password').fill('correct-horse-9')
  await page.getByRole('button', { name: 'Create account' }).click()
  await page.getByRole('button', { name: 'Create your team' }).click()
  await page.getByLabel('Team name').fill('Acme'); await page.getByRole('button', { name: 'Create team' }).click()
  await page.goto('/settings/team')
  await page.getByLabel('Email').fill('ana@test.dev'); await page.getByRole('button', { name: 'Send invite' }).click()
  await expect(page.getByText('ana@test.dev')).toBeVisible()

  const mail = await (await request.get('http://localhost:8025/api/v1/search?query=to:"ana@test.dev"')).json()
  const msg = await (await request.get(`http://localhost:8025/api/v1/message/${mail.messages[0].ID}`)).json()
  const link = /http:\/\/localhost:5173\/accept-invite\/[\w-]+/.exec(msg.Text)![0]

  const ana = await (await browser.newContext()).newPage()
  await ana.goto(link)
  await ana.getByRole('link', { name: 'Create an account' }).click()
  await ana.getByLabel('Name').fill('Ana'); await ana.getByLabel('Password').fill('correct-horse-9')
  await ana.getByRole('button', { name: 'Create account' }).click()
  await expect(ana.getByRole('button', { name: /Acme/ })).toBeVisible() // team switcher shows Acme
  await page.reload()
  await expect(page.getByRole('row', { name: /ana@test.dev/ })).toContainText('member')
})

test('uninvited sign-up sees the invite-only message', async ({ page }) => {
  await page.goto('/sign-up')
  await page.getByLabel('Name').fill('Stranger'); await page.getByLabel('Email').fill('stranger@else.dev'); await page.getByLabel('Password').fill('correct-horse-9')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByText('Sign-up is invite-only. Ask your team admin for an invite.')).toBeVisible()
})
```

```ts
// shell.spec.ts (signs in as boss via a storageState fixture created in global-setup)
test('theme choice survives reload without flashing', async ({ page }) => {
  await page.goto('/settings/profile'); await page.getByRole('radio', { name: 'Light' }).click()
  await page.reload({ waitUntil: 'commit' })
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('light')
})
test('Ctrl+K palette navigates to team settings by keyboard', async ({ page }) => {
  await page.goto('/'); await page.keyboard.press('Control+K')
  await page.keyboard.type('team settings'); await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/settings\/team$/)
})
test('signed-out visit to app redirects to sign-in with return path', async ({ browser }) => {
  const p = await (await browser.newContext()).newPage()
  await p.goto('/settings/team')
  await expect(p).toHaveURL(/\/sign-in\?redirect=%2Fsettings%2Fteam/)
})
```

- [ ] **Step 2: Run them and confirm they fail.** Run: `bun run e2e`. Expected: failures (config or selectors
  missing).

- [ ] **Step 3: Implement the Playwright config, global setup and any missing accessible labels or roles in the app**

- [ ] **Step 4: Run the whole suite**

Run: `bun run e2e` → 5 pass.
Then run `bun run typecheck && bun run lint && bun run test` → all exit 0.

- [ ] **Step 5: Write the docs**

- `docs/ARCHITECTURE.md`: the topology diagram (spec §6.3), what exists after Plan 1, the request flow (browser →
  Vite proxy → Elysia macros → Better Auth/Drizzle), the job flow (api → SQS → worker → `job_runs`, with one trace),
  and a "how to add a job type" walkthrough.
- `docs/decisions/README.md`: an index of ADRs 0001–0013.
- `README.md` quickstart:
  1. install Bun and Docker
  2. `cp .env.example .env`
  3. `bun install`
  4. `bun run setup`
  5. `bun dev`
  6. open `http://localhost:5173`, sign up (you become the admin)
  7. Mailpit is at `:8025`; Jaeger is at `:16686` via `docker compose --profile tracing up -d`

- [ ] **Step 6: Commit**

```bash
git add e2e README.md docs package.json
git commit -m "test(e2e): onboarding, invite-only and shell flows; docs: architecture overview and adr index"
```

---

## Self-review notes (kept for the executor)

**What this plan covers:**
- spec §4.1: accounts, teams, invite-only, first-user admin
- §5: identity only from the session; team membership in one helper; fail-fast config; type-checked builds
- §6.1–6.3: stack, layout, topology; the api stays thin; the worker owns the queue
- §6.6: observability
- §6.8: local environment
- §9: Linear tokens, ⌘K, `?` shortcuts, contrast, reduced motion, theme
- §10: ADRs 0001–0013
- §11: unit, integration and E2E tests

**Deliberately deferred to Plans 2–5, per the Roadmap:**
- the meeting pipeline, SSE, `packages/ai` and Ollama
- calendar, encryption and the scheduler leader lock
- the meeting page, chat, search and speakers
- production Docker, Caddy and backups
