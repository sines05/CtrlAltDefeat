const GEMINI_MODEL = 'gemini-3.1-flash-lite';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    answer: { type: 'string' },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
    abstained: { type: 'boolean' },
    abstainReason: {
      anyOf: [
        { type: 'string' },
        { type: 'null' },
      ],
    },
  },
  required: ['answer', 'confidence', 'abstained', 'abstainReason'],
};

function splitKeys(value) {
  return String(value ?? '')
    .split(/[\n,]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function getApiKeys() {
  return [...new Set([
    ...splitKeys(process.env.GEMINI_API_KEYS),
    ...splitKeys(process.env.GEMINI_API_KEY),
    ...splitKeys(process.env.GOOGLE_API_KEY),
  ])];
}

function getTimeoutMs() {
  const parsed = Number(process.env.GEMINI_REQUEST_TIMEOUT_MS ?? 15000);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 15000;
}

function renderChunkContext(chunks) {
  return chunks
    .map(
      (chunk, index) => [
        `Chunk ${index + 1}`,
        `- chunkId: ${chunk.chunkId}`,
        `- title: ${chunk.title}`,
        `- citation: ${chunk.citation}`,
        `- text: ${chunk.text}`,
      ].join('\n'),
    )
    .join('\n\n');
}

function buildSystemInstruction() {
  return [
    'Bạn là một nữ hướng dẫn viên du lịch chuyên nghiệp tại phòng trưng bày quy trình làm giấy dó. Hãy luôn trả lời bằng tiếng Việt với giọng điệu nhẹ nhàng, thanh thoát, truyền cảm, lịch sự và hiếu khách. Xưng hô là "tôi" hoặc "mình" và gọi người nghe là "bạn". Câu trả lời cần tự nhiên, ngắn gọn và trôi chảy như đang trò chuyện trực tiếp.',
    'Chỉ dùng approved chunks cho mọi khẳng định thực tế về hiện vật, lịch sử, quy trình, tên riêng, số liệu, giờ mở cửa hoặc thông tin ngoài phòng.',
    'Không suy đoán và không bịa chi tiết không có trong context.',
    'Luôn trả lời bằng tiếng Việt, không nhắc model hay quy trình nội bộ.',
    'Conversation: trả lời tự nhiên, lịch sự, tối đa 2 câu; không tự thêm fact về phòng.',
    'Overview: tổng hợp approved chunks, tối đa 3 câu ngắn.',
    'Boundary: trả lời tự nhiên, lịch sự. Nếu thông tin nằm ngoài tư liệu hoặc phòng trưng bày này, hãy giải thích nhẹ nhàng và hướng người dùng quay lại các công đoạn làm giấy dó (không tự bịa các số liệu hay thời gian cụ thể).',
    'Grounded: trả lời từ approved chunks, tối đa 2 câu ngắn.',
    'Luôn trả đúng JSON theo schema đã yêu cầu.',
  ].join(' ');
}

function buildUserPrompt({ sceneTitle, sceneSummary, question, chunks, policy }) {
  return [
    `Policy: ${policy}`,
    `Scene: ${sceneTitle}`,
    `Summary: ${sceneSummary}`,
    `Question: ${question}`,
    chunks.length ? 'Approved chunks:' : 'Approved chunks: none supplied for this turn.',
    chunks.length ? renderChunkContext(chunks) : 'Do not introduce factual claims not explicitly supplied above.',
  ].join('\n\n');
}

function extractTextCandidate(payload) {
  const parts = payload?.candidates?.[0]?.content?.parts;

  if (!Array.isArray(parts)) {
    return '';
  }

  return parts
    .map((part) => (typeof part?.text === 'string' ? part.text : ''))
    .join('')
    .trim();
}

function normalizeModelPayload(parsed) {
  const abstained = Boolean(parsed?.abstained);
  const confidence = ['low', 'medium', 'high'].includes(parsed?.confidence)
    ? parsed.confidence
    : 'low';
  const answer = abstained ? '' : String(parsed?.answer ?? '').trim();
  const abstainReason = abstained
    ? String(parsed?.abstainReason ?? 'Không đủ bằng chứng trong các chunk đã chọn.').trim()
    : null;

  if (!abstained && !answer) {
    throw new Error('Gemini returned an empty grounded answer.');
  }

  return {
    answer,
    confidence,
    abstained,
    abstainReason,
  };
}

export function generateLocalGroundedAnswer({ chunks, policy = 'grounded' }) {
  if (policy === 'conversation') {
    return {
      answer: 'Xin chào! Bạn có thể hỏi về các công đoạn làm giấy dó trong phòng trưng bày này.',
      confidence: 'low',
      abstained: false,
      abstainReason: null,
    };
  }

  if (policy === 'boundary') {
    return {
      answer: 'Tư liệu của phòng trưng bày hiện chưa xác nhận chi tiết đó. Bạn có thể hỏi về thu hoạch vỏ dó, ngâm vôi, giã bột, xeo giấy hoặc hong khô.',
      confidence: 'low',
      abstained: false,
      abstainReason: null,
    };
  }

  if (policy === 'overview') {
    return {
      answer: 'Quy trình trong phòng đi từ chuẩn bị vỏ dó, ngâm làm mềm và giã bột, đến xeo giấy rồi ép, dán tường và hong khô.',
      confidence: 'medium',
      abstained: false,
      abstainReason: null,
    };
  }

  if (!chunks.length) {
    return {
      answer: '',
      confidence: 'low',
      abstained: true,
      abstainReason: 'No approved evidence for that question in the current seed corpus.',
    };
  }

  return {
    answer: chunks.map((chunk) => chunk.text).join(' '),
    confidence: chunks.length > 1 ? 'medium' : 'high',
    abstained: false,
    abstainReason: null,
  };
}

async function callGemini(apiKey, payload) {
  const response = await fetch(`${GEMINI_API_URL}?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(getTimeoutMs()),
  });

  if (!response.ok) {
    const error = new Error(`Gemini chat failed: ${response.status} ${response.statusText}`);
    error.status = response.status;
    error.statusText = response.statusText;
    error.body = await response.text().catch(() => '');
    throw error;
  }

  return response.json();
}

export async function generateGeminiGroundedAnswer({ sceneTitle, sceneSummary, question, chunks, policy = 'grounded' }) {
  const apiKeys = getApiKeys();

  if (!apiKeys.length) {
    throw new Error('No Gemini API keys configured.');
  }

  const payload = {
    system_instruction: {
      parts: [{ text: buildSystemInstruction() }],
    },
    contents: [
      {
        role: 'user',
        parts: [{ text: buildUserPrompt({ sceneTitle, sceneSummary, question, chunks, policy }) }],
      },
    ],
    generationConfig: {
      response_mime_type: 'application/json',
      response_schema: RESPONSE_SCHEMA,
    },
  };

  let lastError = null;

  for (const apiKey of apiKeys) {
    try {
      const responsePayload = await callGemini(apiKey, payload);
      const text = extractTextCandidate(responsePayload);

      if (!text) {
        throw new Error('Gemini returned no text candidate.');
      }

      return normalizeModelPayload(JSON.parse(text));
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error('Gemini chat failed for all configured keys.');
}
