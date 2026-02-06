import Script from 'next/script';
import { loadLegacyHtml } from '@/lib/legacyHtml';

type LegacyPageProps = {
  filename: string;
  inlineScriptId: string;
  scripts?: string[];
};

export function LegacyPage({ filename, inlineScriptId, scripts = [] }: LegacyPageProps) {
  const { styles, body, inlineScript } = loadLegacyHtml(filename);
  const stylesWithRoot = `${styles}\n#legacy-root{display:contents;}`;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: stylesWithRoot }} />
      <div id="legacy-root" dangerouslySetInnerHTML={{ __html: body }} />
      {scripts.map((src) => (
        <Script key={src} src={src} strategy="afterInteractive" />
      ))}
      {inlineScript ? (
        <Script
          id={inlineScriptId}
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{ __html: inlineScript }}
        />
      ) : null}
    </>
  );
}
