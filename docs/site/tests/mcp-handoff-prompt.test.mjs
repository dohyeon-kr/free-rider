import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  MCP_HANDOFF_PROMPTS,
  getMcpHandoffPrompt,
  resolveMcpHandoffLocale
} from '../.vitepress/theme/components/mcp-handoff-prompts.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8')

test('localized prompts preserve the documented Free Rider MCP connection details', () => {
  for (const prompt of Object.values(MCP_HANDOFF_PROMPTS)) {
    assert.match(prompt, /free-rider/)
    assert.match(prompt, /Streamable HTTP/)
    assert.match(prompt, /http:\/\/127\.0\.0\.1:48173\/mcp/)
    assert.match(prompt, /list_collections/)
  }

  assert.match(MCP_HANDOFF_PROMPTS.ko, /set_collection_interceptors/)
  assert.match(MCP_HANDOFF_PROMPTS.ko, /연결 테스트만을 위해 send_request나 set_collection_interceptors를 실행하지 않는다/)
  assert.match(MCP_HANDOFF_PROMPTS.en, /Do not call send_request only to test the connection/)
})

test('locale resolution selects English only for English locales', () => {
  assert.equal(resolveMcpHandoffLocale('ko-KR'), 'ko')
  assert.equal(resolveMcpHandoffLocale('en-US'), 'en')
  assert.equal(resolveMcpHandoffLocale('en'), 'en')
  assert.equal(getMcpHandoffPrompt('en-US'), MCP_HANDOFF_PROMPTS.en)
  assert.equal(getMcpHandoffPrompt('ko-KR'), MCP_HANDOFF_PROMPTS.ko)
})

test('both MCP guides render the shared prompt component', () => {
  assert.match(read('guide/mcp.md'), /<McpHandoffPrompt locale="ko" \/>/)
  assert.match(read('en/guide/mcp.md'), /<McpHandoffPrompt locale="en" \/>/)
})

test('landing replaces the demo conversation with the shared prompt', () => {
  const landing = read('.vitepress/theme/components/InteractiveLanding.vue')
  assert.match(landing, /\.mcp-demo \.terminal > div/)
  assert.match(landing, /<McpHandoffPrompt variant="terminal" \/>/)

  const theme = read('.vitepress/theme/index.mjs')
  assert.match(theme, /app\.component\('McpHandoffPrompt', McpHandoffPrompt\)/)
})
