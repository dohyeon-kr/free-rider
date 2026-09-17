/** In-memory browser adapter. No fetch, Electron, storage, eval, or real credentials. */
export const SCENARIOS = Object.freeze([
  { id: 'login', name: 'Login', method: 'POST', path: '/auth/login' },
  { id: 'profile', name: 'Profile', method: 'GET', path: '/users/me' },
  { id: 'orders', name: 'Orders', method: 'GET', path: '/orders' },
]);
const ORIGIN = 'https://api.freerider.example';
const TOKEN = 'demo-token-not-a-real-credential';
const sampleOrders = [
  { id: 'FR-1042', item: 'Studio headphones', total: 129, currency: 'USD', status: 'paid' },
  { id: 'FR-1043', item: 'Mechanical keyboard', total: 89, currency: 'USD', status: 'shipped' },
  { id: 'FR-1044', item: 'Desk light', total: 49, currency: 'USD', status: 'paid' },
];
const clone = value => structuredClone(value);
const rows = value => Array.isArray(value) ? value : Object.entries(value || {}).map(([key, value]) => ({ key, value, enabled: true }));

export function createWorkspace() {
  const requests = SCENARIOS.map(scenario => ({
    ...scenario, url: `{{baseUrl}}${scenario.path}`, group: scenario.id === 'orders' ? 'Commerce' : 'Authentication',
    description: 'Sample data only. Nothing is sent to an external API.',
    query: scenario.id === 'orders' ? [{ key: 'limit', value: '2', enabled: true }] : [],
    headers: [], vars: [], bodyType: scenario.id === 'login' ? 'json' : 'none',
    body: scenario.id === 'login' ? JSON.stringify({ email: 'rider@example.test', password: 'demo-only' }, null, 2) : '',
    authConfig: scenario.id === 'login' ? { type: 'none' } : { type: 'bearer', token: '{{authToken}}' },
    extract: scenario.id === 'login' ? { authToken: '$.token' } : {},
    assertions: [], manual: true,
  }));
  return {
    collections: [{
      id: 'demo-store', version: 2, title: 'Store API', source: '',
      description: 'Free Rider · Interactive sample workspace',
      requests, folders: [], vars: [], headers: [], authConfig: { type: 'none' },
      interceptors: { enabled: false, before: '', after: '' },
      environments: [{ id: 'demo-env', name: 'Sandbox', values: { baseUrl: ORIGIN } }],
      defaultEnvironment: 'demo-env',
    }],
    activeCollection: 'demo-store',
    tabs: SCENARIOS.map(({ id }) => ({ cid: 'demo-store', kind: 'request', id })),
    activeTab: 'demo-store|request|login', selectedEnvironments: { 'demo-store': 'demo-env' },
    layout: 'vertical', collapsed: [],
  };
}

function pause(delay, signal) {
  return new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      reject(new Error('Demo request cancelled.'));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    }, delay);
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
  });
}

/** The signature matches preload.cjs / app.js, but intentionally not the desktop executor. */
export function createDemoClient({ delay = 420, onEvent = () => {}, copy } = {}) {
  let workspace = createWorkspace();
  let pending = null;
  let profile = { id: 'user_demo', name: 'Rider', email: 'rider@example.test', plan: 'free' };
  const runtime = Object.create(null);
  const emit = event => onEvent(event);
  const desktopOnly = async () => { throw new Error('Available in the desktop app. This demo uses sample data only.'); };

  async function send(request, environment = {}, collection = {}, interceptors = {}) {
    if (pending) throw new Error('A demo request is already running.');
    const controller = new AbortController();
    pending = controller;
    const started = Date.now();
    const scenario = SCENARIOS.some(s => s.id === request.id) ? request.id : null;
    emit({ type: 'request-start', scenario });
    try {
      await pause(Math.max(0, Number(delay) || 0), controller.signal);
      const values = Object.assign(Object.create(null), environment.values || {}, runtime);
      for (const row of [...rows(collection.vars), ...rows(request.vars)]) {
        if (row.enabled !== false && row.key) values[row.key] = row.value;
      }
      const resolve = text => String(text || '').replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (match, name) => Object.hasOwn(values, name) ? String(values[name]) : match);
      const respond = (status, data, variables = []) => {
        const body = JSON.stringify(data, null, 2);
        const result = {
          status, body, elapsed: Date.now() - started, bytes: new TextEncoder().encode(body).length,
          headers: { 'content-type': 'application/json', 'x-free-rider-demo': 'true' },
          variables, tests: [],
          logs: ['Simulated response. No external network request was made.'],
        };
        if (interceptors.enabled || collection.interceptors?.enabled || request.assertions?.length) {
          result.logs.push('Interceptors and assertions are not executed in the browser demo. Use the desktop app.');
        }
        // Only presentation metadata crosses the iframe boundary, never request/response data.
        emit({ type: 'response', scenario, status, elapsed: result.elapsed, bytes: result.bytes });
        return result;
      };
      let url;
      try { url = new URL(resolve(request.url)); }
      catch { return respond(400, { error: 'invalid_url', message: 'Use {{baseUrl}} and a sample endpoint.' }); }
      if (url.origin !== ORIGIN || url.username || url.password) {
        return respond(403, { error: 'demo_origin_only', message: `This sandbox only simulates ${ORIGIN}. No request was sent.` });
      }
      for (const row of rows(request.query)) {
        if (row.enabled !== false && row.key) url.searchParams.set(row.key, resolve(row.value));
      }
      const route = SCENARIOS.find(s => s.path === url.pathname);
      if (!route) return respond(404, { error: 'sample_not_found', available: SCENARIOS.map(s => s.path) });
      if (String(request.method).toUpperCase() !== route.method) {
        return respond(405, { error: 'method_not_allowed', allowed: route.method });
      }
      if (route.id === 'login') {
        let body;
        try { body = JSON.parse(request.body || '{}'); }
        catch { return respond(400, { error: 'invalid_json', message: 'Fix the JSON in the Body tab and send again.' }); }
        if (!body || typeof body.email !== 'string' || !body.email.includes('@') || typeof body.password !== 'string' || !body.password.trim()) {
          return respond(422, { error: 'validation_error', required: ['email', 'password'], message: 'Use fictional values, not real credentials.' });
        }
        profile = { ...profile, email: body.email };
        const captured = request.extract?.authToken === '$.token';
        if (captured) runtime.authToken = TOKEN;
        return respond(200, { token: TOKEN, user: clone(profile) }, captured ? ['authToken'] : []);
      }
      const auth = request.authConfig?.type === 'inherit' ? collection.authConfig : request.authConfig;
      if (!runtime.authToken || auth?.type !== 'bearer' || resolve(auth.token) !== TOKEN) {
        return respond(401, { error: 'unauthorized', message: 'Send Login first. Its demo token is captured as {{authToken}} for the next request.' });
      }
      if (route.id === 'profile') return respond(200, clone(profile));
      const limit = Number(url.searchParams.get('limit') ?? 2);
      const status = url.searchParams.get('status');
      if (!Number.isInteger(limit) || limit < 1 || limit > 100 || (status && !['paid', 'shipped', 'pending'].includes(status))) {
        return respond(422, { error: 'invalid_query', message: 'limit: integer 1–100; status: paid, shipped, or pending.' });
      }
      const matching = sampleOrders.filter(order => !status || order.status === status);
      return respond(200, { data: clone(matching.slice(0, limit)), meta: { total: matching.length, limit, simulated: true } });
    } catch (error) {
      if (controller.signal.aborted) emit({ type: 'cancelled', scenario });
      throw error;
    } finally { if (pending === controller) pending = null; }
  }

  const api = {
    send,
    cancel: async () => { pending?.abort(); return true; },
    'workspace-load': async () => clone(workspace),
    'workspace-save': async value => {
      if (!Array.isArray(value?.collections)) throw new Error('Invalid demo workspace.');
      workspace = clone(value);
      return true;
    },
    'set-dirty': async () => true,
    'clear-tokens': async () => { delete runtime.authToken; return true; },
    copy: async text => {
      if (!copy) throw new Error('Clipboard is unavailable here. Open the demo in a new tab or use the desktop app.');
      await copy(String(text));
      return true;
    },
    onShortcut: () => () => {},
  };
  for (const name of [
    'import-spec', 'sync-spec', 'sync-spec-file', 'merge-spec', 'network-replay',
    'network-history', 'network-clear', 'cookie-jar', 'cookie-clear',
    'request-file-select', 'request-file-status', 'request-file-release',
    'import-env', 'env-connect', 'env-read', 'env-write', 'env-parse',
    'open-collection', 'save-collection', 'git-open', 'git-status', 'git-save',
    'git-diff', 'git-commit', 'mcp-state', 'mcp-toggle', 'announcement-list',
    'announcement-open', 'docs-reference-get', 'docs-reference-open',
    'update-state', 'update-check', 'update-install',
  ]) api[name] = desktopOnly;
  return api;
}
