function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function renderTtsPanel({ ttsState, canPlay }) {
  const transcript = ttsState?.transcript ?? '';
  const errorMessage = ttsState?.errorMessage ?? '';
  const audioUrl = ttsState?.audioUrl ?? '';

  return `
    <section class="tts-panel" aria-label="TTS panel">
      <div class="tts-controls">
        <button type="button" data-action="play-tts" ${canPlay ? '' : 'disabled'}>Play audio</button>
      </div>
      ${errorMessage ? `<p class="tts-error">${escapeHtml(errorMessage)}</p>` : ''}
      <div class="tts-transcript">
        <h3>Transcript</h3>
        <p>${escapeHtml(transcript || 'Chưa có transcript.')}</p>
        ${audioUrl ? '<p class="tts-mode">Audio ready.</p>' : '<p class="tts-mode">Transcript-only fallback.</p>'}
      </div>
      ${audioUrl ? `<audio controls src="${escapeHtml(audioUrl)}"></audio>` : ''}
    </section>
  `;
}
