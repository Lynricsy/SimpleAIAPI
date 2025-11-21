import { promises as fs } from 'fs';
import path from 'path';
import { nanoid } from 'nanoid';

const PUBLIC_DIR = path.resolve(process.cwd(), 'public');
const IMG_DIR = path.join(PUBLIC_DIR, 'img');
export const IMAGE_DIRECTORY = IMG_DIR;

const mimeToExtension: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/bmp': 'bmp',
  'image/svg+xml': 'svg',
};

const dataUriRegex = /^data:(?<mime>image\/[a-zA-Z0-9.+-]+);base64,(?<data>[A-Za-z0-9+/=\r\n]+)$/;

export const ensureImageDirectory = async (): Promise<void> => {
  await fs.mkdir(IMG_DIR, { recursive: true });
};

export const isDataUriImage = (value: string): boolean => dataUriRegex.test(value.trim());

export const saveDataUriImage = async (value: string): Promise<string> => {
  const match = value.trim().match(dataUriRegex);
  if (!match || !match.groups) {
    throw new Error('Invalid data URI');
  }
  const { mime, data } = match.groups as { mime: string; data: string };
  const cleanedData = data.replace(/\s+/g, '');
  const buffer = Buffer.from(cleanedData, 'base64');
  const extension = mimeToExtension[mime] ?? 'bin';
  const fileName = `${nanoid(12)}.${extension}`;
  const filePath = path.join(IMG_DIR, fileName);
  await fs.writeFile(filePath, buffer);
  return `/img/${fileName}`;
};
