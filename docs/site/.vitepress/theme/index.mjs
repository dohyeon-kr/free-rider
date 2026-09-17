import DefaultTheme from 'vitepress/theme'
import LandingHome from './components/InteractiveLanding.vue'
import McpHandoffPrompt from './components/McpHandoffPrompt.vue'
import RendererDemo from './components/RendererDemo.vue'
import './custom.css'
import './landing-dark.css'
import './typography.css'
import './brand.css'

function applyLandingHeroCopy() {
  const title = document.querySelector('.landing .hero h1')
  if (!title || title.dataset.freeRiderCopy === 'true') return

  title.innerHTML = 'Ride on your API<br><span>for Free</span>'
  title.dataset.freeRiderCopy = 'true'
}

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('LandingHome', LandingHome)
    app.component('McpHandoffPrompt', McpHandoffPrompt)
    app.component('RendererDemo', RendererDemo)

    if (typeof window !== 'undefined') {
      app.mixin({
        mounted() {
          queueMicrotask(applyLandingHeroCopy)
        }
      })
    }
  }
}
