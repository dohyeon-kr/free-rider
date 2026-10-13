import { el, button, input, select, textarea, field } from "./dom.js";
const api=window.client;
let runtime={enabled:false,collectionId:""};
function endpoints(col){
  const found=new Map();
  for(const request of col.requests||[]){
    if(request.type && request.type!=="http")continue;
    const method=String(request.method||"GET").toUpperCase();
    let path=request.openapi?.path;
    if(!path) {
      const raw=String(request.url||"").replace(/^\{\{baseUrl\}\}/,"");
      try{path=new URL(raw).pathname;}catch{path=raw.split("?")[0];}
      path=path.replace(/\{\{([^}]+)\}\}/g,"{$1}");
    }
    if(path?.startsWith("/"))found.set(method+" "+path,{method,path,request});
  }
  for(const rule of col.mock?.rules||[]){
    const key=rule.method+" "+rule.path;
    if(!found.has(key))found.set(key,{method:rule.method,path:rule.path,request:null});
  }
  return [...found.values()].sort((a,b)=>a.path.localeCompare(b.path)||a.method.localeCompare(b.method));
}
export function mockServerView(col,{state,mark,render,status}){
  col.mock||={rules:[]};col.mock.rules||=[];
  state.mockServer||={port:4010,upstreams:{}};
  state.mockServer.upstreams||={};
  const local=state.mockServer;
  const upstream=()=>local.upstreams[col.id]||"";
  const config=()=>({port:Number(local.port||4010),upstream:upstream(),collection:structuredClone(col)});
  const root=el("div",{class:"view-inner mock-server-view","data-view":"mock"},
    el("h1",{text:"Mock Server"}),
    el("p",{class:"muted",text:"OpenAPI 응답 스키마를 기준으로 선택한 엔드포인트만 목킹합니다. 나머지 요청은 지정된 Upstream으로 전달합니다."})
  );
  const running=el("strong",{text:"상태 확인 중…"});
  const address=el("code",{text:"http://127.0.0.1:"+(local.port||4010)});
  const feedback=el("p",{class:"mock-message",role:"status"});
  const setMessage=msg=>{feedback.textContent=msg;status(msg);};
  async function sync(){
    try{
      const next=await api["mock-state"]();runtime=next;
      if(running.isConnected){
        running.textContent=next.enabled?(next.collectionId===col.id?"● 실행 중":"다른 컬렉션 실행 중"):"○ 중지됨";
      }
    }catch(e){if(running.isConnected)running.textContent=e.message;}
  }
  async function updateRunning(){
    if(!runtime.enabled||runtime.collectionId!==col.id)return;
    try{runtime=await api["mock-update"](config());}
    catch(e){setMessage(e.message);}
  }
  const change=({redraw=false}={})=>{
    mark(col,{history:false});
    void updateRunning();
    if(redraw)render();
  };
  root.append(
    el("section",{class:"mock-card"},
      el("div",{class:"mock-server-head"},el("div",{},el("h2",{text:"Local Mock Proxy"}),running),
        el("div",{class:"mock-actions"},
          button("시작",async()=>{
            try{runtime=await api["mock-start"](config());setMessage("Mock 서버가 시작됐습니다.");await sync();}
            catch(e){setMessage(e.message);}
          },{class:"primary"}),
          button("중지",async()=>{
            try{runtime=await api["mock-stop"]();setMessage("Mock 서버를 중지했습니다.");await sync();}
            catch(e){setMessage(e.message);}
          })
        )
      ),
      el("div",{class:"mock-settings"},
        field("Local Port",input(local.port||4010,v=>{
          local.port=Number(v);address.textContent="http://127.0.0.1:"+v;change();
        },{type:"number",min:"1024",max:"65535"})),
        field("Upstream URL",input(upstream(),v=>{local.upstreams[col.id]=v;change();},
          {placeholder:"https://api.example.com",spellcheck:false})),
        field("Local URL",address)
      ),
      el("p",{class:"hint",text:"서버는 로컬(127.0.0.1)에서만 실행됩니다. 앱 재시작 후에는 수동으로 시작해야 합니다. 포트를 변경하려면 먼저 중지하세요."}),
      feedback
    ),
    el("section",{class:"mock-card"},
      el("div",{class:"mock-server-head"},el("h2",{text:"Endpoint Rules"}),
        button("+ 사용자 정의 경로",()=>{
          const existing=new Set(col.mock.rules.map(r=>r.method+" "+r.path));
          let path="/new-endpoint",n=1;
          while(existing.has("GET "+path))path="/new-endpoint-"+(++n);
          col.mock.rules.push({method:"GET",path,mode:"mock",status:200,responseMode:"custom",body:"{}"});
          change({redraw:true});
        })
      ),
      el("p",{class:"muted",text:"규칙이 없는 경로는 실제 API로 프록시합니다. 활성 Mock 규칙만 응답을 대체합니다."}),
      ...endpoints(col).map(({method,path,request})=>{
        let rule=col.mock.rules.find(r=>r.method===method&&r.path===path);
        const panel=el("div",{class:"mock-rule"});
        const title=el("code",{text:method+" "+path});
        const saveRule=(name,value)=>{
          if(!rule){
            rule={method,path,mode:"mock",status:200,responseMode:"generated"};
            col.mock.rules.push(rule);
          }
          rule[name]=value;change();
        };
        const chooser=select(rule?.mode||"proxy",[["proxy","Proxy"],["mock","Mock"]],v=>{
          saveRule("mode",v);render();
        },{"aria-label":method+" "+path+" mode"});
        const heading=el("div",{class:"mock-rule-head"},
          title,el("div",{class:"mock-actions"},chooser,
            rule&&!request?button("삭제",()=>{
              col.mock.rules=col.mock.rules.filter(x=>x!==rule);change({redraw:true});
            }):null
          )
        );
        panel.append(heading);
        if(rule?.mode==="mock"){
          const statusOptions=request?.responses?Object.keys(request.responses).filter(x=>/^[2-5]\d\d$/.test(x)):[];
          if(!statusOptions.includes(String(rule.status||200)))statusOptions.unshift(String(rule.status||200));
          const responseOptions=[["generated","스키마 생성"],["example","OpenAPI 예시"],["custom","직접 작성"]];
          const settings=el("div",{class:"mock-rule-settings"},
            field("HTTP Status",select(String(rule.status||200),statusOptions.map(x=>[x,x]),v=>{saveRule("status",Number(v));render();})),
            field("Response",select(rule.responseMode||"generated",responseOptions,v=>{saveRule("responseMode",v);render();}))
          );
          panel.append(settings);
          if(!request)panel.append(field("Path",input(rule.path,v=>{rule.path=v;change();},{spellcheck:false})));
          if(!request)panel.append(field("Method",select(rule.method,["GET","POST","PUT","PATCH","DELETE","HEAD"].map(x=>[x,x]),v=>{
            saveRule("method",v);render();
          })));
          if(rule.responseMode==="custom")panel.append(field("JSON Body",textarea(rule.body||"{}",v=>saveRule("body",v),{rows:6})));
          const details=el("pre",{class:"mock-preview",hidden:true});
          panel.append(button("응답 미리보기 · 검증",async()=>{
            try{
              const result=await api["mock-preview"](request,rule);
              details.textContent="HTTP "+result.status+"\nContent-Type: "+result.mediaType+"\n\n"+
                JSON.stringify(JSON.parse(result.body),null,2);
            }catch(e){details.textContent="검증 실패: "+e.message;}
            details.hidden=false;
          }),details);
        }
        return panel;
      })
    )
  );
  void sync();
  return root;
}
