import assert from 'node:assert/strict'
import { test } from 'node:test'
import { watchRailActivity } from '../.vitepress/theme/components/rail-activity.mjs'

function browser() {
  const doc = new EventTarget()
  doc.hidden = false
  const media = new EventTarget()
  media.matches = false
  let observer
  class Observer {
    constructor(callback) { this.callback = callback; observer = this }
    observe(element) { this.element = element }
    disconnect() { this.disconnected = true }
  }
  return { doc, media, Observer, matchMedia: () => media, get observer() { return observer } }
}

test('SSR and missing elements stay still without browser globals', () => {
  const states = []
  const stop = watchRailActivity(null, value => states.push(value), {})
  assert.deepEqual(states, [false])
  assert.doesNotThrow(stop)
})

test('rail starts only when it intersects the viewport', () => {
  const env = browser(), element = {}, states = []
  const stop = watchRailActivity(element, value => states.push(value), env)
  assert.deepEqual(states, [false])
  assert.equal(env.observer.element, element)
  env.observer.callback([{ target: element, isIntersecting: true }])
  assert.equal(states.at(-1), true)
  env.observer.callback([{ target: element, isIntersecting: false }])
  assert.equal(states.at(-1), false)
  stop()
})

test('hidden tabs suspend motion and resume only if still in view', () => {
  const env = browser(), element = {}, states = []
  const stop = watchRailActivity(element, value => states.push(value), env)
  env.observer.callback([{ target: element, isIntersecting: true }])
  env.doc.hidden = true
  env.doc.dispatchEvent(new Event('visibilitychange'))
  assert.equal(states.at(-1), false)
  env.doc.hidden = false
  env.doc.dispatchEvent(new Event('visibilitychange'))
  assert.equal(states.at(-1), true)
  env.observer.callback([{ target: element, isIntersecting: false }])
  env.doc.dispatchEvent(new Event('visibilitychange'))
  assert.equal(states.at(-1), false)
  stop()
})

test('reduced-motion preference is respected on load and when changed', () => {
  const env = browser(), element = {}, states = []
  env.media.matches = true
  const stop = watchRailActivity(element, value => states.push(value), env)
  env.observer.callback([{ target: element, isIntersecting: true }])
  assert.equal(states.at(-1), false)
  env.media.matches = false
  env.media.dispatchEvent(new Event('change'))
  assert.equal(states.at(-1), true)
  env.media.matches = true
  env.media.dispatchEvent(new Event('change'))
  assert.equal(states.at(-1), false)
  stop()
})

test('older browsers without IntersectionObserver still honor visibility', () => {
  const env = browser(), states = []
  const stop = watchRailActivity({}, value => states.push(value), { ...env, Observer: undefined })
  assert.equal(states.at(-1), true)
  env.doc.hidden = true
  env.doc.dispatchEvent(new Event('visibilitychange'))
  assert.equal(states.at(-1), false)
  stop()
})

test('unmount removes listeners, disconnects and ignores pending callbacks', () => {
  const env = browser(), element = {}, states = []
  const stop = watchRailActivity(element, value => states.push(value), env)
  stop()
  const count = states.length
  env.doc.dispatchEvent(new Event('visibilitychange'))
  env.media.dispatchEvent(new Event('change'))
  env.observer.callback([{ target: element, isIntersecting: true }])
  assert.equal(env.observer.disconnected, true)
  assert.equal(states.length, count)
  assert.doesNotThrow(stop)
})
