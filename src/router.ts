import { signal } from "@preact/signals"

// 简单路由状态
export type Page = 'home' | 'chat' | 'settings' | 'friend-detail'

export const currentPage = signal<Page>('home')
export const routeParams = signal<Record<string, string>>({})

// 导航
export function navigate(page: Page, params: Record<string, string> = {}) {
  currentPage.value = page
  routeParams.value = params
  // 更新 URL
  const url = params.id ? `#/${page}/${params.id}` : `#/${page}`
  history.pushState(null, '', url)
}

// 初始化路由
export function initRouter() {
  const hash = window.location.hash.slice(2) || 'home'
  const parts = hash.split('/')
  const page = parts[0] as Page
  const id = parts[1]
  
  currentPage.value = ['home', 'chat', 'settings', 'friend-detail'].includes(page) ? page : 'home'
  routeParams.value = id ? { id } : {}

  // 监听后退
  window.addEventListener('popstate', () => {
    const h = window.location.hash.slice(2) || 'home'
    const p = h.split('/')[0] as Page
    const i = h.split('/')[1]
    currentPage.value = ['home', 'chat', 'settings', 'friend-detail'].includes(p) ? p : 'home'
    routeParams.value = i ? { id: i } : {}
  })
}
