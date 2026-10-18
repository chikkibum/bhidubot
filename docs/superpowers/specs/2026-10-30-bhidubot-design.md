# bhidubot — Design

> Status: **Draft for approval** · Date: 2026-10-30 · Author: Bhaskar (with Claude)
>
> This is the product and system design for bhidubot. A builder should be able to plan the work from it. Choices the
> user made are marked **(decided)**. Choices Claude made on the user's behalf are marked **(our call)** and are
> open to challenge.

---

## 1. Intent

bhidubot is a meeting-intelligence workspace for **the user's own team**. It's inspired by Fireflies.ai (a bot that
joins calls and produces notes) and Bubbles (async screen and camera recordings that people comment on instead of
meeting).

It's the successor to `D:\learn\meeting-bot69`, a tutorial project the user studied. bhidubot rebuilds the same idea
on a modern stack, fixes the architectural problems found in that project
(see `D:\learn\meeting-bot69\docs\ARCHITECTURE-CHANGES.md`), and grows into async recordings.

**Why:** it's a learning and portfolio project the team will actually use. It's built to run **entirely on one
machine** first. Once the user is confident in it, it should be **easy to deploy and host** for the team.

**What success looks like**
- `docker compose up` (plus one `bun` command) gives a working app locally, with no paid services except
  MeetingBaaS.
- The team uses it for real calls: the bot joins, and a summary, action items and a chat-able transcript appear
  without anyone babysitting it.
- Deploying to a VPS is a matter of configuration, not a rewrite.
- Every significant architecture decision is written down with its why, pros, cons and alternatives.

## 2. Goals, non-goals, anti-goals

**Goals**
- A meeting notetaker that's as good as meeting-bot69 feature-for-feature, with its security and reliability
  problems designed out from day one.
- An AI provider the user can switch: local Ollama, OpenAI, OpenRouter, or any OpenAI-compatible endpoint.
- Linear-quality UI and UX: fast, dense, keyboard-friendly, with light and dark modes.
- Thorough architecture documentation (ADRs).

**Non-goals (for now)**
- Public multi-tenant SaaS at scale. The audience is one team, possibly a few.
- Running our own meeting bot. MeetingBaaS is used now, behind an adapter so it can be replaced later **(decided)**.
- Mobile apps.

**Anti-goals: things that would make this a failure even if it technically worked**
- Repeating meeting-bot69's trust bugs: identity taken from request bodies, unauthenticated webhooks, quota checks
  only in the browser, derived data (vectors) left behind after deletes.
- Local setup that needs cloud accounts beyond MeetingBaaS (and an LLM API key, _only if_ the user picks a hosted
  provider).
- Local and production setups that diverge, so "works locally" means nothing.
- UI that looks like a generic template. It must follow the chosen DESIGN.md and pass the taste and animation
  reviews (§9).

## 3. Phases **(decided order)**

1. **Core: meeting notes** (this document specifies this phase in full)
2. **Async recordings** (Bubbles-like; outlined in §7 so Phase 1 doesn't block it)
3. **Integrations:** Slack, then Jira, Asana and Trello
4. **Billing** (Stripe plans and limits)

---

## 4. Phase 1: functional specification

### 4.1 Accounts and teams

- Sign up and sign in with **Better Auth** **(decided)**, using email + password and Google sign-in.
- Teams use Better Auth's **organization plugin** **(our call)**. A user creates a team, invites teammates by email
  (the invite email is caught by Mailpit locally), and can belong to several teams with a team switcher in the
  sidebar.
- Roles: `owner`, `admin`, `member`. Admins manage the team's AI settings and members.
- **Visibility: every member of a team can see every meeting in that team** (agreed in conversation). Meetings
  belong to a team, and the person who connected the calendar or sent the bot is recorded as `createdBy`.
- **Private meetings exception (decided):** a calendar event that's **marked private in Google**, or has **two or
  fewer participants** (1:1s), is created with **bot off** and **visibility `private`**. Only its attendee-owners
  (the teammates whose calendars contain it) can see it. An owner can switch it to `team` visibility or turn the bot
  on. This is modelled as a `visibility: team | private` field on meetings and enforced by the shared authorization
  helper, including retrieval: private meetings' chunks are excluded from other members' Ask AI results.
- **Who can sign up (our call):** this is a self-hosted, single-organisation install.
  - The **first user to sign up becomes the instance admin.**
  - After that, sign-up is **invite-only**, with an optional allowed-email-domain list in the env.
  - Strangers therefore can't create teams that spend the deployment's MeetingBaaS or LLM credits.
  - Teams fall back to the env-default AI keys only if the instance admin allows it.
- **No sharing outside the team in Phase 1 (our call).** Public, revocable share links are built once, in Phase 2,
  for both recordings and meetings, using the same mechanism. They're served from a public API endpoint plus an SPA
  route, so no server rendering is needed.
- **No data migration from meeting-bot69 (our call):** it was a tutorial codebase being studied, not a system holding
  real team data.

### 4.2 Getting the bot into calls

- **Calendar sync:** each user can "Connect Google Calendar". This is a separate OAuth step that requests
  `calendar.readonly`, so signing in never asks for calendar access **(our call)**. Upcoming events that have a
  Meet, Zoom or Teams link appear on Home with a **Bot on/off** toggle.
  - Default for new events: bot **on** (same as meeting-bot69), except private and 1:1 events (see §4.1). Users can
    change this default in their settings.
  - **Google OAuth app status (decided: the team doesn't share one Google Workspace domain):** the Google Cloud app
    is **External**. Phase 1 runs in **Testing** mode with teammates added as test users. In Testing mode, refresh
    tokens for this scope **expire after 7 days**, so the app must:
    - detect `invalid_grant` and mark the connection **"needs reconnect"**
    - pause that user's sync without errors piling up
    - show a banner and send an email with a one-click reconnect
    - keep "send bot to link" working regardless

    Before relying on it day-to-day, submit the app for Google verification. `calendar.readonly` is a _sensitive_
    scope, which needs a privacy policy, a homepage, a verified domain and a demo video. That's a deployment task,
    tracked in `docs/DEPLOYMENT.md`.
  - Sync runs every few minutes in the worker. Deleted or cancelled events are removed unless a bot was already
    sent (a known meeting-bot69 bug).
  - **Which team an event lands in (our call):** each calendar connection is attached to **one team**, chosen when
    connecting, defaulting to the current team. It can be changed later.
  - **De-duplication (our call):** when several teammates have the same call, it becomes **one meeting and one bot
    per team**. The key is the Google `iCalUID` + start time, with a fallback of normalised meeting URL + start
    time. Each member whose calendar contains the event is recorded as an attendee-owner of the meeting. **Any of
    them** can flip its bot toggle, and the meeting dispatches if any of them leaves it on.
- **Send bot now:** paste any Zoom, Meet or Teams URL on Home, and the bot is dispatched immediately. This creates
  an ad-hoc meeting.
- **Dispatch:** the worker sends the bot through the `MeetingBotProvider` interface (MeetingBaaS adapter) about 2
  minutes before the start time. Dispatch is idempotent: guarded by a state transition, so it never sends twice.
- **Bot persona:** team-level bot name and avatar. The avatar is uploaded to S3, and its public URL is passed to the
  provider.
- **Failure is visible:** if the bot can't join (waiting room, bad link, provider error), the meeting shows that
  status and the reason. Nothing fails silently.

### 4.3 After the call: processing pipeline

1. The provider webhook arrives. It's **authenticated**, written to Postgres, and acknowledged immediately.
2. A job is queued on SQS. The worker then runs **independent, idempotent steps**, each with its own status:
   - **ingest:** copy the recording from the provider to our S3, so links never expire; normalise the transcript
     to our format (segments with speaker, start/end time, text).
   - **summarize:** the LLM produces a summary, key decisions and action items (with assignee name and due date if
     mentioned), using structured JSON output validated against a schema. If a transcript exceeds the model's
     context window, which is likely with local models on hour-long calls, summarisation runs **map-reduce over
     transcript sections** **(our call)**.
   - **index:** chunk the transcript (keeping segment timestamps), embed it, and store it in pgvector.
   - **notify:** email the summary to the meeting's team members who were attendees, or to the creator if attendees
     are unknown. This uses SMTP: Mailpit locally, any SMTP or Resend in production.
3. Failed steps retry with backoff and land in a dead-letter queue after N attempts. The UI shows per-step status,
   and an admin can click "Retry".
4. The browser sees status changes live via SSE ("Processing…" → "Ready").

### 4.4 Meeting page (wireframe agreed in the visual companion)

- A header with title, date, duration and speakers.
- A **recording player** (video or audio). The transcript highlights and auto-scrolls with playback, and clicking
  a transcript line seeks the player.
- Tabs: **Summary**, **Transcript**, **Action items**.
  - Summary shows the model and provider used, plus "Regenerate".
  - **Regenerate and action items (our call):** action items belong to the **meeting**, not to a summary version.
    Regenerating replaces only the summary text (the old versions are kept). Newly extracted action items appear as
    **suggestions** the user can accept. Regeneration never edits, deletes or duplicates items a user has touched.
  - Action items can be edited, checked off, added and deleted. Exporting to Jira and other tools comes in
    Phase 3.
- A side panel to **ask about this meeting**: retrieval scoped to the meeting. Answers cite **clickable timestamps**
  that seek the player.
- Delete meeting (admin or creator). This removes the rows, S3 objects and vectors.

### 4.5 Ask AI (across meetings)

- Chat across **all of the team's meetings**, with retrieval scoped to the team, and optional filters for date
  range, participant and specific meetings.
- Answers cite the meeting and timestamp. Keep **multi-turn** context: send the recent conversation within a token
  budget **(our call, improving on meeting-bot69's single-turn chat)**.
- Chat threads are saved per user, so they can be revisited.

### 4.6 Search and browse

- A meetings list with full-text search (Postgres `tsvector` over titles, summaries and transcripts) and filters:
  date range, participant, duration, status.
- **Hybrid retrieval** for the AI: vector similarity combined with full-text rank **(our call)**. Meeting questions
  are full of names and ticket IDs, which pure embedding search handles poorly.

### 4.7 Speaker renaming (decided: in Phase 1)

- On the meeting page, a user can rename a speaker label once (e.g. "Speaker 2" → "Ana"). The new name applies to
  every segment by that speaker in that meeting.
- Optionally, link the speaker to a team member. Later meetings then suggest that mapping when the provider's label
  or voice name matches.
- Model speakers as rows (`meeting_speakers`: provider label, display name, optional member ID). Segments and chunks
  reference the speaker **by ID**, so renaming needs **no re-embedding**: citations and the transcript resolve the
  display name at read time. Chunk text sent to the LLM is rendered with current names when the prompt is built.

### 4.8 Settings

- **Team AI settings (admin):**
  - provider and model for **chat**
  - provider and model for **embeddings**
  - provider for **transcription** (needed in Phase 2)
  - API keys, stored encrypted
  - a "Test connection" button
- **Personal settings:** profile, calendar connection, the default bot on/off for new events, theme
  (system/light/dark).
- **Team settings:** name, members and invites, bot name and avatar.

---

## 5. Lessons from meeting-bot69 that are now requirements

These come from `meeting-bot69/docs/ARCHITECTURE-CHANGES.md` and are design constraints, not suggestions:

| Requirement                                                                                            | Origin              |
| ------------------------------------------------------------------------------------------------------ | ------------------- |
| Identity only from a verified session or a verified webhook; never from a request body                 | D1                  |
| Every webhook is authenticated and fails closed when its secret isn't configured                       | D2                  |
| Every data read is authorized by team membership in one shared helper, never per-route ad hoc checks   | D3, D15             |
| OAuth `state` is a CSRF nonce bound to the session                                                     | D4                  |
| Webhooks acknowledge fast; heavy work goes through a queue with retries and a dead-letter queue        | D7, D8              |
| Pipeline steps are independent, idempotent and resumable; no placeholder content is written on failure | D8                  |
| Deleting a meeting deletes its vectors and S3 objects                                                  | D11                 |
| LLM extraction uses structured output with schema validation                                           | D12                 |
| One source of truth for rules and config; no duplicated limits or schemas                              | D5, D14             |
| Builds fail on type errors                                                                             | D16                 |
| Third-party tokens and API keys are encrypted at rest                                                  | D17                 |
| Vectors live in Postgres (pgvector), not a separate vector DB                                          | pgvector discussion |

---

## 6. System architecture

### 6.1 Stack

| Concern                     | Choice                                                                                         | Status                                     |
| --------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Runtime and package manager | Bun                                                                                            | decided                                    |
| Monorepo                    | Bun workspaces + Turborepo (task pipeline and caching)                                         | our call                                   |
| API                         | Elysia                                                                                         | decided                                    |
| API ↔ web typing            | Eden Treaty (end-to-end types; no hand-written client)                                         | our call                                   |
| Web                         | TanStack Router + Query + Form + Table, as a Vite single-page app                              | TanStack decided; SPA vs Start is our call |
| Database                    | Postgres + pgvector                                                                            | our call (pgvector discussion)             |
| ORM and migrations          | Drizzle (native `vector` column type)                                                          | decided                                    |
| Auth                        | Better Auth (+ organization plugin)                                                            | decided                                    |
| Object storage              | S3 API: **Floci** locally; AWS S3 or Cloudflare R2 in production                               | Floci decided                              |
| Job queue                   | SQS API: **Floci** locally; AWS SQS in production                                              | Floci decided; SQS is our call             |
| AI                          | `packages/ai` built on Vercel AI SDK providers (Ollama, OpenAI, OpenRouter, OpenAI-compatible) | providers decided; SDK is our call         |
| Meeting bot                 | MeetingBaaS behind a `MeetingBotProvider` interface                                            | decided                                    |
| Email                       | SMTP (Mailpit locally) or Resend in production, behind one interface                           | our call                                   |
| Containers                  | Docker + Docker Compose                                                                        | decided                                    |
| Reverse proxy and TLS       | Caddy                                                                                          | our call                                   |
| Local webhook tunnel        | cloudflared (optional Compose profile)                                                         | our call                                   |

**Why a SPA rather than TanStack Start:** bhidubot is a signed-in team tool, so SEO and first-paint server rendering
don't matter. Elysia is already the server. A static build is simpler to host, either served by Caddy or by Elysia
itself. Shareable public pages, if they're ever needed (Phase 2 share links), can be added later.

### 6.2 Repository layout

```
bhidubot/
├─ apps/
│  ├─ web/          TanStack SPA (Vite)
│  ├─ api/          Elysia HTTP API + webhooks + SSE + Better Auth handler
│  └─ worker/       Bun long-running process: SQS consumers + scheduler ticks
├─ packages/
│  ├─ db/           Drizzle schema, migrations, query helpers, pgvector
│  ├─ ai/           provider registry: chat, embeddings, transcription; prompts; structured outputs
│  ├─ meeting-bot/  MeetingBotProvider interface + MeetingBaaS adapter
│  ├─ storage/      S3 client wrapper (Floci / AWS / R2 via env)
│  ├─ queue/        SQS producer/consumer helpers, job types, DLQ handling
│  ├─ auth/         Better Auth config shared by api (and worker for lookups)
│  ├─ shared/       domain types, validation schemas, constants
│  ├─ ui/           components + design tokens from Linear DESIGN.md
│  └─ config/       tsconfig, lint, env schema (validated at startup)
├─ docker/          Dockerfiles, Caddyfile, compose overrides
├─ docs/
│  ├─ ARCHITECTURE.md
│  ├─ decisions/    ADRs (see §10)
│  └─ design/DESIGN.md   Linear DESIGN.md from getdesign.md (source of truth for UI)
├─ docker-compose.yml          local
└─ docker-compose.prod.yml     VPS
```

### 6.3 Runtime topology

```
Browser ──HTTPS──▶ Caddy ─┬─▶ web (static SPA)
                          └─▶ api (Elysia) ──┬─ Postgres + pgvector
                                ▲   │        ├─ S3  (Floci | AWS/R2)
     MeetingBaaS webhook ───────┘   │        └─ SQS (Floci | AWS)
     (verified secret)              │ SSE ◀── Postgres LISTEN/NOTIFY
                                    ▼
                      worker (Bun) ── consumes SQS jobs, runs scheduler ticks
                         ├─ MeetingBaaS API (dispatch bots)
                         ├─ Google Calendar API (sync)
                         ├─ AI providers (Ollama | OpenAI | OpenRouter | …)
                         └─ SMTP (Mailpit | real)
```

- **The API stays thin:** it does auth, validation and authorization, writes to Postgres, enqueues jobs and streams
  SSE. It never makes long LLM calls inside a request. The one exception is chat, which streams its tokens straight
  to the browser.
- **The worker owns slow and external work.** Scheduler ticks (calendar sync, bot dispatch, sweeping stuck jobs)
  run on intervals inside the worker. Only one worker should run scheduler ticks; use a Postgres advisory lock so
  scaling the worker doesn't duplicate them.
- **Realtime:** the worker writes status changes, then `NOTIFY`s. The API `LISTEN`s and pushes SSE to subscribed
  browsers. No Redis is needed.

### 6.4 Data model (sketch; the builder finalises it)

- Better Auth tables: users, sessions, accounts, organizations, members, invitations.
- `calendar_connections`: user → encrypted Google tokens and sync cursor.
- `meetings`: `team_id`, `created_by`, `source` (calendar | adhoc), `calendar_event_id`, title, start and end,
  meeting URL, attendees, `bot_enabled`, `bot_status` (scheduled → dispatched → joined → recording → ended | failed
  - reason), `provider_bot_id`, `recording_s3_key`, step statuses (`ingest`, `summarize`, `index`, `notify`, each
    with state, attempts and `last_error`).
- `transcript_segments`: meeting, speaker, `start_ms`, `end_ms`, text.
- `meeting_chunks`: meeting, text, `start_ms`, `end_ms`, `embedding vector(N)`, `embedding_model`, a `tsvector`
  column.
- `summaries` (versioned, so "Regenerate" keeps history), and `action_items` (as proper rows, not a JSON blob).
- `chat_threads` and `chat_messages`, with citations.
- `team_ai_settings`: providers, models, encrypted keys.

**Embedding dimension rule:** a pgvector column has a fixed dimension, and changing embedding model changes both the
vector space and the dimension. So: each chunk records its `embedding_model`, the team's embedding model is set by
an admin, and **changing it starts a background re-index job**. The column dimension is configured once per
deployment (env), and the UI only offers embedding models that match it. The default dimension is the builder's call
(e.g. 768 for `nomic-embed-text`, with OpenAI's `text-embedding-3-small` asked for 768 dimensions via its
`dimensions` parameter).

### 6.5 AI provider abstraction (`packages/ai`)

- Capabilities: `chat` (streaming + structured output), `embed`, `transcribe` (Phase 2).
- Providers: Ollama, OpenAI, OpenRouter, generic OpenAI-compatible (covers LM Studio, vLLM, Groq and others).
  Configured per team in the database. Environment variables provide defaults for first boot.
- Structured output must work with local models. Use JSON-schema-constrained output where the provider supports it,
  and fall back to "JSON mode + schema validation + one repair retry".
- Prompts live in one place, are versioned, and their outputs are tested against fixture transcripts.

### 6.6 Observability (decided: in Phase 1)

- Structured JSON logs in the api and worker, with a request/job correlation ID.
- **OpenTelemetry tracing** across api → SQS → worker. The trace context travels in SQS message attributes, so one
  meeting's pipeline appears as a single trace from webhook to email.
- Locally, an optional Compose profile adds a trace viewer (Jaeger, or Grafana + Tempo; builder's call). In
  production, export over OTLP to whatever backend is chosen later, or disable it.
- Key pipeline metrics: steps by status, step durations, retries, and DLQ depth.

### 6.7 Local AI on the user's machine (decided inputs: RTX 3060 laptop GPU, ~30-minute calls)

- A laptop RTX 3060 typically has **6 GB of VRAM**, which fits **7–8B models at 4-bit quantisation**.
- A 30-minute call is roughly 4–6k words, about 6–8k tokens, so a single-pass summary fits with
  `num_ctx` ≈ 8–16k. The map-reduce fallback from §4.3 covers longer calls.
- **Run Ollama natively on Windows (our call)**, not in Docker. Native Ollama uses the GPU directly with no WSL2/GPU
  passthrough setup. Containers reach it at `http://host.docker.internal:11434`. The Compose file keeps an
  **optional `ollama` profile** for Linux hosts with GPUs.
- **Starting defaults, to be validated in the build (§14):**
  - chat and summaries: a 7–8B instruct model with reliable JSON output (e.g. `qwen2.5:7b-instruct` or
    `llama3.1:8b`)
  - embeddings: `nomic-embed-text`, which sets the default pgvector dimension to **768**. OpenAI
    `text-embedding-3-small` is called with `dimensions: 768` so the providers are interchangeable without a schema
    change.
  - Phase 2 transcription: `faster-whisper` small or medium on the GPU.

### 6.8 Environments

- **Local:** `docker compose up` starts Postgres+pgvector, Floci, Mailpit and (optionally) cloudflared and a trace
  viewer. Ollama runs natively on the host (§6.7).
  `bun dev` runs web, api and worker with hot reload. A seed script creates a demo team and sample meetings from
  fixture transcripts, so the UI works without a real call.
- **Production (VPS):** `docker-compose.prod.yml` runs Caddy, web, api, worker and Postgres. S3 and SQS point at AWS
  (or R2 for storage) through env vars. Ollama is optional, since it needs a GPU; the default production
  recommendation is OpenRouter or OpenAI.
- **Configuration:** one env schema, validated at startup, so a missing secret fails the boot loudly.
- **Backups:** a nightly `pg_dump` to S3 (production Compose service).

---

## 7. Phase 2 outline: async recordings (so Phase 1 doesn't block it)

- Record screen, camera or both in the browser (`MediaRecorder`), with a camera bubble overlay. Upload directly to
  S3 with presigned multipart uploads.
- Every recording gets a share link. Viewers watch and leave **timestamped comments and reactions**, and view
  counts are recorded.
- Transcription uses `packages/ai` `transcribe`: a local Whisper container, or a hosted API.
- Summary, chapters and indexing reuse the **same pipeline steps** as meetings. Therefore Phase 1 must model the
  pipeline over a generic "media item" (meeting | recording), even though only meetings exist in Phase 1.

## 8. Phases 3–4 (placeholders)

- **Integrations:** a Slack app (ask questions; post summaries to a channel), with Slack accounts linked
  explicitly from the web app, never by email matching. Jira, Asana and Trello export action items. One
  `Integration` interface, with tokens encrypted.
- **Billing:** Stripe, with plan rules in one module and enforced on the server. Usage is counted once, when the bot
  is dispatched.

---

## 9. UI and UX

- **Design source of truth:** Linear's DESIGN.md from getdesign.md (`npx getdesign@latest add linear.app`)
  **(decided)**, copied into `docs/design/DESIGN.md` and turned into tokens in `packages/ui`. The key tokens: canvas
  `#010102`, surfaces `#0f1011`–`#191a1b`, hairlines `#23252a`, ink `#f7f8f8`, the single accent `#5e6ad2`, and
  8px radii. Light mode uses the file's inverse tokens. The theme follows the system by default and can be toggled.
- **Skills used during UI work** **(decided)**:
  - `taste-skill` (`npx skills add Leonxlnx/taste-skill`)
  - Emil Kowalski's skills (`npx skills add emilkowalski/skill`), especially `emil-design-eng`,
    `review-animations`, `break-ui` and `pick-ui-library`
  - Every screen is reviewed against these before it counts as done.
- **UX requirements:**
  - **⌘K command palette** for navigation, "send bot to link", search, and theme.
  - Keyboard shortcuts with a `?` cheat sheet.
  - **Optimistic updates** for toggles, action items and edits.
  - Skeleton loaders shaped like the content. Purposeful empty states (e.g. "Connect your calendar").
  - Error states that say what happened and offer a next action.
  - **Accessibility:** WCAG 2.2 AA contrast in both themes, visible focus rings (accent), full keyboard
    operability, `prefers-reduced-motion` respected, and semantic landmarks.
  - Responsive down to phone width for reading meetings. Recording and settings can be desktop-first.
  - Motion is short and purposeful, per Emil's rules. No decorative animation.

---

## 10. Architecture documentation requirement **(decided)**

- `docs/ARCHITECTURE.md` gives the system overview, diagrams and data flows, and is kept current.
- `docs/decisions/NNNN-title.md` holds one ADR per significant decision, with this template:
  **Context → Decision → Why → Pros → Cons → Alternatives considered → Consequences / follow-ups**.
- The initial ADR set (at least): monorepo tooling; Bun + Elysia; Eden Treaty; TanStack SPA vs Start; Drizzle;
  Postgres + pgvector; Better Auth + organizations; Floci + S3 + SQS; worker + scheduler design and the leader lock;
  pipeline step model; LISTEN/NOTIFY + SSE; AI provider abstraction and the embedding-dimension rule; MeetingBaaS
  adapter; webhook authentication; secret encryption; Caddy + VPS deployment; email via SMTP/Mailpit; hybrid
  retrieval; design system (Linear DESIGN.md); meeting visibility and private-meeting rules; calendar ownership and
  de-duplication; Google OAuth app status and token-expiry handling; native Ollama + model and embedding-dimension
  defaults; OpenTelemetry tracing across the queue; speaker model (rename without re-embedding); invite-only
  sign-up.
- Any new significant decision during the build gets its ADR **in the same change**.

## 11. Quality bar

- TypeScript strict mode. Builds and CI fail on type errors and lint errors.
- `bun test` covers domain logic in `packages/*`: pipeline steps, the authorization helper, chunking, provider
  adapters with fakes, and webhook verification.
- A small set of Playwright end-to-end tests: sign up → create team → see the seeded meeting → ask a question.
- A fake `MeetingBotProvider` and fake webhook replays for local testing, so the whole pipeline can run without a
  real call.

---

## 12. Suggested additions (Claude's suggestions; the user hasn't decided these)

**Accepted into Phase 1:**
1. **Fake meeting-bot provider + webhook replay CLI.** Exercise the whole pipeline locally for free, without joining
   a real call (§11).
2. **Speaker renaming** (§4.7). _Decided._
3. **Observability baseline** (§6.6). _Decided._

Worth considering **later**:
4. **An MCP server** exposing "search meetings" and "get meeting" tools, so Claude, Cursor and other agents can query
the team's meeting knowledge.
5. **Transcript translation** (the user's meeting-bot69 wish list), using the configured LLM.
6. **Calendar push notifications** (Google `events.watch`) instead of polling, once polling becomes costly.
7. **Weekly digest email:** decisions and open action items across the team's meetings.

## 13. Left to the builder

- Exact library choices within the decided stack (component primitives, SSE helper, cron/interval utility),
  validated with `pick-ui-library` for UI.
- The final schema details, chunk sizes, retrieval `k`, and the default embedding dimension/model.
- Route map and URL structure; ADR numbering.
- Polling intervals (calendar sync, dispatch lead time), retry counts and backoff.

## 14. Open questions to verify during the build

- MeetingBaaS: how webhooks are authenticated (signature or header), the event names for failures and status
  changes, whether recording URLs expire, and whether the `extra` field is echoed back.
- Floci: confirm that its SQS (including DLQ redrive) and S3 (including presigned multipart uploads, needed in Phase
  2) behave like AWS for the features used.
- Ollama: structured-output reliability of the chosen default local model for summary extraction.
