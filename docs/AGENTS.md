# Omni-Model Router — Agent instructions

Instructions for AI or human agents building this product. Follow the build order below and use the referenced docs as the single source of truth.

---

## Where to find what

| Need | Document |
|------|----------|
| Vision, problem, solution, positioning | [IDEA.md](../IDEA.md) |
| MVP scope, tech stack, schema, roadmap | [plan.md](../plan.md) |
| Request/response contracts, errors, auth | [API.md](API.md) |
| Components and data flow | [ARCHITECTURE.md](ARCHITECTURE.md) |

---

## Build order

Execute in this order to respect dependencies.

1. [x] **Repo and schema** — Create folder structure (`apps/api`, `apps/dashboard`, `docs/`). Define and apply DB schema (users, orgs, models, requests, routing_logs) per [plan.md](../plan.md). No app logic yet.
2. [x] **Auth and model registry** — Implement API key verification (header → lookup → attach org_id). Seed or manage the `models` table (provider, model_name, cost_input, cost_output, avg_latency, strengths). See [plan.md](../plan.md) and [API.md](API.md).
3. [x] **Single-provider proxy** — One provider (e.g. OpenAI), one route (e.g. POST `/v1/chat`) that forwards messages to that provider and returns the reply. No routing logic yet; proves pipeline and auth.
4. [x] **Task classifier** — Detect task type (chat, coding, reasoning, summarization, translation, image, agent_step) from the request. Use a cheap model or heuristic. Store result for the next step.
5. [x] **Routing and fallback** — Implement routing engine (rule-based MVP): select model from registry by task and preferences (priority, latency_pref). Call provider adapter; on failure try backup then cheapest fallback. See routing formula in [plan.md](../plan.md).
6. [x] **Logging and dashboard** — Log every request (model_used, tokens, cost, latency_ms, success) to DB. Compute and store savings. Build dashboard (Overview, Usage, Model breakdown) reading from DB. See [API.md](API.md) for GET `/v1/usage`.

After 6, add polish, deployment (Vercel, Supabase, Upstash), and beta users.

---

## Progress tracking

- [ ] Update `plan.md` checkboxes as you start or finish items. Use `[ ]` not started, `[-]` in progress, `[x]` done, `[~]` blocked.
- [ ] If you change scope or add tasks, add new lines to `plan.md` with a status marker.
- [ ] Keep `docs/API.md`, `docs/ARCHITECTURE.md`, and `plan.md` consistent when changing contracts or components.

---

## Conventions

- [ ] **TypeScript** with strict mode. Use for `apps/api` and `apps/dashboard`.
- [ ] **Secrets** — All keys and secrets from environment variables; never commit.
- [ ] **API version** — Prefix all routes with `/v1/`. Keep contract in [API.md](API.md) in sync with implementation.
- [ ] **Errors** — Use the shared error shape from [API.md](API.md) (`error.code`, `error.message`, `request_id`).

---

## Completion checklist

- [x] Update `plan.md` progress markers for work you completed.
- [x] Update `docs/API.md` if endpoint payloads or error shapes change.
- [ ] Update `docs/ARCHITECTURE.md` if components or data flow change.
- [x] Add or update migrations in `supabase/migrations/` if schema changes.
- [x] Add any new env vars to `plan.md` and `README.md`.

---

## Out of scope for MVP

Do not implement in the first release:

- ML-based or learned routing
- A/B testing of models
- Enterprise controls (SSO, fine-grained audit)
- Full benchmarking engine
- Response caching

Focus on core routing, cost tracking, fallback, and demonstrable savings.
