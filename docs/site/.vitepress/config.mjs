import { defineConfig } from 'vitepress'
import { BRAND_ICON_PATH, prepareBrandAssets } from './brand.mjs'
import { outlineLifecycleGuard } from './outline-lifecycle.mjs'

const base = '/free-rider/'
prepareBrandAssets()

export default defineConfig({
  title: 'Free Rider',
  base,
  lastUpdated: true,
  appearance: 'dark',
  cleanUrls: true,
  vite: { plugins: [outlineLifecycleGuard()] },
  head: [
    ['link', { rel: 'icon', type: 'image/png', href: `${base}${BRAND_ICON_PATH.slice(1)}` }],
    ['meta', { name: 'theme-color', content: '#0d0f10' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:url', content: 'https://dohyeon-kr.github.io/free-rider/' }],
    ['meta', { property: 'og:title', content: 'Free Rider — All-free Open Source API Client' }],
    ['meta', { property: 'og:description', content: 'All-free, open-source, local-first API client for requests, OpenAPI, Git and MCP.' }],
    ['meta', { property: 'og:image', content: 'https://dohyeon-kr.github.io/free-rider/free-rider-og.jpg' }],
    ['meta', { property: 'og:image:width', content: '1200' }],
    ['meta', { property: 'og:image:height', content: '630' }],
    ['meta', { property: 'og:image:type', content: 'image/jpeg' }],
    ['meta', { property: 'og:image:alt', content: 'Free Rider — Open-source API Client for Requests, OpenAPI, Git and MCP' }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:title', content: 'Free Rider — All-free Open Source API Client' }],
    ['meta', { name: 'twitter:description', content: 'All-free, open-source, local-first API client for requests, OpenAPI, Git and MCP.' }],
    ['meta', { name: 'twitter:image', content: 'https://dohyeon-kr.github.io/free-rider/free-rider-og.jpg' }],
    ['meta', { name: 'twitter:image:alt', content: 'Free Rider — Open-source API Client for Requests, OpenAPI, Git and MCP' }]
  ],
  locales: {
    root: {
      label: '한국어',
      lang: 'ko-KR',
      description: '모든 기능을 무료로 공개하는 오픈소스 로컬 우선 API 클라이언트',
      themeConfig: {
        nav: [
          { text: '사용 방법', link: '/guide/getting-started' },
          { text: 'API Reference', link: '/reference/script-api' },
          { text: '개발', link: '/development' },
          { text: '오픈소스', link: '/license' },
          { text: 'Releases', link: 'https://github.com/dohyeon-kr/free-rider/releases' }
        ],
        sidebar: {
          '/guide/': [
            {
              text: 'Guide',
              items: [
                { text: '시작하기', link: '/guide/getting-started' },
                { text: '요청과 저장', link: '/guide/requests' },
                { text: 'Environment, Vars, Interceptors', link: '/guide/variables-and-scripts' },
                { text: '컬렉션 실행', link: '/guide/collection-runner' },
                { text: 'OpenAPI 동기화', link: '/guide/openapi-sync' },
                { text: 'Git 연동', link: '/guide/git' },
                { text: 'MCP 서버', link: '/guide/mcp' }
              ]
            }
          ],
          '/reference/': [
            {
              text: 'API Reference',
              items: [
                { text: 'Script API', link: '/reference/script-api' },
                { text: 'Tests', link: '/reference/tests' },
                { text: '실행 규칙과 제한', link: '/reference/execution' }
              ]
            }
          ],
          '/development': [
            {
              text: 'Development',
              items: [
                { text: '개발과 문서 빌드', link: '/development' },
                { text: '오픈소스와 라이선스', link: '/license' },
                { text: '개발자 GitHub', link: 'https://github.com/dohyeon2' }
              ]
            }
          ],
          '/license': [
            {
              text: 'Open Source',
              items: [
                { text: '오픈소스와 라이선스', link: '/license' },
                { text: '개발과 문서 빌드', link: '/development' },
                { text: '개발자 GitHub', link: 'https://github.com/dohyeon2' }
              ]
            }
          ]
        },
        editLink: {
          pattern: 'https://github.com/dohyeon-kr/free-rider/edit/main/docs/site/:path',
          text: 'GitHub에서 이 페이지 수정'
        },
        docFooter: { prev: '이전', next: '다음' },
        lastUpdated: { text: '마지막 수정' },
        darkModeSwitchLabel: '테마',
        lightModeSwitchTitle: '라이트 테마로 전환',
        darkModeSwitchTitle: '다크 테마로 전환',
        sidebarMenuLabel: '메뉴',
        returnToTopLabel: '맨 위로',
        langMenuLabel: '언어 변경',
        navMenuLabel: '주요 탐색',
        mobileMenuLabel: '메뉴',
        extraMenuLabel: '더 보기',
        skipToContentLabel: '본문으로 건너뛰기'
      }
    },
    en: {
      label: 'English',
      lang: 'en-US',
      link: '/en/',
      description: 'An all-free, open-source, local-first API client that works without a server or account',
      themeConfig: {
        nav: [
          { text: 'Guide', link: '/en/guide/getting-started' },
          { text: 'API Reference', link: '/en/reference/script-api' },
          { text: 'Development', link: '/en/development' },
          { text: 'Open Source', link: '/en/license' },
          { text: 'Releases', link: 'https://github.com/dohyeon-kr/free-rider/releases' }
        ],
        sidebar: {
          '/en/guide/': [
            {
              text: 'Guide',
              items: [
                { text: 'Getting Started', link: '/en/guide/getting-started' },
                { text: 'Requests and Saving', link: '/en/guide/requests' },
                { text: 'Environment, Vars, Interceptors', link: '/en/guide/variables-and-scripts' },
                { text: 'Collection Runner', link: '/en/guide/collection-runner' },
                { text: 'OpenAPI Sync', link: '/en/guide/openapi-sync' },
                { text: 'Git Integration', link: '/en/guide/git' },
                { text: 'MCP Server', link: '/en/guide/mcp' }
              ]
            }
          ],
          '/en/reference/': [
            {
              text: 'API Reference',
              items: [
                { text: 'Script API', link: '/en/reference/script-api' },
                { text: 'Tests', link: '/en/reference/tests' },
                { text: 'Execution Rules and Limits', link: '/en/reference/execution' }
              ]
            }
          ],
          '/en/development': [
            {
              text: 'Development',
              items: [
                { text: 'Development and Docs Build', link: '/en/development' },
                { text: 'Open Source and License', link: '/en/license' },
                { text: 'Developer GitHub', link: 'https://github.com/dohyeon2' }
              ]
            }
          ],
          '/en/license': [
            {
              text: 'Open Source',
              items: [
                { text: 'Open Source and License', link: '/en/license' },
                { text: 'Development and Docs Build', link: '/en/development' },
                { text: 'Developer GitHub', link: 'https://github.com/dohyeon2' }
              ]
            }
          ]
        },
        editLink: {
          pattern: 'https://github.com/dohyeon-kr/free-rider/edit/main/docs/site/:path',
          text: 'Edit this page on GitHub'
        },
        docFooter: { prev: 'Previous', next: 'Next' },
        lastUpdated: { text: 'Last updated' },
        langMenuLabel: 'Change language'
      }
    }
  },
  themeConfig: {
    siteTitle: 'Free Rider',
    logo: { src: BRAND_ICON_PATH, alt: 'Free Rider' },
    search: { provider: 'local' },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/dohyeon-kr/free-rider', ariaLabel: 'Free Rider GitHub' },
      { icon: 'github', link: 'https://github.com/dohyeon2', ariaLabel: 'Developer GitHub' }
    ],
    outline: [2, 3],
    footer: {
      message: 'All free. Open source. AGPL-3.0-only.',
      copyright: 'Free Rider · Developer: <a href="https://github.com/dohyeon2" target="_blank" rel="noreferrer">@dohyeon2</a>'
    }
  }
})
