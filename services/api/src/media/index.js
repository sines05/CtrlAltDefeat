import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const contentRoot = resolve(process.cwd(), 'content/approved');
const manifestPath = resolve(contentRoot, 'media/tay-ho-giay-do-room-01.json');

export async function getMediaManifest(sceneId) {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

  if (manifest.sceneId !== sceneId) {
    return null;
  }

  return manifest;
}
