import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'About — Omni Model Router',
  description:
    'Omni Model Router is building the operating system for AI with one API for every model.',
};

export default function AboutPage() {
  return (
    <main className="min-h-screen grid-lines">
      <div className="noise" />

      <div className="max-w-4xl mx-auto px-6 pt-28 pb-24">
        <section className="reveal">
          <p className="mono text-xs ink-accent tracking-widest uppercase">About</p>
          <h1 className="headline text-5xl font-bold mt-4">The most efficient API for AI</h1>
          <p className="mt-6 text-lg ink-muted max-w-2xl">
            Omni Model Router sits between your application and the AI ecosystem. One endpoint,
            automatic model selection, best results for the best price.
          </p>
        </section>

        <section className="mt-16 space-y-10">
          <div className="panel rounded-2xl p-8 reveal">
            <h2 className="headline text-2xl font-semibold">The Problem</h2>
            <p className="ink-muted mt-3">
              The AI ecosystem is fragmented. Many models exist — some best for coding, others for
              reasoning, others for fast chat — each with different pricing, latency, and strengths.
              Using one premium model for everything wastes money. Managing multiple providers adds
              operational complexity. Staying updated as new models ship is hard.
            </p>
          </div>

          <div className="panel rounded-2xl p-8 reveal">
            <h2 className="headline text-2xl font-semibold">The Solution</h2>
            <ul className="mt-3 space-y-3 ink-muted">
              <li><strong className="text-[var(--ink)]">Universal API gateway</strong> — One endpoint for all request types; provider differences are abstracted.</li>
              <li><strong className="text-[var(--ink)]">Task detection</strong> — Each request is analyzed (coding, reasoning, summarization, etc.) so the right model is chosen.</li>
              <li><strong className="text-[var(--ink)]">Cost optimizer</strong> — Routing considers cost, latency, and task fit to minimize spend.</li>
              <li><strong className="text-[var(--ink)]">Automatic fallback</strong> — If a model fails, the system switches to an alternative for reliability.</li>
              <li><strong className="text-[var(--ink)]">Analytics</strong> — Full visibility into usage, cost, and savings.</li>
            </ul>
          </div>

          <div className="panel rounded-2xl p-8 reveal">
            <h2 className="headline text-2xl font-semibold">Supported Providers</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-4">
              {['OpenAI', 'Anthropic', 'Google', 'Groq', 'OpenRouter'].map((p) => (
                <div key={p} className="chip rounded-xl px-4 py-3 text-center">
                  <p className="headline font-medium">{p}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="mt-16 text-center reveal">
          <Link
            href="/dashboard"
            className="inline-block px-8 py-3 rounded-xl font-medium text-white"
            style={{ background: 'var(--accent)' }}
          >
            Open Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
