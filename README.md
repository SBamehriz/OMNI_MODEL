# Omni-Model Router

**The most efficient API for AI**—one endpoint, best model per request, best results for the best price.

- **[docs/SETUP.md](docs/SETUP.md)** — **All tools and env you need** (Supabase, API keys, dashboard, commands)
- **[IDEA.md](IDEA.md)** — Vision, problem, solution, and positioning
- **[plan.md](plan.md)** — MVP technical plan, stack, and roadmap
- **[docs/AGENTS.md](docs/AGENTS.md)** — Build order and conventions for AI or human agents

---

## Prerequisites

- Node.js (LTS)
- Docker (optional, for local runs)
- [Supabase](https://supabase.com) (Postgres + Auth)
- [Upstash](https://upstash.com) Redis (optional, for multi-instance rate limits)

---

## Repo structure (high level)

```
OMNI MODEL/
├── README.md
├── IDEA.md
├── plan.md
├── docs/
│   ├── ARCHITECTURE.md
│   ├── API.md
│   └── AGENTS.md
├── apps/
│   ├── api/        # Fastify router API
│   └── dashboard/  # Next.js analytics UI
└── packages/       # shared types, etc.
```

---

## How to run

1. [ ] **Database:** Create a Supabase project and run the SQL in `supabase/migrations/` (001, 002, then 003) in the SQL editor.
2. [ ] **API:** From repo root, `npm install` then `cd apps/api`, copy `.env.example` to `.env`, set `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, and at least one provider key (`OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `OPENROUTER_API_KEY` / `GROQ_API_KEY`). Optional: `CORS_ORIGIN` (dashboard URL for cross-origin requests), `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_SEC`. Run `npm run dev` (or from root: `npm run dev:api`). The API loads env via `dotenv` and listens on port 3000.
3. [ ] **Dashboard:** In `apps/dashboard`, copy `.env.example` to `.env.local`, set `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_API_KEY` (use your dev key from Supabase or generate one per `docs/SETUP.md`). Run `npm run dev` (or from root: `npm run dev:dashboard`). Dashboard runs on port 3001.

---

## Deployment

- **Database (Supabase):** Create a project at [supabase.com](https://supabase.com). In the SQL editor, run the migrations in order: `001_initial_schema.sql`, `002_seed_models_and_dev_user.sql`, `003_add_request_token_columns.sql`. Copy the project URL and service role key into the API env.
- **Dashboard (Vercel):** Connect the repo in [Vercel](https://vercel.com). Set **Root Directory** to `apps/dashboard`. Add env vars: `NEXT_PUBLIC_API_URL` (your API URL, e.g. `https://your-api.fly.dev` or `https://api.yourdomain.com`) and `NEXT_PUBLIC_API_KEY` (the same API key clients use). Deploy.
- **API:** The API is a long-running Node server (Fastify). Deploy to [Fly.io](https://fly.io), [Railway](https://railway.app), or a VPS. Set all env vars from `apps/api/.env.example` (including `CORS_ORIGIN` to your dashboard URL, e.g. `https://your-dashboard.vercel.app`). Use `npm run build` then `npm run start` in `apps/api`; ensure `PORT` is set by the host (e.g. Fly sets it automatically).
- **Redis (optional):** For multi-instance rate limiting, create an [Upstash](https://upstash.com) Redis database and set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`. Without them, the API uses an in-memory rate limit (single instance only).

---

## Building agents

If you are an AI or human agent building this product:

1. [x] Read **[docs/AGENTS.md](docs/AGENTS.md)** for build order and conventions.
2. [x] Use **[plan.md](plan.md)** for MVP scope, schema, and API contracts.
3. [x] Use **[docs/API.md](docs/API.md)** for request/response contracts.
