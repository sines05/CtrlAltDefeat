function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function renderHotspotList(hotspots) {
  return `
    <section class="hotspot-list" aria-label="Danh sách hotspot">
      <h2>Danh sách hotspot</h2>
      <ol>
        ${hotspots
          .map(
            (hotspot) => `
              <li>
                <strong>${escapeHtml(hotspot.title)}</strong>
                <p>${escapeHtml(hotspot.body)}</p>
                <p class="citation">Nguồn: ${escapeHtml(hotspot.citation)}</p>
              </li>
            `,
          )
          .join('')}
      </ol>
    </section>
  `;
}

export function renderHotspotOverlay(hotspots) {
  return `
    <div class="hotspot-overlay" aria-label="Hotspot tương tác">
      ${hotspots
        .map(
          (hotspot) => `
            <button
              type="button"
              class="hotspot-button"
              data-hotspot-id="${escapeHtml(hotspot.hotspotId)}"
              style="left:${hotspot.position.x}%; top:${hotspot.position.y}%;"
            >
              ${escapeHtml(hotspot.title)}
            </button>
          `,
        )
        .join('')}
    </div>
  `;
}
