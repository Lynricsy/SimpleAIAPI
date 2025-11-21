import { promises as fs } from 'fs';
import path from 'path';

const katexCssPath = require.resolve('katex/dist/katex.min.css');
const katexDistDir = path.dirname(katexCssPath);
const fontsSourceDir = path.join(katexDistDir, 'fonts');
const fontsTargetDir = path.join(process.cwd(), 'public', 'pages', 'fonts');

export const ensureKatexFonts = async (): Promise<void> => {
  await fs.mkdir(fontsTargetDir, { recursive: true });
  const files = await fs.readdir(fontsSourceDir);
  await Promise.all(
    files.map(async (file) => {
      const src = path.join(fontsSourceDir, file);
      const dest = path.join(fontsTargetDir, file);
      try {
        await fs.copyFile(src, dest);
      } catch (error) {
        // 忽略已有文件或其他瞬时错误
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
          throw error;
        }
      }
    }),
  );
};
