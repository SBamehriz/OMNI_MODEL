'use client';

import { useEffect, useState } from 'react';

type Stats = {
  total_requests: number;
  total_cost: number;
  estimated_savings: number;
};

export function Overview() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const apiKey = process.env.NEXT_PUBLIC_API_KEY;
    if (!apiKey) {
      setError('Set NEXT_PUBLIC_API_KEY to load usage (e.g. omni-dev-key-change-in-production)');
      setLoading(false);
      return;
    }
    fetch(`${apiUrl}/v1/usage`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.statusText))))
      .then((d) => {
        setStats({
          total_requests: d.total_requests ?? 0,
          total_cost: d.total_cost ?? 0,
          estimated_savings: d.estimated_savings ?? 0,
        });
      })
      .catch((e) => setError(e.message ?? 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-neutral-500">Loading…</div>;
  if (error) return <div className="text-amber-500">{error}</div>;
  if (!stats) return null;

  return (
    <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div className="rounded-lg border border-neutral-700 bg-neutral-900/50 p-4">
        <p className="text-neutral-400 text-sm">Total requests</p>
        <p className="text-2xl font-semibold mt-1">{stats.total_requests}</p>
      </div>
      <div className="rounded-lg border border-neutral-700 bg-neutral-900/50 p-4">
        <p className="text-neutral-400 text-sm">Total cost</p>
        <p className="text-2xl font-semibold mt-1">${stats.total_cost.toFixed(4)}</p>
      </div>
      <div className="rounded-lg border border-emerald-800 bg-emerald-950/30 p-4">
        <p className="text-emerald-300/80 text-sm">Estimated savings</p>
        <p className="text-2xl font-semibold mt-1 text-emerald-400">${stats.estimated_savings.toFixed(4)}</p>
      </div>
    </section>
  );
}
