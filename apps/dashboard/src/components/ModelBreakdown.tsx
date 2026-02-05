'use client';

import { useEffect, useState } from 'react';

type ModelRow = { model: string; count: number; cost: number };

export function ModelBreakdown() {
  const [rows, setRows] = useState<ModelRow[]>([]);
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
      .then((d) => setRows((d.by_model ?? []) as ModelRow[]))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="rounded-lg border border-neutral-700 p-6 text-neutral-500">Loading…</div>;

  return (
    <div className="rounded-lg border border-neutral-700 bg-neutral-900/30 p-6">
      <h2 className="text-lg font-medium mb-4">Model breakdown</h2>
      {rows.length === 0 ? (
        <p className="text-neutral-500 text-sm">No requests yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-neutral-400 border-b border-neutral-700">
              <th className="text-left py-2">Model</th>
              <th className="text-right py-2">Requests</th>
              <th className="text-right py-2">Cost</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.model} className="border-b border-neutral-800">
                <td className="py-2 font-mono">{r.model}</td>
                <td className="py-2 text-right">{r.count}</td>
                <td className="py-2 text-right">${r.cost.toFixed(4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
