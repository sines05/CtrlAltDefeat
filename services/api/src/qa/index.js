/**
 * @file index.js (QA)
 * @description Strict grounding and anti-hallucination routing engine.
 * 
 * DATA PROVENANCE & ANTI-HALLUCINATION ROUTING ARCHITECTURE:
 * - Factual Integrity in Cultural Preservation: Generative LLM hallucination presents a significant threat to 
 *   cultural and historical digitizing platforms. Dó.AI implements a strict retrieval-augmented generation (RAG) 
 *   routing system to prevent the synthesis of speculative or unverified claims.
 * - Academic Grounding & Provenance: The tri-structured triaged knowledge chunks are curated and cross-verified 
 *   from licensed scientific literature, primarily the peer-reviewed research paper "Nghiên Cứu Về Giấy Dó / 
 *   Việt Nam's Paper Plants: Dó" authored by international experts: James Ojascastro (US), Veronica Y Pham (US), 
 *   Tran Hong Nhung (VN), and Robie Hart (US).
 * - Safe Boundary Policy Router: The engine classifies user inputs dynamically into distinct policy states (conversation, 
 *   overview, grounded, boundary) based on keyword mapping and token-overlap thresholds. Queries falling outside the 
 *   academic grounding domain trigger a natural 'Boundary' redirect. Rather than producing unverified facts (such as 
 *   invented open hours or fictional tools), the guide politely directs visitors back to the verified exhibit steps.
 */

import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { generateGeminiGroundedAnswer, generateLocalGroundedAnswer } from '../providers/gemini-chat.js';

const contentRoot = resolve(process.cwd(), 'content/approved');
const allowedSourceStatuses = new Set(['provisional', 'approved']);
const allowedSignoffStatuses = new Set(['provisional-signoff', 'approved-signoff']);
const stopwords = new Set([
  'la',
  'va',
  'va?',
  'cua',
  'của',
  'cho',
  'voi',
  'với',
  'duoc',
  'được',
  'the',
  'thế',
  'nao',
  'nào',
  'gi',
  'gì',
  'tai',
  'tại',
  'sau',
  'truoc',
  'trước',
  'trong',
  'ngoai',
  'ngoài',
  'mot',
  'một',
  'nhung',
  'nhưng',
  'khi',
  'ban',
  'bản',
  'phong',
  'phòng',
  'nay',
  'này',
  'do',
  'dó',
  'giay',
  'giấy',
  'sao',
  'lam',
  'dung',
  'phai',
  'giup',
  'bao',
  'tang',
  'gio',
  'toi',
  'mo',
]);

async function readJson(...segments) {
  return JSON.parse(await readFile(resolve(contentRoot, ...segments), 'utf8'));
}

async function readJsonDirectory(...segments) {
  const directory = resolve(contentRoot, ...segments);
  const entries = await readdir(directory, { withFileTypes: true });
  const jsonFiles = entries.filter((entry) => entry.isFile() && entry.name.endsWith('.json'));

  return Promise.all(jsonFiles.map((entry) => readJson(...segments, entry.name)));
}

function canonicalizeText(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeText(value) {
  return canonicalizeText(value)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

function tokenize(value) {
  return normalizeText(value)
    .split(' ')
    .filter((token) => token.length > 2 && !stopwords.has(token));
}

function ensureSourceApproved(record) {
  return allowedSourceStatuses.has(record.status);
}

function ensureSignoffApproved(record) {
  return allowedSignoffStatuses.has(record.status);
}

function scoreChunk(rawQuestionText, questionText, questionTokens, chunk) {
  const searchableText = normalizeText([
    chunk.title,
    chunk.topic,
    chunk.keywords?.join(' '),
    chunk.text,
  ].filter(Boolean).join(' '));
  const searchableTokens = new Set(tokenize(searchableText));

  let score = 0;

  for (const token of questionTokens) {
    if (searchableTokens.has(token)) {
      score += 1;
    }
  }

  const questionTokenSet = new Set(questionTokens);
  const canonicalQuestionText = canonicalizeText(rawQuestionText);

  for (const keyword of chunk.keywords ?? []) {
    const canonicalKeyword = canonicalizeText(keyword);
    const keywordTokens = tokenize(keyword);

    if (canonicalKeyword && canonicalQuestionText.includes(canonicalKeyword)) {
      score += 4;
      continue;
    }

    if (keywordTokens.length && keywordTokens.every((token) => questionTokenSet.has(token))) {
      score += keywordTokens.length > 1 ? 3 : 2;
    }
  }

  const normalizedTitle = normalizeText(chunk.title);
  if (normalizedTitle && questionText.includes(normalizedTitle)) {
    score += 4;
  }

  const normalizedTopic = normalizeText(chunk.topic ?? '');
  if (normalizedTopic && questionText.includes(normalizedTopic)) {
    score += 2;
  }

  return score;
}

function selectChunks(question, chunks, limit = 3) {
  const questionText = normalizeText(question);
  const questionTokens = tokenize(questionText);
  const ranked = chunks
    .map((chunk) => ({
      chunk,
      score: scoreChunk(question, questionText, questionTokens, chunk),
    }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score || left.chunk.chunkId.localeCompare(right.chunk.chunkId));

  if (!ranked.length) {
    return [];
  }

  const topScore = ranked[0].score;
  const minimumScore = Math.max(2, topScore - 1);

  return ranked
    .filter(({ score }) => score >= minimumScore)
    .slice(0, limit)
    .map(({ chunk }) => chunk);
}

function buildCitations(chunks) {
  return chunks.map((chunk) => ({
    label: chunk.citation,
    ref: `content/approved/chunks/${chunk.chunkId}.json`,
    sourceId: chunk.sourceId,
  }));
}

function classifyAnswerPolicy(question, selectedChunks) {
  const normalized = normalizeText(question);

  if (/\b(xin chao|chao ban|hello|hi|cam on|ban co the giup gi|ban la ai)\b/u.test(normalized)) {
    return 'conversation';
  }

  if (/\b(quy trinh|tong quan|gioi thieu phong|lam giay do nhu the nao)\b/u.test(normalized)) {
    return 'overview';
  }

  return selectedChunks.length ? 'grounded' : 'boundary';
}

function buildAbstainedPacket({ traceId, reason, confidence = 'low' }) {
  return {
    answer: '',
    citations: [],
    confidence,
    abstained: true,
    abstainReason: reason,
    traceId,
  };
}

export async function resolveGroundingContext({ sceneId, question, traceId = randomUUID() }) {
  // This seam keeps the product honest: voice, text, and local fallback all meet the same
  // approved-content boundary before they can speak for the exhibit.
  const normalizedQuestion = String(question ?? '').trim();

  if (!normalizedQuestion) {
    return {
      traceId,
      question: normalizedQuestion,
      source: null,
      signoff: null,
      approvedChunks: [],
      selectedChunks: [],
      citations: [],
      exactExample: null,
      policy: 'invalid',
      abort: buildAbstainedPacket({ traceId, reason: 'Question is required.' }),
    };
  }

  const [source, signoff, qaExamples] = await Promise.all([
    readJson('sources', 'museum-room-01.json'),
    readJson('signoffs', 'museum-room-01.json'),
    readJsonDirectory('qa-examples'),
  ]);

  if (source.sceneId !== sceneId || !ensureSourceApproved(source) || !ensureSignoffApproved(signoff)) {
    return {
      traceId,
      question: normalizedQuestion,
      source,
      signoff,
      approvedChunks: [],
      selectedChunks: [],
      citations: [],
      exactExample: null,
      policy: 'invalid',
      abort: buildAbstainedPacket({
        traceId,
        reason: 'No approved evidence for that scene in the current seed corpus.',
      }),
    };
  }

  const chunkEntries = await Promise.all(
    signoff.reviewScope.chunkIds.map((chunkId) => readJson('chunks', `${chunkId}.json`)),
  );
  const approvedChunks = chunkEntries.filter(ensureSourceApproved);

  if (!approvedChunks.length) {
    return {
      traceId,
      question: normalizedQuestion,
      source,
      signoff,
      approvedChunks,
      selectedChunks: [],
      citations: [],
      exactExample: null,
      policy: 'invalid',
      abort: buildAbstainedPacket({
        traceId,
        reason: 'No approved evidence for that question in the current seed corpus.',
      }),
    };
  }

  const matchedChunks = selectChunks(normalizedQuestion, approvedChunks);
  const policy = classifyAnswerPolicy(normalizedQuestion, matchedChunks);
  const selectedChunks = policy === 'overview'
    ? approvedChunks
    : policy === 'conversation' || policy === 'boundary'
      ? []
      : matchedChunks;
  const exactExample = qaExamples.find(
    (item) => item.sceneId === sceneId && normalizeText(item.question) === normalizeText(normalizedQuestion),
  );

  return {
    traceId,
    question: normalizedQuestion,
    source,
    signoff,
    approvedChunks,
    selectedChunks,
    citations: buildCitations(selectedChunks),
    exactExample,
    policy,
  };
}

export async function answerQuestion({ sceneId, question, language = 'vi' }) {
  const grounding = await resolveGroundingContext({ sceneId, question });

  if (grounding.abort) {
    return grounding.abort;
  }

  let groundedAnswer;

  try {
    groundedAnswer = await generateGeminiGroundedAnswer({
      sceneTitle: grounding.source.title,
      sceneSummary: grounding.source.summary,
      question: grounding.exactExample?.question ?? grounding.question,
      chunks: grounding.selectedChunks,
      policy: grounding.policy,
      language,
    });
  } catch {
    groundedAnswer = generateLocalGroundedAnswer({
      chunks: grounding.selectedChunks,
      policy: grounding.policy,
      language,
    });
  }

  if (groundedAnswer.abstained) {
    return buildAbstainedPacket({
      traceId: grounding.traceId,
      reason: groundedAnswer.abstainReason ?? 'No approved evidence for that question in the current seed corpus.',
      confidence: groundedAnswer.confidence ?? 'low',
    });
  }

  return {
    answer: groundedAnswer.answer,
    citations: grounding.citations,
    confidence: ['conversation', 'boundary'].includes(grounding.policy)
      ? 'low'
      : groundedAnswer.confidence ?? (grounding.selectedChunks.length > 1 ? 'medium' : 'high'),
    abstained: false,
    abstainReason: null,
    traceId: grounding.traceId,
  };
}
