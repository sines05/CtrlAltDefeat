const DEFAULT_TIMEOUT_MS = 5000;

function withTimeout(fetchImpl, url, { timeoutMs = DEFAULT_TIMEOUT_MS, signal: callerSignal } = {}) {
  if (!fetchImpl) {
    throw new Error('fetch implementation is required.');
  }

  const controller = new AbortController();
  const onAbort = () => controller.abort(callerSignal?.reason);

  if (callerSignal) {
    if (callerSignal.aborted) {
      controller.abort(callerSignal.reason);
    } else {
      callerSignal.addEventListener('abort', onAbort, { once: true });
    }
  }

  const timeoutId = setTimeout(() => controller.abort(new Error(`Request timed out after ${timeoutMs}ms.`)), timeoutMs);

  return fetchImpl(url, { signal: controller.signal })
    .finally(() => {
      clearTimeout(timeoutId);
      if (callerSignal) {
        callerSignal.removeEventListener('abort', onAbort);
      }
    });
}

async function fetchJson(url, options = {}) {
  const response = await withTimeout(options.fetchImpl ?? fetch, url, options);

  if (!response.ok) {
    const error = new Error(`Request failed with status ${response.status}.`);
    error.status = response.status;
    throw error;
  }

  return response.json();
}

export async function fetchSceneData(sceneId, options = {}) {
  return fetchJson(`/api/scene/${sceneId}`, options);
}

export async function fetchTourData(tourId, options = {}) {
  return fetchJson(`/api/tour/${tourId}`, options);
}

export async function fetchMediaManifest(sceneId, options = {}) {
  return fetchJson(`/api/media/${sceneId}`, options);
}

export async function fetchBootstrapContent({
  sceneId,
  tourId,
  fetchImpl = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  // Scene and tour define the minimum story the visitor must be able to follow. Media is
  // fetched after that baseline so a content-rich but degraded room still works under stress.
  if (!sceneId || !tourId) {
    throw new Error('sceneId and tourId are required.');
  }

  const scene = await fetchSceneData(sceneId, { fetchImpl, timeoutMs });
  const tour = await fetchTourData(tourId, { fetchImpl, timeoutMs });

  let media = null;
  let mediaError = null;

  // Media failure is isolated on purpose: the walkthrough, grounded answer path, and text
  // fallback should stay intact even when heavier assets are slow or unavailable.

  try {
    media = await fetchMediaManifest(sceneId, { fetchImpl, timeoutMs });
  } catch (error) {
    mediaError = error;
  }

  return {
    scene,
    tour,
    media,
    mediaError,
  };
}
