const landing = document.getElementById('landing');
const heroStage = document.querySelector('.hero-stage');
const liftButton = document.querySelector('.sheet-lift');
const enterButtons = [...document.querySelectorAll('[data-enter-museum]')];
const errorMessages = [...document.querySelectorAll('.landing-error')];
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

liftButton?.addEventListener('click', () => {
  heroStage?.classList.add('is-lifted');
  liftButton.setAttribute('aria-expanded', 'true');
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
    await import('./main.js');
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

enterButtons.forEach((button) => button.addEventListener('click', enterMuseum));
