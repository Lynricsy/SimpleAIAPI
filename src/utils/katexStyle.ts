import { readFileSync } from 'fs';

let cachedStyleTag: string | null = null;

export const getKatexStyleTag = (): string => {
  if (cachedStyleTag) {
    return cachedStyleTag;
  }
  const cssPath = require.resolve('katex/dist/katex.min.css');
  const cssContent = readFileSync(cssPath, 'utf8');
  const patchedCss = cssContent.replace(/url\((['"]?)(fonts\/[^")]+)\1\)/g, (_match, quote = '', assetPath) => {
    const normalized = assetPath.startsWith('/') ? assetPath : `/${assetPath}`;
    return `url(${quote}/pages${normalized}${quote})`;
  });
  cachedStyleTag = `<style>${patchedCss}</style>`;
  return cachedStyleTag;
};
