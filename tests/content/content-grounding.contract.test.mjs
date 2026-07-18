import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const sceneId = 'tay-ho-giay-do-room-01';
const sourceId = 'museum-room-01';

async function readJson(relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);
  const contents = await readFile(absolutePath, 'utf8');
  return JSON.parse(contents);
}

async function readJsonDirectory(relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);
  const entries = await readdir(absolutePath, { withFileTypes: true });
  const jsonFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => entry.name)
    .sort();

  return Promise.all(
    jsonFiles.map(async (fileName) => ({
      fileName,
      payload: await readJson(path.join(relativePath, fileName)),
    })),
  );
}

function assertGroundedProvenance(record) {
  assert.equal(record.provenance.canonicalTextFile, 'nghien-cuu-ve-giay-do.txt');
  assert.match(record.provenance.sourcePdfTitle, /Nghiên Cứu Về Giấy Dó/);
  assert.match(record.provenance.note, /grounded|cross-checked/i);
}

test('test_seed_sources_have_status', async () => {
  const [{ payload: source }] = await readJsonDirectory('content/approved/sources');

  assert.equal(source.sourceId, sourceId);
  assert.equal(source.sceneId, sceneId);
  assert.equal(source.roomScope, 'single-room');
  assert.ok(['provisional', 'approved'].includes(source.status));
  assertGroundedProvenance(source);
  assert.ok(Array.isArray(source.provenance.sectionScope));
  assert.ok(source.provenance.sectionScope.length >= 3);
});

test('test_approved_content_has_explicit_signoff', async () => {
  const signoff = await readJson('content/approved/signoffs/museum-room-01.json');
  const chunkEntries = await readJsonDirectory('content/approved/chunks');
  const chunkIds = new Set(chunkEntries.map(({ payload }) => payload.chunkId));

  assert.equal(signoff.status, 'provisional-signoff');
  assert.equal(signoff.sceneId, sceneId);
  assert.deepEqual(signoff.reviewScope.sourceIds, [sourceId]);
  assert.equal(signoff.reviewScope.chunkIds.length, 5);
  assert.ok(signoff.reviewScope.chunkIds.every((chunkId) => chunkIds.has(chunkId)));
  assert.deepEqual(signoff.reviewScope.tourIds, ['tour-01']);
  assert.deepEqual(signoff.reviewScope.ttsIds, ['intro-01']);
  assert.ok(signoff.notes.some((note) => /grounded|cross-checked/i.test(note)));
});

test('test_chunks_have_source_and_citation', async () => {
  const chunks = await readJsonDirectory('content/approved/chunks');

  assert.equal(chunks.length, 5);

  for (const { fileName, payload } of chunks) {
    assert.match(fileName, /^hotspot-\d+\.json$/);
    assert.equal(payload.chunkId, fileName.replace('.json', ''));
    assert.equal(payload.sceneId, sceneId);
    assert.equal(payload.sourceId, sourceId);
    assert.equal(typeof payload.text, 'string');
    assert.ok(payload.text.length > 0);
    assert.equal(typeof payload.citation, 'string');
    assert.ok(payload.citation.length > 0);
    assert.ok(Array.isArray(payload.keywords));
    assert.ok(payload.keywords.length >= 3);
    assert.ok(['provisional', 'approved'].includes(payload.status));
    assertGroundedProvenance(payload);
    assert.equal(typeof payload.provenance.txtLineRange, 'string');
    assert.equal(typeof payload.provenance.pdfPageRange, 'string');
  }
});

test('test_tour_steps_reference_chunks', async () => {
  const tour = await readJson('content/approved/tours/tour-01.json');
  const chunkEntries = await readJsonDirectory('content/approved/chunks');
  const chunkIds = new Set(chunkEntries.map(({ payload }) => payload.chunkId));

  assert.equal(tour.tourId, 'tour-01');
  assert.equal(tour.sceneId, sceneId);
  assert.ok(['provisional', 'approved'].includes(tour.status));
  assertGroundedProvenance(tour);
  assert.equal(tour.steps.length, 5);

  for (const step of tour.steps) {
    assert.equal(step.sceneId, sceneId);
    assert.equal(typeof step.body, 'string');
    assert.ok(step.body.length > 0);
    assert.equal(typeof step.ttsText, 'string');
    assert.ok(step.ttsText.length > 0);
    assert.ok(Array.isArray(step.citations));
    assert.ok(step.citations.length >= 1);

    for (const chunkId of step.citations) {
      assert.ok(chunkIds.has(chunkId));
    }
  }
});

test('test_qa_examples_have_expected_sources', async () => {
  const qaExamples = await readJsonDirectory('content/approved/qa-examples');
  const chunkEntries = await readJsonDirectory('content/approved/chunks');
  const chunkIds = new Set(chunkEntries.map(({ payload }) => payload.chunkId));

  assert.equal(qaExamples.length, 4);

  for (const { payload } of qaExamples) {
    assert.equal(payload.sceneId, sceneId);
    assert.equal(typeof payload.question, 'string');
    assert.ok(payload.question.length > 0);
    assert.ok(Array.isArray(payload.expectedAnswerHints));
    assert.ok(payload.expectedAnswerHints.length >= 2);
    assert.deepEqual(payload.sourceIds, [sourceId]);
    assert.ok(Array.isArray(payload.citations));
    assert.ok(payload.citations.length >= 1);
    assert.ok(payload.citations.every((chunkId) => chunkIds.has(chunkId)));
    assert.ok(['provisional', 'approved'].includes(payload.status));
    assertGroundedProvenance(payload);
  }
});

test('test_tts_script_references_shipped_text', async () => {
  const tts = await readJson('content/approved/tts/intro-01.json');
  const tour = await readJson('content/approved/tours/tour-01.json');
  const sourceStep = tour.steps.find((step) => step.stepId === tts.sourceStepId);

  assert.equal(tts.sceneId, sceneId);
  assert.equal(tts.sourceStepId, 'step-01');
  assert.ok(sourceStep);
  assert.equal(typeof tts.text, 'string');
  assert.ok(tts.text.length > 0);
  assert.equal(tts.text, sourceStep.ttsText);
  assert.deepEqual(tts.sourceIds, [sourceId]);
  assert.ok(Array.isArray(tts.citations));
  assert.ok(tts.citations.length >= 1);
  assert.deepEqual(tts.citations, sourceStep.citations);
  assert.ok(['provisional', 'approved'].includes(tts.status));
  assertGroundedProvenance(tts);
});
