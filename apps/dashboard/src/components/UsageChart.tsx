'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

type Point = { date: string; requests: number; cost: number };

export function UsageChart() {
  const [data, setData] = useState<Point[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const apiKey = process.env.NEXT_PUBLIC_API_KEY;
    if (!apiKey) {
      setLoading(false);
      return;
    }
    fetch(`${apiUrl}/v1/usage`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        const byModel = (d.by_model ?? []) as { model: string; count: number; cost: number }[];
        setData(byModel.map((m) => ({ date: m.model, requests: m.count, cost: m.cost })));
      })
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="rounded-lg border border-neutral-700 p-6 text-neutral-500">Loading…</div>;

  return (
    <div className="rounded-lg border border-neutral-700 bg-neutral-900/30 p-6">
      <h2 className="text-lg font-medium mb-4">Usage by model</h2>
      {data.length === 0 ? (
        <p className="text-neutral-500 text-sm">No data yet. Send requests to the router to see usage.</p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v: number) => [v, '']} />
            <Bar dataKey="requests" fill="#22c55e" radius={[4, 4, 0, 0]} name="Requests" />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
