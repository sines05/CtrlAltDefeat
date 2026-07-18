import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import { createSceneAppHtml } from '../../apps/web/src/scene/app.js';

const repoRoot = new URL('../..', import.meta.url);

async function readJson(relativePath) {
  const absolutePath = path.join(repoRoot.pathname, relativePath);
  return JSON.parse(await readFile(absolutePath, 'utf8'));
}

async function loadSceneFixture() {
  const [source, tour, hotspot01, hotspot02, hotspot03, hotspot04, hotspot05] = await Promise.all([
    readJson('content/approved/sources/museum-room-01.json'),
    readJson('content/approved/tours/tour-01.json'),
    readJson('content/approved/chunks/hotspot-01.json'),
    readJson('content/approved/chunks/hotspot-02.json'),
    readJson('content/approved/chunks/hotspot-03.json'),
    readJson('content/approved/chunks/hotspot-04.json'),
    readJson('content/approved/chunks/hotspot-05.json'),
  ]);

  return {
    scene: {
      sceneId: source.sceneId,
      title: source.title,
      summary: source.summary,
      roomScope: source.roomScope,
      tourId: tour.tourId,
      hotspots: [hotspot01, hotspot02, hotspot03, hotspot04, hotspot05].map((hotspot, index) => ({
        hotspotId: hotspot.chunkId,
        title: hotspot.title,
        body: hotspot.text,
        citation: hotspot.citation,
        position: {
          x: 18 + index * 16,
          y: 28 + (index % 2) * 18,
        },
      })),
    },
    tour: {
      tourId: tour.tourId,
      title: tour.title,
      sceneId: tour.sceneId,
      steps: tour.steps,
    },
  };
}

test('test_hotspot_count_is_3_to_5', async () => {
  const { scene, tour } = await loadSceneFixture();
  const html = createSceneAppHtml({ scene, tour, hasWebGL: true });
  const hotspotCount = (html.match(/data-hotspot-id=/g) ?? []).length;

  assert.ok(hotspotCount >= 3 && hotspotCount <= 5);
});

test('test_2d_fallback_renders_without_webgl', async () => {
  const { scene, tour } = await loadSceneFixture();
  const html = createSceneAppHtml({ scene, tour, hasWebGL: false });

  assert.match(html, /data-mode="fallback"/);
  assert.match(html, /Chế độ suy giảm/);
  assert.match(html, /Danh sách hotspot/);
  assert.match(html, new RegExp(scene.title));
});

test('test_fallback_shows_tour_text_and_citations', async () => {
  const { scene, tour } = await loadSceneFixture();
  const html = createSceneAppHtml({ scene, tour, hasWebGL: false });

  assert.match(html, new RegExp(tour.steps[0].body));
  assert.match(html, new RegExp(tour.steps[4].body));
  assert.match(html, /Nguồn:/);
  assert.match(html, /hotspot-01/);
  assert.match(html, /hotspot-05/);
});
