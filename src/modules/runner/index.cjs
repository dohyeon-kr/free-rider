const {prepare,extract}=require('./request.cjs');
async function fetchText(url, options={}) {
  const parsed=new URL(url); if(!['http:','https:'].includes(parsed.protocol)) throw Error('HTTP/HTTPS만 지원합니다.');
  const response=await fetch(url,{...options,redirect:'error',signal:options.signal ? AbortSignal.any([options.signal,AbortSignal.timeout(30000)]) : AbortSignal.timeout(30000)});
  const chunks=[];let bytes=0;
  for await(const chunk of response.body || []) {bytes+=chunk.length;if(bytes>10*1024*1024) throw Error('응답이 10MB 제한을 넘었습니다.');chunks.push(chunk);}
  return {status:response.status,statusText:response.statusText,headers:Object.fromEntries(response.headers),body:Buffer.concat(chunks).toString('utf8'),bytes};
}
async function execute(request,variables,signal) {
  const p=prepare(request,variables),start=performance.now();
  const response=await fetchText(p.url,{method:p.method,headers:p.headers,body:p.body,signal});
  const values=response.status>=200&&response.status<300&&Object.keys(request.extract||{}).length?extract(response.body,request.extract):{};
  return {...response,elapsed:Math.round(performance.now()-start),variables:values};
}
module.exports={fetchText,execute};
