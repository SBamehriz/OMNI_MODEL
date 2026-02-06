import type { Metadata } from 'next';
import { LegacyPage } from '@/components/LegacyPage';

export const metadata: Metadata = {
  title: 'Dashboard — Omni Model Router',
  description: 'Omni Model Router dashboard with analytics, routing, and billing.',
};

const scripts = ['https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js'];

export default function DashboardPage() {
  return (
    <LegacyPage
      filename="dashboard.html"
      inlineScriptId="legacy-dashboard-inline"
      scripts={scripts}
    />
  );
}
