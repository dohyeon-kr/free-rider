import { defineConfig } from 'vitepress'

export default defineConfig({
  lang: 'ko-KR',
  title: 'Free Rider',
  description: '서버와 계정 없이 사용하는 로컬 우선 API 클라이언트',
  base: '/free-rider/',
  lastUpdated: true,
  appearance: 'dark',
  cleanUrls: true,
  head: [
    ['meta', { name: 'theme-color', content: '#151515' }],
    ['meta', { property: 'og:title', content: 'Free Rider Docs' }],
    ['meta', { property: 'og:description', content: 'Local-first, Git-friendly API client documentation' }]
  ],
  themeConfig: {
    siteTitle: 'Free Rider',
    search: { provider: 'local' },
    nav: [
      { text: '사용 방법', link: '/guide/getting-started' },
      { text: 'API Reference', link: '/reference/script-api' },
      { text: '개발', link: '/development' },
      { text: 'Releases', link: 'https://github.com/dohyeon-kr/free-rider/releases' }
    ],
    sidebar: {
      '/guide/': [
        {
          text: 'Guide',
          items: [
            { text: '시작하기', link: '/guide/getting-started' },
            { text: '요청과 저장', link: '/guide/requests' },
            { text: 'Environment와 Vars', link: '/guide/variables-and-scripts' },
            { text: '컬렉션 실행', link: '/guide/collection-runner' },
            { text: 'OpenAPI 동기화', link: '/guide/openapi-sync' },
            { text: 'Git 연동', link: '/guide/git' }
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
          items: [{ text: '개발과 문서 빌드', link: '/development' }]
        }
      ]
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/dohyeon-kr/free-rider' }
    ],
    editLink: {
      pattern: 'https://github.com/dohyeon-kr/free-rider/edit/main/docs/site/:path',
      text: 'GitHub에서 이 페이지 수정'
    },
    outline: [2, 3],
    docFooter: {
      prev: '이전',
      next: '다음'
    },
    lastUpdated: {
      text: '마지막 수정'
    },
    footer: {
      message: 'Local-first. Git-friendly. No account required.',
      copyright: 'Free Rider'
    }
  }
})
