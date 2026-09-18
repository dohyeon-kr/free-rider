function isHttpRequest(request) {
  return !request?.type || request.type === "http";
}

export function runPlan(col) {
  const httpRequests = col.requests.filter(isHttpRequest);
  if (!Array.isArray(col.runPlan)) col.runPlan = httpRequests.map(r => ({id:r.id, enabled:false}));
  const valid = new Set(httpRequests.map(r => r.id)), seen = new Set();
  col.runPlan = col.runPlan.filter(item => {
    if (!valid.has(item.id) || seen.has(item.id)) return false;
    seen.add(item.id); return true;
  });
  return col.runPlan;
}
export function addToRun(col, ids) {
  const plan = runPlan(col), existing = new Set(plan.map(x => x.id));
  for (const id of ids)
    if (!existing.has(id) && col.requests.some(r => r.id === id && isHttpRequest(r))) {
      plan.push({id, enabled:true}); existing.add(id);
    }
}
export function executionRequests(col) {
  return runPlan(col)
    .filter(x => x.enabled)
    .map(x => col.requests.find(r => r.id === x.id))
    .filter(isHttpRequest)
    .map(r => structuredClone(r));
}
