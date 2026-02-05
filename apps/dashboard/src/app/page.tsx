import { Overview } from '@/components/Overview';
import { UsageChart } from '@/components/UsageChart';
import { ModelBreakdown } from '@/components/ModelBreakdown';

export default function DashboardPage() {
  return (
    <main className="p-6 md:p-10 max-w-6xl mx-auto">
      <h1 className="text-2xl font-semibold mb-2">Omni-Model Router</h1>
      <p className="text-neutral-400 text-sm mb-8">Usage and savings</p>
      <Overview />
      <div className="mt-10 grid gap-8 md:grid-cols-2">
        <UsageChart />
        <ModelBreakdown />
      </div>
    </main>
  );
}
