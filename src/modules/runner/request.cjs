const METHODS = ['get','post','put','patch','delete','head','options','trace'];
function interpolate(value, variables) {
  return String(value).replace(/\{\{\s*([^{}]+?)\s*\}\}/g,(_,key)=>{
    if(!Object.hasOwn(variables,key)) throw Error(`환경변수 ${key}를 설정하세요.`);
    return String(variables[key]);
  });
}
function prepare(request, variables) {
  const url=new URL(interpolate(request.url,variables));
  if(!['http:','https:'].includes(url.protocol)) throw Error('HTTP/HTTPS URL만 사용할 수 있습니다.');
  if(url.username||url.password) throw Error('URL 대신 Authorization 헤더를 사용하세요.');
  for(const [k,v] of Object.entries(request.query||{})) if(v!=='') url.searchParams.set(k,interpolate(v,variables));
  const headers=Object.fromEntries(Object.entries(request.headers||{}).map(([k,v])=>[k,interpolate(v,variables)]));
  if(request.auth && !Object.keys(headers).some(k=>k.toLowerCase()==='authorization')) {
    if(!variables.token) throw Error('먼저 인증 요청으로 token을 추출하거나 환경변수에 설정하세요.');
    headers.Authorization=`Bearer ${variables.token}`;
  }
  const method=String(request.method).toUpperCase();
  if(!METHODS.includes(method.toLowerCase())) throw Error('지원하지 않는 HTTP 메서드입니다.');
  return {url:url.toString(),method,headers,body:['GET','HEAD'].includes(method)?undefined:interpolate(request.body||'',variables)};
}
function extract(body, mapping) {
  const result={}; const json=JSON.parse(body);
  for(const [key,path] of Object.entries(mapping||{})) {
    if(['__proto__','constructor','prototype'].includes(key)) throw Error('잘못된 변수 이름입니다.');
    const value=String(path).split('.').reduce((v,k)=>v?.[k],json);
    if(value===undefined || typeof value==='object') throw Error(`응답에서 ${path} 값을 찾을 수 없습니다.`);
    result[key]=String(value);
  }
  return result;
}
module.exports={interpolate,prepare,extract};
