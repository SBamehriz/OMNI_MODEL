'use client';

import { useEffect, useState } from 'react';

type ModelRow = { model: string; count: number; cost: number };
type Props = { from?: string; to?: string };

function buildUsageUrl(from?: string, to?: string) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const query = params.toString();
  return `${apiUrl}/v1/usage${query ? `?${query}` : ''}`;
}

export function ModelBreakdown({ from, to }: Props) {
  const [rows, setRows] = useState<ModelRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_API_KEY;
    if (!apiKey) {
      setLoading(false);
      return;
    }
    fetch(buildUsageUrl(from, to), {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setRows((d.by_model ?? []) as ModelRow[]))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [from, to]);

  if (loading)
    return (
      <div className="panel rounded-2xl p-6 text-sm ink-muted">
        Loading breakdown…
      </div>
    );

  return (
    <div className="panel rounded-2xl p-6 reveal" style={{ animationDelay: '0.1s' }}>
      <div className="flex items-end justify-between">
        <div>
          <p className="mono text-xs ink-muted">Model breakdown</p>
          <h2 className="headline text-2xl font-semibold mt-2">Spend by model</h2>
        </div>
        <p className="text-xs ink-muted">Rolling total</p>
      </div>
      {rows.length === 0 ? (
        <p className="ink-muted text-sm mt-6">No requests yet.</p>
      ) : (
        <div className="mt-6 space-y-3">
          {rows.map((r) => (
            <div key={r.model} className="flex items-center justify-between rounded-xl border border-[var(--line)] bg-white/60 px-4 py-3">
              <div>
                <p className="mono text-xs ink-muted">Model</p>
                <p className="headline text-base mt-1">{r.model}</p>
              </div>
              <div className="text-right">
                <p className="mono text-xs ink-muted">Requests</p>
                <p className="headline text-base mt-1">{r.count}</p>
              </div>
              <div className="text-right">
                <p className="mono text-xs ink-muted">Cost</p>
                <p className="headline text-base mt-1">${r.cost.toFixed(4)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
