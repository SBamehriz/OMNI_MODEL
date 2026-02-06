import type { Metadata } from 'next';
import Script from 'next/script';
import { loadLegacyHtml } from '@/lib/legacyHtml';

export const metadata: Metadata = {
  title: 'Dashboard — Omni Model Router',
  description: 'Omni Model Router dashboard with analytics, routing, and billing.',
};

const { styles, body, inlineScript } = loadLegacyHtml('dashboard.html');
const stylesWithRoot = `${styles}\n#legacy-root{display:contents;}`;

export default function DashboardPage() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: stylesWithRoot }} />
      <div id="legacy-root" dangerouslySetInnerHTML={{ __html: body }} />
      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"
        strategy="afterInteractive"
      />
      {inlineScript ? (
        <Script
          id="legacy-dashboard-inline"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{ __html: inlineScript }}
        />
      ) : null}
    </>
  );
}
