import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const contentRoot = resolve(process.cwd(), 'content/approved');

async function readJson(...segments) {
  return JSON.parse(await readFile(resolve(contentRoot, ...segments), 'utf8'));
}

export async function getTourConfig(tourId) {
  const tour = await readJson('tours/tour-01.json');

  if (tour.tourId !== tourId) {
    return null;
  }

  return {
    tourId: tour.tourId,
    sceneId: tour.sceneId,
    title: tour.title,
    status: tour.status,
    steps: tour.steps,
  };
}
