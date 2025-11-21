import { promises as fs } from 'fs';
import path from 'path';

const DATA_ROOT = path.resolve(process.cwd(), 'data');
const STORE_PATH = path.join(DATA_ROOT, 'protected-images.json');

let initialized = false;
let protectedSet = new Set<string>();

const persist = async (): Promise<void> => {
  const payload = JSON.stringify(Array.from(protectedSet), null, 2);
  await fs.writeFile(STORE_PATH, payload, 'utf8');
};

export const initProtectedImagesStore = async (): Promise<void> => {
  if (initialized) {
    return;
  }
  await fs.mkdir(DATA_ROOT, { recursive: true });
  try {
    const content = await fs.readFile(STORE_PATH, 'utf8');
    const parsed = JSON.parse(content) as string[];
    protectedSet = new Set(parsed);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
    protectedSet = new Set();
  }
  initialized = true;
};

const normalizeImageName = (input: string): string | null => {
  if (!input) {
    return null;
  }
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return null;
  }
  const parts = trimmed.split('/');
  const result = parts[parts.length - 1];
  return result ?? null;
};

export const markImagesProtected = async (paths: string[]): Promise<void> => {
  if (!initialized) {
    await initProtectedImagesStore();
  }
  let changed = false;
  for (const raw of paths) {
    const name = normalizeImageName(raw);
    if (!name) {
      continue;
    }
    if (!protectedSet.has(name)) {
      protectedSet.add(name);
      changed = true;
    }
  }
  if (changed) {
    await persist();
  }
};

export const isImageProtected = (fileName: string): boolean => protectedSet.has(fileName);
