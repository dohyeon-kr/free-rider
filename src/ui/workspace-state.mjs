let liveState = null;

export function trackWorkspaceState(state) {
  liveState = state;
  return state;
}

export function getWorkspaceState() {
  if (!liveState) throw new Error("워크스페이스 상태가 아직 준비되지 않았습니다.");
  return liveState;
}

function replaceState(target, source) {
  for (const key of Object.keys(target)) delete target[key];
  Object.assign(target, structuredClone(source));
}

export async function commitWorkspaceMutation(mutator, persist) {
  const state = getWorkspaceState();
  const previous = structuredClone(state);
  try {
    mutator(state);
    await persist();
    return state;
  } catch (error) {
    replaceState(state, previous);
    throw error;
  }
}
