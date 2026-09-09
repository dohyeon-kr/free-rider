// Parse text only: never invoke a shell, read files, or expand variables.
export const isCurl = (text) => /^\s*curl(?:\s|$)/.test(text);
function tokenize(text) {
  const words = [];
  let word = '', quote = '', started = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '\\' && quote !== "'") {
      const next = text[++i];
      if (next === undefined) throw Error('끝나지 않은 cURL 이스케이프입니다.');
      if (next === '\n') continue;
      if (next === '\r' && text[i + 1] === '\n') { i++; continue; }
      if (quote === '"' && !['$', '`', '"', '\\'].includes(next)) word += '\\';
      word += next; started = true; continue;
    }
    if (quote) {
      if (ch === quote) quote = '';
      else word += ch;
      continue;
    }
    if (ch === "'" || ch === '"') { quote = ch; started = true; continue; }
    if (/\s/.test(ch)) {
      if (started) words.push(word);
      word = ''; started = false; continue;
    }
    if (/[|;&<>`]/.test(ch) || (ch === '$' && ['(', "'"].includes(text[i + 1])))
      throw Error('셸 연산·확장 문법은 지원하지 않습니다. Copy as cURL (bash)를 사용하세요.');
    word += ch; started = true;
  }
  if (quote) throw Error('cURL 따옴표가 닫히지 않았습니다.');
  if (started) words.push(word);
  return words;
}
export function parseCurl(text) {
  const args = tokenize(text);
  if (args.shift() !== 'curl') throw Error('curl 명령을 붙여넣으세요.');
  let url, method, head = false, get = false, json = false;
  const headers = [], data = [];
  let authConfig = { type: 'none' };
  const header = (key, value) => {
    const old = headers.find(h => h.key.toLowerCase() === key.toLowerCase());
    if (old) old.value = value;
    else headers.push({ key, value, enabled: true });
  };
  const aliases = { '-X': '--request', '-H': '--header', '-d': '--data', '-u': '--user', '-b': '--cookie' };
  for (let i = 0; i < args.length; i++) {
    let option = args[i], inline;
    if (option.startsWith('--') && option.includes('=')) {
      const pos = option.indexOf('='); inline = option.slice(pos + 1); option = option.slice(0, pos);
    } else if (option.length > 2 && aliases[option.slice(0, 2)]) {
      inline = option.slice(2); option = option.slice(0, 2);
    }
    option = aliases[option] || option;
    const value = () => {
      const v = inline !== undefined ? inline : args[++i];
      if (v === undefined) throw Error(`${option} 값이 없습니다.`);
      return v;
    };
    if (['--compressed', '--silent', '-s', '--show-error', '-S'].includes(option) && inline === undefined) continue;
    if (['--head', '-I'].includes(option) && inline === undefined) { head = true; continue; }
    if (['--get', '-G'].includes(option) && inline === undefined) { get = true; continue; }
    if (option === '--request') method = value().toUpperCase();
    else if (option === '--url' || !option.startsWith('-')) {
      const next = option === '--url' ? value() : option;
      if (url) throw Error('한 번에 하나의 URL만 가져올 수 있습니다.');
      url = next;
    } else if (option === '--header') {
      const v = value(), pos = v.indexOf(':');
      if (pos <= 0) throw Error('헤더는 이름: 값 형식이어야 합니다.');
      header(v.slice(0, pos).trim(), v.slice(pos + 1).trim());
    } else if (option === '--user') {
      const v = value(), pos = v.indexOf(':');
      if (pos < 0) throw Error('Basic 인증은 사용자:비밀번호 형식이어야 합니다.');
      authConfig = { type: 'basic', username: v.slice(0, pos), password: v.slice(pos + 1) };
    } else if (option === '--cookie') {
      const v = value();
      if (!v.includes('=')) throw Error('쿠키 파일 가져오기는 지원하지 않습니다.');
      header('Cookie', v);
    } else if (['--data', '--data-raw', '--data-binary', '--data-urlencode', '--json'].includes(option)) {
      let v = value();
      if (option !== '--data-raw' && (v.startsWith('@') || (option === '--data-urlencode' && /^[^=]*@/.test(v))))
        throw Error('파일 본문은 지원하지 않습니다. 본문을 직접 붙여넣으세요.');
      if (option === '--data-urlencode') {
        const pos = v.indexOf('=');
        v = pos < 0 ? encodeURIComponent(v) : v.slice(0, pos) + '=' + encodeURIComponent(v.slice(pos + 1));
      }
      json ||= option === '--json'; data.push(v);
    } else throw Error(`지원하지 않는 cURL 옵션: ${option}`);
  }
  if (!url || !/^https?:\/\//i.test(url)) throw Error('HTTP/HTTPS URL이 필요합니다.');
  const parsed = new URL(url);
  if (parsed.username || parsed.password) throw Error('URL 인증 대신 -u 사용자:비밀번호를 사용하세요.');
  method ||= head ? 'HEAD' : get ? 'GET' : data.length ? 'POST' : 'GET';
  if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS', 'TRACE'].includes(method))
    throw Error('지원하지 않는 HTTP 메서드입니다.');
  let body = data.join(json ? '' : '&');
  if (get && data.length) {
    parsed.search += (parsed.search ? '&' : '?') + body; body = '';
  } else if (data.length && ['GET', 'HEAD'].includes(method)) {
    throw Error('GET/HEAD 본문은 지원하지 않습니다. 쿼리 전송은 -G를 사용하세요.');
  }
  if (data.length && !get && !headers.some(h => h.key.toLowerCase() === 'content-type'))
    header('Content-Type', json ? 'application/json' : 'application/x-www-form-urlencoded');
  if (json && !headers.some(h => h.key.toLowerCase() === 'accept')) header('Accept', 'application/json');
  // Keep URL query bytes intact (including duplicate and empty values).
  return { url: get ? parsed.href : url, method, headers, query: [], body,
    bodyType: !data.length || get ? 'none' : headers.some(h => h.key.toLowerCase() === 'content-type' && h.value.includes('json')) ? 'json' : 'text',
    auth: false, authConfig };
}
