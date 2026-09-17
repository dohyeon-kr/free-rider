import { createDemoClient, SCENARIOS } from './client.mjs';

const channel = 'free-rider-demo';
const locale = new URLSearchParams(location.search).get('lang') === 'en' ? 'en' : 'ko';
const text = locale === 'en' ? {
  ready: 'Sample workspace · Nothing leaves this demo',
  missing: 'This sample request was removed. Reset the demo to restore it.',
  failed: 'The demo could not start. Reload to try again.',
} : {
  ready: '샘플 워크스페이스 · 외부 API로 전송되지 않습니다',
  missing: '샘플 요청이 삭제됐습니다. 초기화하면 다시 체험할 수 있습니다.',
  failed: '데모를 시작하지 못했습니다. 다시 불러와 주세요.',
};
const post = payload => {
  if (window.parent !== window) window.parent.postMessage({ channel, ...payload }, location.origin);
};
function selectScenario(id, focus = false) {
  const scenario = SCENARIOS.find(item => item.id === id);
  if (!scenario) return false;
  const tab = [...document.querySelectorAll('#workTabs .work-tab')]
    .find(tab => tab.querySelector('.label')?.textContent === scenario.name);
  const tree = [...document.querySelectorAll('#tree button.tree-label')]
    .find(button => button.textContent === scenario.method + scenario.name);
  const target = tab || tree;
  if (!target) {
    document.getElementById('status').textContent = text.missing;
    post({ type: 'note', code: 'reset-required' });
    return false;
  }
  target.click();
  if (id === 'login') [...document.querySelectorAll('.request-pane button')]
    .find(button => button.textContent === 'Body')?.click();
  if (focus) document.getElementById('sendRequest')?.focus({ preventScroll: true });
  return true;
}

export async function startDemo(scripts) {
  try {
    document.documentElement.lang = locale;
    window.client = createDemoClient({
      onEvent: post,
      copy: navigator.clipboard ? text => navigator.clipboard.writeText(text) : undefined,
    });
    // Installing the adapter BEFORE evaluating app.js is essential: it captures window.client.
    for (const script of scripts) await import(script);
    await window.appReady;
    selectScenario('login');
    document.getElementById('appVersion').textContent = 'BROWSER DEMO';
    document.getElementById('status').textContent = text.ready;
    document.getElementById('saveWorkspace').title = locale === 'en'
      ? 'Save in this session only. Reset clears all changes.' : '현재 세션에만 저장합니다. 초기화하면 변경 내용이 지워집니다.';
    let selected = null;
    const syncSelection = () => {
      document.getElementById('requestUrl')?.setAttribute('aria-label', 'Request URL');
      const name = document.querySelector('.request-heading strong')?.textContent;
      const id = SCENARIOS.find(scenario => scenario.name === name)?.id || null;
      if (selected !== id) { selected = id; post({ type: 'selection', scenario: id }); }
    };
    const observer = new MutationObserver(syncSelection);
    observer.observe(document.getElementById('view'), { childList: true, subtree: true });
    syncSelection();
    const receive = event => {
      // No wildcard messaging or arbitrary commands from other frames.
      if (event.source !== parent || event.origin !== location.origin || event.data?.channel !== channel) return;
      if (event.data.type === 'select' && SCENARIOS.some(s => s.id === event.data.scenario)) {
        selectScenario(event.data.scenario);
      }
    };
    window.addEventListener('message', receive);
    window.addEventListener('pagehide', () => {
      observer.disconnect();
      window.removeEventListener('message', receive);
      window.client.cancel();
    }, { once: true });
    document.documentElement.dataset.demoReady = 'true';
    post({ type: 'ready', scenario: selected });
  } catch (error) {
    console.error('Free Rider demo bootstrap failed:', error);
    const status = document.getElementById('status');
    if (status) status.textContent = text.failed;
    document.documentElement.dataset.demoError = 'true';
    post({ type: 'error' });
  }
}
