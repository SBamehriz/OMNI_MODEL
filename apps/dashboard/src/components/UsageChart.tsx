'use client';

import { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

type Point = { date: string; requests: number; cost: number; savings?: number };
type Props = { from?: string; to?: string };

function buildUsageUrl(from?: string, to?: string) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const query = params.toString();
  return `${apiUrl}/v1/usage${query ? `?${query}` : ''}`;
}

export function UsageChart({ from, to }: Props) {
  const [data, setData] = useState<Point[]>([]);
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
      .then((d) => {
        const byDay = (d.by_day ?? []) as { date: string; requests: number; cost: number; savings?: number }[];
        if (byDay.length > 0) {
          setData(byDay.map((p) => ({ date: p.date, requests: p.requests, cost: p.cost, savings: p.savings })));
          return;
        }
        const byModel = (d.by_model ?? []) as { model: string; count: number; cost: number }[];
        setData(byModel.map((m) => ({ date: m.model, requests: m.count, cost: m.cost })));
      })
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [from, to]);

  if (loading)
    return (
      <div className="panel rounded-2xl p-6 text-sm ink-muted">
        Loading usage…
      </div>
    );

  return (
    <div className="panel rounded-2xl p-6 reveal" style={{ animationDelay: '0.05s' }}>
      <div className="flex items-end justify-between">
        <div>
          <p className="mono text-xs ink-muted">Usage over time</p>
          <h2 className="headline text-2xl font-semibold mt-2">Routing volume</h2>
        </div>
        <p className="text-xs ink-muted">Daily aggregation</p>
      </div>
      {data.length === 0 ? (
        <p className="ink-muted text-sm mt-6">No data yet. Send requests to the router to see usage.</p>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={data} margin={{ top: 18, right: 8, left: 0, bottom: 0 }}>
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v: number) => [v, '']} />
            <Area type="monotone" dataKey="requests" stroke="#ff5b2e" fill="#ff5b2e" fillOpacity={0.2} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
