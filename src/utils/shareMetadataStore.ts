import { promises as fs } from 'fs';
import path from 'path';

const DATA_ROOT = path.resolve(process.cwd(), 'data');
const SHARE_META_DIR = path.join(DATA_ROOT, 'share-meta');

export const ensureShareMetadataDirectory = async (): Promise<void> => {
  await fs.mkdir(SHARE_META_DIR, { recursive: true });
};

export interface ShareMetadata {
  shareId: string;
  htmlRelativePath: string;
  imageFiles: string[];
}

const resolveMetaPath = (shareId: string): string => path.join(SHARE_META_DIR, `${shareId}.json`);

export const saveShareMetadata = async (metadata: ShareMetadata): Promise<void> => {
  const filePath = resolveMetaPath(metadata.shareId);
  await fs.writeFile(filePath, JSON.stringify(metadata, null, 2), 'utf8');
};

export const readShareMetadata = async (shareId: string): Promise<ShareMetadata | null> => {
  try {
    const content = await fs.readFile(resolveMetaPath(shareId), 'utf8');
    return JSON.parse(content) as ShareMetadata;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
};
