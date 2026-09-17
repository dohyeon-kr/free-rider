import {el,button} from "./dom.js";
export function reviewView(review,onApply) {
  const root=el("section",{class:"sync-review"});
  const selected=new Set(review.changes.filter(c=>c.type!=="removed").map(c=>c.id)), choices={};
  const apply=button("선택 반영",()=>onApply([...selected],choices),{class:"primary",id:"applySyncSelection"});
  const summary=el("p",{class:"hint","aria-live":"polite"});
  function update() {
    const blocked=review.changes.some(c=>selected.has(c.id)&&c.fields.some(f=>f.conflict&&!choices[JSON.stringify([c.id,f.key])]));
    apply.disabled=!selected.size||blocked;
    summary.textContent=selected.size+"개 선택"+(blocked?" · 충돌 처리 방식을 선택하세요.":"");
  }
  root.append(el("h2",{text:"명세 변경 검토"}));
  if(review.breakingCount) root.append(el("div",{class:"sync-row"},el("div",{},
    el("strong",{class:"danger",text:`Breaking Change ${review.breakingCount}개 감지`}),
    el("p",{class:"hint",text:"호환성을 깨뜨릴 수 있는 변경입니다. 이유를 확인한 뒤 필요한 항목만 반영하세요."}))));
  if(!review.changes.length) root.append(el("p",{text:"명세 변경이 없습니다."}));
  for(const change of review.changes) {
    const conflicts=change.fields.filter(f=>f.conflict), breaking=change.breakingReasons || [];
    const check=el("input",{type:"checkbox",checked:selected.has(change.id),"aria-label":change.id+" 반영",
      onChange:e=>{e.target.checked?selected.add(change.id):selected.delete(change.id);update();}});
    const details=el("details",{class:"sync-change"});
    const breakingBadge=el("span",{class:"sync-conflict",text:breaking.length?"BREAKING "+breaking.length:""});
    const badge=el("span",{class:"sync-conflict",text:conflicts.length?"충돌 "+conflicts.length+"개":""});
    details.append(el("summary",{},change.id+" · "+({added:"추가",updated:"수정",removed:"삭제"}[change.type]),breakingBadge,badge));
    if(breaking.length) details.append(el("div",{class:"sync-field"},
      el("strong",{class:"danger",text:"호환성 영향"}),
      el("ul",{},...breaking.map(reason=>el("li",{text:reason.message})))));
    for(const field of change.fields) {
      const block=el("div",{class:"sync-field"},el("strong",{text:field.key}));
      const pretty=v=>v===undefined?"(없음)":typeof v==="string"?v:JSON.stringify(v,null,2);
      block.append(el("div",{class:"sync-values"},...[
        ["이전 명세",field.before],["현재 요청",field.local],["새 명세",field.incoming]
      ].map(([title,value])=>el("div",{},el("small",{text:title}),el("pre",{text:pretty(value)})))));
      if(field.conflict) {
        const picker=el("select",{"aria-label":field.key+" 충돌 해결",onChange:e=>{
          const key=JSON.stringify([change.id,field.key]);choices[key]=e.target.value;
          const pending=conflicts.filter(f=>!choices[JSON.stringify([change.id,f.key])]).length;
          badge.textContent=pending?"충돌 "+pending+"개":"해결됨";update();
        }},el("option",{value:"",text:"처리 방식 선택"}),el("option",{value:"local",text:"현재 값 유지"}),el("option",{value:"incoming",text:"명세 값 반영"}));
        block.append(picker);
      }
      details.append(block);
    }
    if(change.type!=="updated") details.append(el("pre",{text:JSON.stringify(change.incoming||change.local,null,2)}));
    root.append(el("div",{class:"sync-row"},check,details));
  }
  root.append(summary,apply);update();return root;
}
