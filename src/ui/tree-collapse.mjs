function addFolderPath(ids, collectionId, path) {
  let current = "";
  for (const part of String(path || "").split("/").filter(Boolean)) {
    current = current ? current + "/" + part : part;
    ids.add(collectionId + ":" + current);
  }
}

export function collapsibleTreeIds(collections = []) {
  const ids = new Set();
  for (const col of collections) {
    if (!col?.id) continue;
    ids.add(col.id);
    for (const folder of col.folders || []) addFolderPath(ids, col.id, folder.path);
    for (const request of col.requests || []) addFolderPath(ids, col.id, request.group);
  }
  return ids;
}

export function isTreeFullyCollapsed(collections, collapsed) {
  const ids = collapsibleTreeIds(collections);
  return ids.size > 0 && [...ids].every((id) => collapsed.has(id));
}

export function collapseEntireTree(collections, collapsed) {
  for (const id of collapsibleTreeIds(collections)) collapsed.add(id);
  return collapsed;
}

export function expandEntireTree(collapsed) {
  collapsed.clear();
  return collapsed;
}
