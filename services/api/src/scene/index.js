import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const contentRoot = resolve(process.cwd(), 'content/approved');
const hotspotPositions = [
  { x: 18, y: 28 },
  { x: 34, y: 18 },
  { x: 52, y: 34 },
  { x: 68, y: 22 },
  { x: 80, y: 40 },
];

async function readJson(...segments) {
  return JSON.parse(await readFile(resolve(contentRoot, ...segments), 'utf8'));
}

export async function getSceneConfig(sceneId) {
  const source = await readJson('sources/museum-room-01.json');

  if (source.sceneId !== sceneId) {
    return null;
  }

  const [signoff, tour] = await Promise.all([
    readJson('signoffs/museum-room-01.json'),
    readJson('tours/tour-01.json'),
  ]);
  const hotspots = await Promise.all(
    signoff.reviewScope.chunkIds.map(async (hotspotId, index) => {
      const hotspot = await readJson('chunks', `${hotspotId}.json`);

      return {
        hotspotId,
        title: hotspot.title,
        body: hotspot.text,
        citation: hotspot.citation,
        position: hotspotPositions[index] ?? { x: 50, y: 50 },
      };
    }),
  );

  return {
    sceneId: source.sceneId,
    title: source.title,
    summary: source.summary,
    roomScope: source.roomScope,
    entryMode: 'qr',
    fallbackMode: 'viewer',
    assets: [],
    tourId: tour.tourId,
    hotspots,
  };
}
