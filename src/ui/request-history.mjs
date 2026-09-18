const clone = (value) => structuredClone(value);
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);

export class RequestHistory {
  constructor({ limit = 100, coalesceMs = 700 } = {}) {
    this.limit = Math.max(2, limit);
    this.coalesceMs = Math.max(0, coalesceMs);
    this.entries = new Map();
  }

  key(collectionId, requestId) {
    return JSON.stringify([collectionId, requestId]);
  }

  ensure(collectionId, requestId, value) {
    const key = this.key(collectionId, requestId);
    if (!this.entries.has(key)) {
      this.entries.set(key, {
        past: [clone(value)],
        future: [],
        group: null,
        at: 0,
      });
    }
    return this.entries.get(key);
  }

  record(collectionId, requestId, value, { group = null, at = Date.now() } = {}) {
    const entry = this.ensure(collectionId, requestId, value);
    const next = clone(value);
    const current = entry.past.at(-1);
    if (same(current, next)) return false;

    const coalescing =
      group &&
      entry.group === group &&
      at - entry.at <= this.coalesceMs &&
      entry.past.length > 1;

    if (coalescing) entry.past[entry.past.length - 1] = next;
    else entry.past.push(next);

    if (entry.past.length > this.limit)
      entry.past.splice(0, entry.past.length - this.limit);

    entry.future.length = 0;
    entry.group = group;
    entry.at = at;
    return true;
  }

  undo(collectionId, requestId, value) {
    const entry = this.ensure(collectionId, requestId, value);
    const current = clone(value);
    if (!same(entry.past.at(-1), current)) entry.past.push(current);
    if (entry.past.length < 2) return null;

    entry.future.push(entry.past.pop());
    entry.group = null;
    entry.at = 0;
    return clone(entry.past.at(-1));
  }

  redo(collectionId, requestId, value) {
    const entry = this.ensure(collectionId, requestId, value);
    if (!entry.future.length) return null;

    const current = clone(value);
    if (!same(entry.past.at(-1), current)) {
      entry.past.push(current);
      entry.future.length = 0;
      entry.group = null;
      entry.at = 0;
      return null;
    }

    const next = entry.future.pop();
    entry.past.push(clone(next));
    entry.group = null;
    entry.at = 0;
    return clone(next);
  }

  discard(collectionId, requestId) {
    this.entries.delete(this.key(collectionId, requestId));
  }

  discardCollection(collectionId) {
    for (const [key] of this.entries) {
      const [cid] = JSON.parse(key);
      if (cid === collectionId) this.entries.delete(key);
    }
  }
}
