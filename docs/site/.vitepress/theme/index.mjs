import DefaultTheme from 'vitepress/theme'
import LandingHome from './components/LandingHome.vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('LandingHome', LandingHome)
  }
}
