import { renderHotspotList } from '../hotspots/list.js';

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function renderFallbackPanel(scene, tour) {
  return `
    <section class="fallback-shell" data-mode="fallback">
      <article class="poster-card">
        <p class="eyebrow">Chế độ suy giảm</p>
        <h2>${escapeHtml(scene.title)}</h2>
        <p>${escapeHtml(scene.summary)}</p>
      </article>
      ${renderHotspotList(scene.hotspots)}
      <section class="tour-copy" aria-label="Tour text">
        <h2>Tour 5 bước</h2>
        <ol>
          ${tour.steps
            .map(
              (step) => `
                <li>
                  <strong>${escapeHtml(step.title)}</strong>
                  <p>${escapeHtml(step.body)}</p>
                  <p class="citation">Nguồn: ${escapeHtml(step.citations.join(', '))}</p>
                </li>
              `,
            )
            .join('')}
        </ol>
      </section>
    </section>
  `;
}
