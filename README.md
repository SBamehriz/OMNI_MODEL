# Omni-Model Router

**The most efficient API for AI** — one endpoint, best model per request, best results for the best price.

## Documentation

- **[docs/SETUP.md](docs/SETUP.md)** — Environment setup, API keys, and commands
- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — System architecture and component overview
- **[docs/API.md](docs/API.md)** — API contract and endpoint reference
- **[docs/AGENTS.md](docs/AGENTS.md)** — Build order and conventions for AI or human agents
- **[docs/IDEA.md](docs/IDEA.md)** — Vision, problem, solution, and positioning
- **[docs/PLAN.md](docs/PLAN.md)** — MVP technical plan, stack, and roadmap

---

## Prerequisites

- Node.js (LTS)
- [Supabase](https://supabase.com) (Postgres + Auth)
- [Upstash](https://upstash.com) Redis (optional, for multi-instance rate limits)

---

## Repo structure

```
omni-model-router/
├── README.md
├── docs/
│   ├── ARCHITECTURE.md
│   ├── API.md
│   ├── SETUP.md
│   ├── AGENTS.md
│   ├── IDEA.md
│   └── PLAN.md
├── apps/
│   ├── api/                 # Fastify backend (Node.js + TypeScript)
│   │   ├── src/
│   │   │   ├── index.ts     # Server entry point
│   │   │   ├── routes/      # API route handlers
│   │   │   └── lib/         # Core logic (auth, routing, providers, etc.)
│   │   └── scripts/         # Utility scripts (key generation)
│   └── dashboard/           # Next.js frontend (React + Tailwind)
│       └── src/
│           ├── app/          # Next.js App Router pages
│           └── components/   # React components (Overview, UsageChart, etc.)
├── packages/
│   └── shared/              # Shared TypeScript types
└── supabase/
    └── migrations/          # Database schema and seed migrations
```

---

## How to run

1. **Database:** Create a Supabase project. Run the SQL files in `supabase/migrations/` in order (001 through 005) in the SQL editor.

2. **API:** From repo root:
   ```bash
   npm install
   cd apps/api
   cp .env.example .env
   # Set SUPABASE_URL, SUPABASE_SERVICE_KEY, and at least one provider key
   npm run dev
   ```
   The API listens on port 3000.

3. **Dashboard:** In `apps/dashboard`:
   ```bash
   cp .env.example .env.local
   # Set NEXT_PUBLIC_API_URL and NEXT_PUBLIC_API_KEY
   npm run dev
   ```
   Dashboard runs on port 3001.

---

## Deployment

- **Database (Supabase):** Create a project at [supabase.com](https://supabase.com). Run migrations in order in the SQL editor.
- **Dashboard (Vercel):** Connect the repo, set **Root Directory** to `apps/dashboard`. Add env vars: `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_API_KEY`.
- **API:** Deploy to [Fly.io](https://fly.io), [Railway](https://railway.app), or a VPS. Set all env vars from `apps/api/.env.example`. Use `npm run build && npm run start` in `apps/api`.
- **Redis (optional):** Create an [Upstash](https://upstash.com) Redis database for distributed rate limiting. Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.

---

## Building agents

If you are an AI or human agent building this product:

1. Read **[docs/AGENTS.md](docs/AGENTS.md)** for build order and conventions.
2. Use **[docs/PLAN.md](docs/PLAN.md)** for MVP scope, schema, and API contracts.
3. Use **[docs/API.md](docs/API.md)** for request/response contracts.
