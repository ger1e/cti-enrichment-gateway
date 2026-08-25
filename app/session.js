export function createSession() {
  let token = null;
  let mode = 'locked';
  let result = null;
  let activeController = null;

  const abortActive = () => {
    if (activeController && !activeController.signal.aborted) activeController.abort();
    activeController = null;
  };

  return Object.freeze({
    setToken(value) {
      abortActive();
      token = String(value || '').trim() || null;
      mode = 'locked';
      result = null;
    },
    getToken: () => token,
    unlock() {
      if (!token) throw new Error('token required');
      mode = 'ready';
    },
    startRequest(controller) {
      if (!['ready', 'result'].includes(mode)) throw new Error('session not ready');
      if (activeController) throw new Error('request already active');
      if (!controller || !controller.signal || typeof controller.abort !== 'function') throw new TypeError('AbortController required');
      activeController = controller;
      mode = 'running';
      result = null;
    },
    finishRequest(value) {
      if (mode !== 'running') throw new Error('no active request');
      activeController = null;
      result = value;
      mode = 'result';
    },
    reset() {
      abortActive();
      result = null;
      mode = token ? 'ready' : 'locked';
    },
    disconnect() {
      abortActive();
      token = null;
      result = null;
      mode = 'locked';
    },
    snapshot() {
      return Object.freeze({
        mode,
        result,
        hasToken: Boolean(token),
        requestActive: Boolean(activeController),
      });
    },
  });
}
