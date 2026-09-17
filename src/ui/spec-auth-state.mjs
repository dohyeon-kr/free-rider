// Deliberately kept outside collection/workspace state: never exported or saved.
export class SpecAuthSession {
  #entries = new Map();

  get(collectionId, source) {
    const entry = this.#entries.get(collectionId);
    if (!entry || entry.source !== String(source || "").trim()) {
      this.clear(collectionId);
      return { type: "none" };
    }
    return structuredClone(entry.auth);
  }

  set(collectionId, source, auth) {
    if (auth?.type !== "basic") return this.clear(collectionId);
    this.#entries.set(collectionId, {
      source: String(source || "").trim(),
      auth: { type: "basic", username: auth.username, password: auth.password },
    });
  }

  clear(collectionId) {
    this.#entries.delete(collectionId);
  }
}
