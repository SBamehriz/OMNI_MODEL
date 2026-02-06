import type { Metadata } from 'next';
import Script from 'next/script';
import { loadLegacyHtml } from '@/lib/legacyHtml';

export const metadata: Metadata = {
  title: 'About — Omni Model Router',
  description:
    'Omni Model Router is building the operating system for AI with one API for every model.',
};

const { styles, body, inlineScript } = loadLegacyHtml('about.html');
const stylesWithRoot = `${styles}\n#legacy-root{display:contents;}`;

export default function AboutPage() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: stylesWithRoot }} />
      <div id="legacy-root" dangerouslySetInnerHTML={{ __html: body }} />
      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"
        strategy="afterInteractive"
      />
      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js"
        strategy="afterInteractive"
      />
      {inlineScript ? (
        <Script
          id="legacy-about-inline"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{ __html: inlineScript }}
        />
      ) : null}
    </>
  );
}
