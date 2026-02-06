import type { Metadata } from 'next';
import { LegacyPage } from '@/components/LegacyPage';

export const metadata: Metadata = {
  title: 'About — Omni Model Router',
  description:
    'Omni Model Router is building the operating system for AI with one API for every model.',
};

const scripts = [
  'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js',
];

export default function AboutPage() {
  return (
    <LegacyPage filename="about.html" inlineScriptId="legacy-about-inline" scripts={scripts} />
  );
}
