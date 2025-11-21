import { promises as fs } from 'fs';
import path from 'path';
import { nanoid } from 'nanoid';

const PUBLIC_DIR = path.resolve(process.cwd(), 'public');
const PAGES_DIR = path.join(PUBLIC_DIR, 'pages');

export const ensurePagesDirectory = async (): Promise<void> => {
  await fs.mkdir(PAGES_DIR, { recursive: true });
};

type PageCategory = 'preview' | 'share';

const resolveCategoryDir = (category: PageCategory): string => path.join(PAGES_DIR, category);

export const savePageHtml = async (
  html: string,
  category: PageCategory,
  explicitFileName?: string,
): Promise<string> => {
  const dir = resolveCategoryDir(category);
  await fs.mkdir(dir, { recursive: true });
  const fileName = explicitFileName ?? `${Date.now()}-${nanoid(10)}.html`;
  const filePath = path.join(dir, fileName);
  await fs.writeFile(filePath, html, 'utf8');
  return `/pages/${category}/${fileName}`;
};
