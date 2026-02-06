'use client';

import { useEffect, useState } from 'react';

type Stats = {
  total_requests: number;
  total_cost: number;
  estimated_savings: number;
  total_tokens: number;
};

type Props = { from?: string; to?: string };

function buildUsageUrl(from?: string, to?: string) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const query = params.toString();
  return `${apiUrl}/v1/usage${query ? `?${query}` : ''}`;
}

export function Overview({ from, to }: Props) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_API_KEY;
    if (!apiKey) {
      setError('Set NEXT_PUBLIC_API_KEY in your dashboard env to load usage.');
      setLoading(false);
      return;
    }
    fetch(buildUsageUrl(from, to), {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.statusText))))
      .then((d) => {
        setStats({
          total_requests: d.total_requests ?? 0,
          total_cost: d.total_cost ?? 0,
          estimated_savings: d.estimated_savings ?? 0,
          total_tokens: d.total_tokens ?? 0,
        });
      })
      .catch((e) => setError(e.message ?? 'Failed to load'))
      .finally(() => setLoading(false));
  }, [from, to]);

  if (loading) return <div className="text-neutral-500">Loading…</div>;
  if (error)
    return (
      <div className="panel rounded-2xl p-6 text-sm">
        <p className="mono text-xs ink-muted">DATA SOURCE</p>
        <p className="mt-2">{error}</p>
      </div>
    );
  if (!stats) return null;

  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 reveal">
      <div className="panel rounded-2xl p-5">
        <p className="mono text-xs ink-muted">Total requests</p>
        <p className="headline text-3xl font-semibold mt-3">{stats.total_requests}</p>
        <p className="ink-muted text-xs mt-2">Routing decisions logged</p>
      </div>
      <div className="panel rounded-2xl p-5">
        <p className="mono text-xs ink-muted">Total cost</p>
        <p className="headline text-3xl font-semibold mt-3">${stats.total_cost.toFixed(4)}</p>
        <p className="ink-muted text-xs mt-2">Actual billed estimate</p>
      </div>
      <div className="panel rounded-2xl p-5">
        <p className="mono text-xs ink-muted">Estimated savings</p>
        <p className="headline text-3xl font-semibold mt-3 ink-accent-2">${stats.estimated_savings.toFixed(4)}</p>
        <p className="ink-muted text-xs mt-2">Versus premium baseline</p>
      </div>
      <div className="panel rounded-2xl p-5">
        <p className="mono text-xs ink-muted">Total tokens</p>
        <p className="headline text-3xl font-semibold mt-3">{stats.total_tokens}</p>
        <p className="ink-muted text-xs mt-2">Input + output combined</p>
      </div>
    </section>
  );
}
