import fs from 'fs';
import path from 'path';

type LegacyHtml = {
  styles: string;
  body: string;
  inlineScript: string;
};

const resolveLegacyPath = (filename: string) => {
  const candidates = [
    path.resolve(process.cwd(), 'apps', 'dashboard', 'legacy-html', filename),
    path.resolve(process.cwd(), 'legacy-html', filename),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return candidates[0];
};

export const loadLegacyHtml = (filename: string): LegacyHtml => {
  const filePath = resolveLegacyPath(filename);
  const html = fs.readFileSync(filePath, 'utf8');

  const styleMatch = html.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  const styles = styleMatch ? styleMatch[1].trim() : '';

  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  let body = bodyMatch ? bodyMatch[1].trim() : html;
  body = body.replace(/<script[\s\S]*?<\/script>/gi, '').trim();

  const inlineScripts = Array.from(html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi))
    .map((match) => match[1].trim())
    .filter(Boolean);

  return {
    styles,
    body,
    inlineScript: inlineScripts[inlineScripts.length - 1] ?? '',
  };
};
