import { renderTtsPanel } from '../tts/panel.js';

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderCitations(citations) {
  if (!citations?.length) {
    return '<p class="qa-citations-empty">Chưa có citation.</p>';
  }

  return `
    <ul class="qa-citations">
      ${citations
        .map(
          (citation) => `
            <li>
              <strong>${escapeHtml(citation.label)}</strong>
              <code>${escapeHtml(citation.ref)}</code>
            </li>
          `,
        )
        .join('')}
    </ul>
  `;
}

function renderChatMessage({ role, label, text, meta = '' }) {
  return `
    <article class="chat-bubble chat-bubble--${escapeHtml(role)}">
      <p class="chat-bubble__label">${escapeHtml(label)}</p>
      <div class="chat-bubble__body">
        <p>${escapeHtml(text)}</p>
      </div>
      ${meta}
    </article>
  `;
}

function renderAssistantBlock(qaPacket) {
  if (!qaPacket) {
    return renderChatMessage({
      role: 'assistant',
      label: 'Assistant',
      text: 'Đặt câu hỏi để xem câu trả lời grounded.',
    });
  }

  if (qaPacket.abstained) {
    return renderChatMessage({
      role: 'assistant',
      label: 'Assistant',
      text: qaPacket.abstainReason ?? 'No approved evidence for that question in the current seed corpus.',
    });
  }

  return `
    ${renderChatMessage({
      role: 'assistant',
      label: 'Assistant',
      text: qaPacket.answer,
      meta: `
        <div class="chat-meta">
          <p class="qa-confidence">Confidence: ${escapeHtml(qaPacket.confidence)}</p>
          ${renderCitations(qaPacket.citations)}
        </div>
      `,
    })}
  `;
}

function renderLiveVoicePanel({ liveCapability, ttsState, isRecording }) {
  const capabilityLabel = liveCapability?.enabled
    ? `Live voice: bật (${liveCapability.model})`
    : `Live voice: tắt (${liveCapability?.model ?? 'gemini-3.1-flash-live-preview'})`;
  const inputTranscript = ttsState?.inputTranscript ?? '';
  const outputTranscript = ttsState?.outputTranscript ?? '';
  const recoveryMessage = ttsState?.recoveryMessage ?? '';

  return `
    <section class="live-voice-panel" aria-label="Live voice panel">
      <h3>Live voice</h3>
      <p class="live-voice-capability">${escapeHtml(capabilityLabel)}</p>
      <div class="live-voice-controls">
        <button type="button" data-action="record-voice" ${liveCapability?.enabled ? '' : 'disabled'}>${isRecording ? 'Dừng ghi âm' : 'Record voice'}</button>
      </div>
      ${recoveryMessage ? `<p class="live-voice-recovery">${escapeHtml(recoveryMessage)}</p>` : ''}
      ${inputTranscript ? `<p class="live-voice-input"><strong>Input transcript:</strong> ${escapeHtml(inputTranscript)}</p>` : ''}
      ${outputTranscript ? `<p class="live-voice-output"><strong>Output transcript:</strong> ${escapeHtml(outputTranscript)}</p>` : ''}
    </section>
  `;
}

export function renderInteractionPanel({
  question = '',
  qaPacket = null,
  ttsState = {},
  isLoading = false,
  isRecording = false,
  statusMessage = '',
  eventLog = [],
  liveCapability = null,
}) {
  const transcript = ttsState?.transcript ?? '';
  const errorMessage = ttsState?.errorMessage ?? '';
  const audioUrl = ttsState?.audioUrl ?? '';
  const userMessage = question || 'Chưa có câu hỏi.';

  return `
    <section class="chat-shell" aria-label="Chat grounded shell">
      <header class="chat-shell__header">
        <h2>Chat grounded tạm</h2>
        <p>Khung chat này hiển thị câu hỏi gần nhất và câu trả lời được grounding từ corpus đã duyệt.</p>
      </header>

      <div class="chat-thread">
        ${renderChatMessage({
          role: 'user',
          label: 'You',
          text: userMessage,
        })}
        ${renderAssistantBlock(qaPacket)}
      </div>

      <div class="chat-status" aria-live="polite">
        <strong>${escapeHtml(isLoading ? 'Đang xử lý…' : 'Trạng thái')}</strong>
        <p>${escapeHtml(statusMessage || 'Chưa có cập nhật.')}</p>
      </div>

      <form data-role="qa-form" class="chat-compose">
        <label>
          <span>Câu hỏi</span>
          <textarea name="question" rows="4" placeholder="Hỏi về giấy dó, quy trình xeo, hoặc phòng trưng bày...">${escapeHtml(question)}</textarea>
        </label>
        <button type="submit" ${isLoading ? 'disabled' : ''}>${isLoading ? 'Đang gửi…' : 'Gửi'}</button>
      </form>

      <section class="chat-log" aria-label="Event log">
        <h3>Log</h3>
        <ul>
          ${eventLog.length
            ? eventLog.map((line) => `<li>${escapeHtml(line)}</li>`).join('')
            : '<li>Chưa có sự kiện.</li>'}
        </ul>
      </section>

      ${renderLiveVoicePanel({ liveCapability, ttsState, isRecording })}

      ${renderTtsPanel({
        ttsState: {
          transcript: transcript || (qaPacket && !qaPacket.abstained ? qaPacket.answer : ''),
          audioUrl,
          errorMessage,
        },
        canPlay: Boolean(qaPacket && !qaPacket.abstained && qaPacket.answer),
      })}
    </section>
  `;
}
