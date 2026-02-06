import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Omni Model Router — One API. Every AI Model.',
  description:
    'The universal AI routing API. One integration, every model, optimal performance.',
};

export default function Page() {
  return (
    <main className="min-h-screen grid-lines">
      <div className="noise" />

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-28 pb-20 reveal">
        <p className="mono text-xs ink-accent tracking-widest uppercase">Omni Model Router</p>
        <h1 className="headline text-5xl sm:text-6xl font-bold mt-4 leading-tight">
          One API.<br />Every AI model.
        </h1>
        <p className="mt-6 text-lg ink-muted max-w-2xl">
          The most efficient API for AI. One endpoint routes every request to the best model by
          cost, latency, and task type — no manual switching, no overpaying.
        </p>
        <div className="flex gap-4 mt-10">
          <Link
            href="/dashboard"
            className="px-6 py-3 rounded-xl font-medium text-white"
            style={{ background: 'var(--accent)' }}
          >
            Open Dashboard
          </Link>
          <Link
            href="/about"
            className="px-6 py-3 rounded-xl font-medium chip"
          >
            Learn More
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            {
              title: 'Smart Routing',
              desc: 'Automatically selects the best model per request based on task type, cost preference, and latency targets.',
            },
            {
              title: 'Cost Savings',
              desc: 'Routes simple tasks to cheaper models so you never overpay. Track savings in real time.',
            },
            {
              title: 'Multi-Provider',
              desc: 'OpenAI, Anthropic, Groq, Google, and OpenRouter — one integration point, zero lock-in.',
            },
            {
              title: 'Automatic Fallback',
              desc: 'If a model fails or is rate-limited, the router retries with a backup automatically.',
            },
            {
              title: 'Analytics Dashboard',
              desc: 'See usage, cost breakdown by model, and estimated savings at a glance.',
            },
            {
              title: 'Agent-Ready',
              desc: 'Dedicated /v1/agent-step endpoint routes each workflow step by complexity and budget.',
            },
          ].map((f) => (
            <div key={f.title} className="panel rounded-2xl p-6 reveal">
              <h3 className="headline text-lg font-semibold">{f.title}</h3>
              <p className="ink-muted text-sm mt-2">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-5xl mx-auto px-6 pb-28 text-center reveal">
        <h2 className="headline text-3xl font-semibold">Ready to route smarter?</h2>
        <p className="ink-muted mt-4 max-w-lg mx-auto">
          Point your app at a single endpoint and let the router handle model selection, fallback,
          and cost optimization.
        </p>
        <div className="mt-8 panel rounded-2xl p-6 max-w-xl mx-auto text-left">
          <p className="mono text-xs ink-muted mb-3">Quick start</p>
          <pre className="mono text-sm overflow-x-auto">
{`curl -X POST https://your-api/v1/chat \\
  -H "Authorization: Bearer YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"messages":[{"role":"user","content":"Hello"}]}'`}
          </pre>
        </div>
      </section>
    </main>
  );
}
