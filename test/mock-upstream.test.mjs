import {test} from "node:test";
import assert from "node:assert/strict";
import {mockServerConfig,mockUpstreamSetting,DEFAULT_MOCK_UPSTREAM} from "../src/ui/mock-upstream.mjs";

const collection={
  id:"col",requests:[],environments:[
    {id:"dev",name:"Development",values:{baseUrl:"https://dev.example.com"}},
    {id:"stage",name:"Staging",values:{baseUrl:"https://staging.example.com"}},
  ],defaultEnvironment:"dev"
};

test("new Mock Proxy uses the selected environment baseUrl placeholder without persisting overrides",()=>{
  const state={selectedEnvironments:{col:"stage"}};
  const config=mockServerConfig(state,collection);
  assert.equal(config.upstream,"{{baseUrl}}");
  assert.equal(config.environmentId,"stage");
  assert.equal(config.port,4010);
  assert.equal(DEFAULT_MOCK_UPSTREAM,"{{baseUrl}}");
  assert.equal(state.mockServer,undefined);
  assert.notEqual(config.collection,collection);
});

test("Mock Proxy upstream honors explicit overrides including disabled proxy",()=>{
  const state={mockServer:{port:4040,upstreams:{col:"https://custom.example.com"}}};
  assert.equal(mockServerConfig(state,collection).upstream,"https://custom.example.com");
  assert.equal(mockServerConfig(state,collection).environmentId,"dev");
  assert.equal(mockServerConfig(state,collection).port,4040);
  state.mockServer.upstreams.col="";
  assert.equal(mockUpstreamSetting(state,collection),"");
  assert.equal(mockServerConfig(state,collection).upstream,"");
});

test("unknown selected environment falls back to collection default",()=>{
  const state={selectedEnvironments:{col:"deleted"}};
  assert.equal(mockServerConfig(state,collection).environmentId,"dev");
});
