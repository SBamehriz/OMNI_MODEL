import type { Metadata } from 'next';
import { LegacyPage } from '@/components/LegacyPage';

export const metadata: Metadata = {
  title: 'Omni Model Router — One API. Every AI Model.',
  description:
    'The universal AI routing API. One integration, every model, optimal performance.',
};

const scripts = [
  'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollToPlugin.min.js',
];

export default function Page() {
  return (
    <LegacyPage filename="index.html" inlineScriptId="legacy-index-inline" scripts={scripts} />
  );
}
