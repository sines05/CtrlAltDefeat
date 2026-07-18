import assert from 'node:assert/strict';
import test from 'node:test';

import { answerQuestion, resolveGroundingContext } from '../../../services/api/src/qa/index.js';
import { startServer } from '../../../services/api/src/server.js';

async function postJson(runtime, pathname, body) {
  const response = await fetch(`${runtime.baseUrl}${pathname}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  return {
    status: response.status,
    payload: await response.json(),
  };
}

test('test_qa_known_question_returns_citation', async (t) => {
  const runtime = await startServer({ host: '127.0.0.1', port: 0 });

  t.after(async () => {
    await runtime.stop();
  });

  const { status, payload } = await postJson(runtime, '/api/qa', {
    sceneId: 'tay-ho-giay-do-room-01',
    question: 'Cây dó được dùng để làm giấy vì đặc tính gì?',
  });

  assert.equal(status, 200);
  assert.equal(payload.abstained, false);
  assert.equal(typeof payload.answer, 'string');
  assert.ok(payload.answer.length > 0);
  assert.ok(Array.isArray(payload.citations));
  assert.ok(payload.citations.length >= 1);
  assert.equal(payload.citations[0].ref, 'content/approved/chunks/hotspot-01.json');
  assert.equal(typeof payload.traceId, 'string');
});

test('test_qa_paraphrased_question_uses_relevant_chunk', async (t) => {
  const runtime = await startServer({ host: '127.0.0.1', port: 0 });

  t.after(async () => {
    await runtime.stop();
  });

  const { status, payload } = await postJson(runtime, '/api/qa', {
    sceneId: 'tay-ho-giay-do-room-01',
    question: 'Mò giúp bể xeo giữ nước và dàn sợi như thế nào?',
  });

  assert.equal(status, 200);
  assert.equal(payload.abstained, false);
  assert.ok(payload.citations.some((citation) => citation.ref === 'content/approved/chunks/hotspot-03.json'));
  assert.match(payload.answer, /mò|chất nhầy|thoát nước/i);
});

test('test_qa_grounding_context_matches_rest_citations', async () => {
  const grounding = await resolveGroundingContext({
    sceneId: 'tay-ho-giay-do-room-01',
    question: 'Cây dó được dùng để làm giấy vì đặc tính gì?',
  });

  assert.equal(grounding.question, 'Cây dó được dùng để làm giấy vì đặc tính gì?');
  assert.equal(grounding.selectedChunks[0]?.chunkId, 'hotspot-01');
  assert.equal(grounding.citations[0]?.ref, 'content/approved/chunks/hotspot-01.json');
});

test('test_qa_conversation_uses_natural_uncited_policy', async () => {
  const grounding = await resolveGroundingContext({
    sceneId: 'tay-ho-giay-do-room-01',
    question: 'xin chào',
  });
  const packet = await answerQuestion({
    sceneId: 'tay-ho-giay-do-room-01',
    question: 'xin chào',
  });

  assert.equal(grounding.policy, 'conversation');
  assert.deepEqual(grounding.citations, []);
  assert.equal(packet.abstained, false);
  assert.deepEqual(packet.citations, []);
  assert.ok(packet.answer.length > 0);
  assert.ok(packet.answer.length <= 240);
});

test('test_qa_room_overview_uses_all_approved_chunks', async () => {
  const grounding = await resolveGroundingContext({
    sceneId: 'tay-ho-giay-do-room-01',
    question: 'Quy trình làm giấy dó như thế nào?',
  });

  assert.equal(grounding.policy, 'overview');
  assert.equal(grounding.selectedChunks.length, 5);
  assert.equal(grounding.citations.length, 5);
  assert.equal(grounding.citations[0]?.ref, 'content/approved/chunks/hotspot-01.json');
});

test('test_qa_unknown_question_returns_boundary_without_fake_citations', async () => {
  const packet = await answerQuestion({
    sceneId: 'tay-ho-giay-do-room-01',
    question: 'Bảo tàng này mở cửa đến mấy giờ tối?',
  });

  assert.equal(packet.abstained, false);
  assert.equal(packet.confidence, 'low');
  assert.deepEqual(packet.citations, []);
  assert.match(packet.answer, /tư liệu|phòng trưng bày/i);
  assert.doesNotMatch(packet.answer, /\b\d{1,2}[:h]\d{0,2}\b/i);
  assert.ok(packet.answer.length <= 240);
});
