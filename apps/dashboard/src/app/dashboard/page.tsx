import type { Metadata } from 'next';
import { Overview } from '@/components/Overview';
import { UsageChart } from '@/components/UsageChart';
import { ModelBreakdown } from '@/components/ModelBreakdown';

export const metadata: Metadata = {
  title: 'Dashboard — Omni Model Router',
  description: 'Omni Model Router dashboard with analytics, routing, and billing.',
};

export default function DashboardPage() {
  return (
    <main className="min-h-screen grid-lines">
      <div className="noise" />

      <div className="max-w-6xl mx-auto px-6 pt-16 pb-24">
        <header className="mb-10 reveal">
          <p className="mono text-xs ink-accent tracking-widest uppercase">Dashboard</p>
          <h1 className="headline text-4xl font-bold mt-3">Usage &amp; Analytics</h1>
          <p className="ink-muted mt-2">
            Real-time overview of routing decisions, cost, and estimated savings.
          </p>
        </header>

        <div className="space-y-8">
          <Overview />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <UsageChart />
            <ModelBreakdown />
          </div>
        </div>
      </div>
    </main>
  );
}
