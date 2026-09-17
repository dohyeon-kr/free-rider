import { trackWorkspaceState } from "./workspace-state.mjs";

export class RequestDrafts {
  entries = new Map();
  key(cid, id) { return JSON.stringify([cid, id]); }
  get(cid, request) {
    const key = this.key(cid, request.id);
    if (!this.entries.has(key)) this.entries.set(key, structuredClone(request));
    return this.entries.get(key);
  }
  changed(cid, request) {
    const value = this.entries.get(this.key(cid, request.id));
    return !!value && JSON.stringify(value) !== JSON.stringify(request);
  }
  discard(cid, id) { this.entries.delete(this.key(cid, id)); }
  snapshot(state, only = null) {
    trackWorkspaceState(state);
    const next = structuredClone(state);
    for (const col of next.collections)
      col.requests = col.requests.map(request => {
        if (only && (only.cid !== col.id || only.id !== request.id)) return request;
        return structuredClone(this.entries.get(this.key(col.id, request.id)) || request);
      });
    return next;
  }
}
