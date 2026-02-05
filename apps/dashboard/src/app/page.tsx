'use client';

import { Overview } from '@/components/Overview';
import { UsageChart } from '@/components/UsageChart';
import { ModelBreakdown } from '@/components/ModelBreakdown';
import { useMemo, useState } from 'react';

export default function DashboardPage() {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [from, setFrom] = useState<string>('');
  const [to, setTo] = useState<string>(today);
  const apiKey = process.env.NEXT_PUBLIC_API_KEY;

  const quickSet = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);
    setFrom(start.toISOString().slice(0, 10));
    setTo(end.toISOString().slice(0, 10));
  };

  return (
    <main className="min-h-screen">
      <section className="grid-lines">
        <div className="max-w-6xl mx-auto px-6 md:px-10 pt-10 pb-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="space-y-3">
              <span className="chip inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs mono">
                v1 dashboard
              </span>
              <h1 className="headline text-4xl md:text-5xl font-semibold">
                Omni‑Model Router
              </h1>
              <p className="ink-muted text-sm md:text-base max-w-xl">
                A routing command center for cost, latency, and model fit. See what the router chose, how much it
                saved, and where the spend is flowing.
              </p>
            </div>
            <div className="panel rounded-2xl px-5 py-4 w-full md:w-auto reveal">
              <p className="text-xs uppercase tracking-wide ink-muted">Status</p>
              <div className="flex items-center gap-3 mt-2">
                <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                <p className="text-sm mono">Live data wired</p>
              </div>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              className="chip rounded-full px-4 py-2 text-xs mono"
              onClick={() => quickSet(7)}
            >
              Last 7 days
            </button>
            <button
              className="chip rounded-full px-4 py-2 text-xs mono"
              onClick={() => quickSet(30)}
            >
              Last 30 days
            </button>
            <button
              className="chip rounded-full px-4 py-2 text-xs mono"
              onClick={() => quickSet(90)}
            >
              Last 90 days
            </button>
            <div className="flex items-center gap-2">
              <label className="text-xs mono ink-muted">From</label>
              <input
                className="panel rounded-lg px-3 py-2 text-xs mono"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs mono ink-muted">To</label>
              <input
                className="panel rounded-lg px-3 py-2 text-xs mono"
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 md:px-10 pb-16">
        {!apiKey && (
          <div className="panel rounded-2xl p-6 mb-6 reveal">
            <p className="mono text-xs ink-muted">Setup required</p>
            <h2 className="headline text-2xl font-semibold mt-2">Missing API key</h2>
            <p className="ink-muted text-sm mt-2">
              Set <span className="mono">NEXT_PUBLIC_API_KEY</span> in <span className="mono">apps/dashboard/.env.local</span> to load data.
            </p>
          </div>
        )}
        <Overview from={from} to={to} />
        <div className="mt-10 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
          <UsageChart from={from} to={to} />
          <ModelBreakdown from={from} to={to} />
        </div>
      </section>
    </main>
  );
}
