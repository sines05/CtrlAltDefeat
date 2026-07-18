import { renderFallbackPanel } from '../fallback/index.js';
import { renderHotspotOverlay } from '../hotspots/list.js';
import { renderInteractionPanel } from '../qa/panel.js';

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderTourRail(tour) {
  return `
    <aside class="tour-rail" aria-label="Tour">
      <h2>${escapeHtml(tour.title)}</h2>
      <ol>
        ${tour.steps
          .map(
            (step) => `
              <li data-step-id="${escapeHtml(step.stepId)}">
                <strong>${escapeHtml(step.title)}</strong>
                <p>${escapeHtml(step.body)}</p>
              </li>
            `,
          )
          .join('')}
      </ol>
    </aside>
  `;
}

function renderAvatarShell(avatar, hasAvatarRuntime) {
  if (!avatar) {
    return '';
  }

  if (avatar.status !== 'ready' || !hasAvatarRuntime) {
    return `
      <article class="avatar-shell avatar-shell--degraded" data-avatar-state="degraded">
        <strong>${escapeHtml(avatar.title ?? 'Avatar')}</strong>
        <p>${escapeHtml(avatar.fallbackLabel ?? 'Avatar unavailable')}</p>
      </article>
    `;
  }

  return `
    <article
      class="avatar-shell"
      data-avatar-state="ready"
      data-avatar-kind="${escapeHtml(avatar.kind ?? 'animated')}"
      data-scale-locked="${avatar.scaleLocked ? 'true' : 'false'}"
    >
      <model-viewer
        class="avatar-model"
        src="${escapeHtml(avatar.src)}"
        ${avatar.isAnimated ? 'autoplay' : ''}
        camera-controls
      ></model-viewer>
      <p class="avatar-caption">${escapeHtml(avatar.title)}${avatar.clipLabel ? ` · ${escapeHtml(avatar.clipLabel)}` : ' · Static preview'}</p>
    </article>
  `;
}

function renderSceneShell(scene, tour, avatar, hasAvatarRuntime) {
  return `
    <section class="room-shell" aria-label="Phòng 3D stylized">
      <div class="room-stage">
        <div class="room-plane room-wall"></div>
        <div class="room-plane room-floor"></div>
        <div class="room-plinth">
          <h2>${escapeHtml(scene.title)}</h2>
          <p>${escapeHtml(scene.summary)}</p>
        </div>
        ${renderAvatarShell(avatar, hasAvatarRuntime)}
        ${renderHotspotOverlay(scene.hotspots)}
      </div>
      ${renderTourRail(tour)}
    </section>
  `;
}

export function createSceneAppHtml({
  scene,
  tour,
  hasWebGL,
  avatar = null,
  hasAvatarRuntime = false,
  interactionState = {},
}) {
  const mode = hasWebGL ? 'scene' : 'fallback';
  const body = hasWebGL
    ? renderSceneShell(scene, tour, avatar, hasAvatarRuntime)
    : renderFallbackPanel(scene, tour);

  return `
    <section class="scene-shell" data-mode="${mode}">
      <header class="scene-header">
        <p class="eyebrow">One-room museum shell</p>
        <h1>${escapeHtml(scene.title)}</h1>
        <p>${escapeHtml(scene.summary)}</p>
      </header>
      ${body}
      ${renderInteractionPanel(interactionState)}
    </section>
  `;
}
