# Omni-Model Router

**The most efficient API for AI**—one endpoint, best model per request, best results for the best price.

- **[IDEA.md](IDEA.md)** — Vision, problem, solution, and positioning
- **[plan.md](plan.md)** — MVP technical plan, stack, and roadmap
- **[docs/AGENTS.md](docs/AGENTS.md)** — Build order and conventions for AI or human agents

---

## Prerequisites

- Node.js (LTS)
- Docker (optional, for local runs)
- [Supabase](https://supabase.com) (Postgres + Auth)
- [Upstash](https://upstash.com) Redis (caching)

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
├── apps/           # (future)
│   ├── api/        # Fastify router API
│   └── dashboard/  # Next.js analytics UI
└── packages/       # (future) shared types, etc.
```

---

## How to run

1. **Database:** Create a Supabase project and run the SQL in `supabase/migrations/` (001 then 002) in the SQL editor.
2. **API:** From repo root, `npm install` then `cd apps/api`, copy `.env.example` to `.env`, set `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `OPENAI_API_KEY`. Run `npm run dev` (or from root: `npm run dev:api`). API listens on port 3000.
3. **Dashboard:** In `apps/dashboard`, copy `.env.example` to `.env.local`, set `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_API_KEY` (use the dev key from seed: `omni-dev-key-change-in-production`). Run `npm run dev` (or from root: `npm run dev:dashboard`). Dashboard runs on port 3001.

---

## Building agents

If you are an AI or human agent building this product:

1. Read **[docs/AGENTS.md](docs/AGENTS.md)** for build order and conventions.
2. Use **[plan.md](plan.md)** for MVP scope, schema, and API contracts.
3. Use **[docs/API.md](docs/API.md)** for request/response contracts.
