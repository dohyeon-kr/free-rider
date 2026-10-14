export const DEFAULT_MOCK_UPSTREAM = "{{baseUrl}}";

export function mockUpstreamSetting(state, collection) {
  return state.mockServer?.upstreams?.[collection.id] ?? DEFAULT_MOCK_UPSTREAM;
}

export function mockServerConfig(state, collection) {
  const selectedId = state.selectedEnvironments?.[collection.id];
  const environment =
    collection.environments?.find((item) => item.id === selectedId) ||
    collection.environments?.find((item) => item.id === collection.defaultEnvironment) ||
    collection.environments?.[0];

  return {
    port: Number(state.mockServer?.port || 4010),
    upstream: mockUpstreamSetting(state, collection),
    environmentId: environment?.id,
    collection: structuredClone(collection),
  };
}
