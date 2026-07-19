const landing = document.getElementById('landing');
const heroStage = document.querySelector('.hero-stage');
const liftButton = document.querySelector('.sheet-lift');
const enterButtons = [...document.querySelectorAll('[data-enter-museum]')];
const errorMessages = [...document.querySelectorAll('.landing-error')];
const MODULE_WARMUP_BLOCKED_CONNECTIONS = new Set(['slow-2g', '2g']);
const GUIDE_PRELOAD_BLOCKED_CONNECTIONS = new Set(['slow-2g', '2g', '3g']);
let museumModulePromise = null;
let guidePreloadStarted = false;
let isStarting = false;

function waitForFirstMuseumFrame(timeoutMs = 4000) {
  return new Promise((resolve) => {
    const timeout = setTimeout(resolve, timeoutMs);
    window.addEventListener('museum:first-frame', () => {
      clearTimeout(timeout);
      resolve();
    }, { once: true });
  });
}

function getConnection() {
  return navigator.connection ?? navigator.mozConnection ?? navigator.webkitConnection ?? null;
}

function canAutoWarmModule() {
  const connection = getConnection();
  return document.visibilityState === 'visible'
    && connection?.saveData !== true
    && !MODULE_WARMUP_BLOCKED_CONNECTIONS.has(connection?.effectiveType);
}

function canPreloadGuides() {
  const connection = getConnection();
  const hasFastConnection = connection?.effectiveType === '4g';
  const hasEnoughMemory = Number.isFinite(navigator.deviceMemory) && navigator.deviceMemory >= 4;

  return document.visibilityState === 'visible'
    && connection?.saveData !== true
    && hasFastConnection
    && !GUIDE_PRELOAD_BLOCKED_CONNECTIONS.has(connection?.effectiveType)
    && window.innerWidth >= 1024
    && window.matchMedia?.('(pointer: fine)').matches === true
    && hasEnoughMemory;
}

function warmMuseumModule() {
  if (!museumModulePromise) {
    museumModulePromise = import('./main.js').catch((error) => {
      museumModulePromise = null;
      throw error;
    });
  }

  return museumModulePromise;
}

function warmMuseumModuleForIntent() {
  void warmMuseumModule().catch((error) => {
    console.warn('[Landing] Museum module warmup unavailable; entry will retry.', error);
  });
}

function preloadGuidesForIntent() {
  if (guidePreloadStarted || !canPreloadGuides()) {
    return false;
  }

  guidePreloadStarted = true;
  void warmMuseumModule()
    .then((museum) => museum.preloadMuseumGuides())
    .then((preloaded) => {
      if (!preloaded) {
        guidePreloadStarted = false;
      }
    })
    .catch((error) => {
      guidePreloadStarted = false;
      console.warn('[Landing] Guide preload unavailable; entry will use fallback assets.', error);
    });
  return true;
}

function scheduleModuleWarmup() {
  const schedule = () => {
    const warm = () => {
      if (canAutoWarmModule()) {
        warmMuseumModuleForIntent();
      }
    };

    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(warm, { timeout: 1500 });
      return;
    }

    setTimeout(warm, 1200);
  };

  if (document.visibilityState === 'visible') {
    schedule();
    return;
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      schedule();
    }
  }, { once: true });
}

liftButton?.addEventListener('click', () => {
  heroStage?.classList.add('is-lifted');
  liftButton.setAttribute('aria-expanded', 'true');
  preloadGuidesForIntent();
});

const revealObserver = new IntersectionObserver((entries, observer) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) {
      continue;
    }

    entry.target.classList.add('is-visible');
    observer.unobserve(entry.target);
  }
}, { threshold: 0.18 });

document.querySelectorAll('.process-item').forEach((item) => revealObserver.observe(item));

const processSection = document.getElementById('quy-trinh');
if (processSection) {
  const guidePreloadObserver = new IntersectionObserver((entries, observer) => {
    if (entries.some((entry) => entry.isIntersecting) && preloadGuidesForIntent()) {
      observer.disconnect();
    }
  }, { threshold: 0.1 });
  guidePreloadObserver.observe(processSection);
}

async function enterMuseum() {
  if (isStarting) {
    return;
  }

  isStarting = true;
  errorMessages.forEach((message) => { message.textContent = ''; });
  document.body.classList.add('is-entering');
  enterButtons.forEach((button) => {
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.dataset.label = button.textContent;
    button.textContent = 'Đang mở phòng trưng bày';
  });

  try {
    const firstFrame = waitForFirstMuseumFrame();
    const museum = await warmMuseumModule();
    await museum.startMuseumApp();
    await firstFrame;
    document.body.classList.add('museum-active');
    document.body.classList.remove('is-entering');
    landing.classList.add('is-leaving');
    landing.setAttribute('aria-hidden', 'true');

    setTimeout(() => {
      landing.remove();
      const sceneInstructions = document.getElementById('info');
      sceneInstructions?.setAttribute('tabindex', '-1');
      sceneInstructions?.focus({ preventScroll: true });
    }, 520);
  } catch (error) {
    console.error('[Landing] Museum scene failed to start.', error);
    document.body.classList.remove('is-entering', 'museum-active');
    errorMessages.forEach((message) => {
      message.textContent = 'Không thể mở phòng trưng bày lúc này. Vui lòng thử lại.';
    });
    enterButtons.forEach((button) => {
      button.disabled = false;
      button.removeAttribute('aria-busy');
      button.textContent = button.dataset.label;
    });
    isStarting = false;
  }
}

enterButtons.forEach((button) => {
  button.addEventListener('pointerenter', warmMuseumModuleForIntent, { once: true });
  button.addEventListener('focusin', warmMuseumModuleForIntent, { once: true });
  button.addEventListener('pointerdown', warmMuseumModuleForIntent, { once: true });
  button.addEventListener('click', enterMuseum);
});

scheduleModuleWarmup();
