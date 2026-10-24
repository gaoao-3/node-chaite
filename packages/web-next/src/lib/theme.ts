export interface ThemeOption {
  id: string
  label: string
  scheme: 'dark' | 'light' | null
  wide?: boolean
  description: string
}

export const THEME_OPTIONS: ThemeOption[] = [
  { id: 'auto', label: '跟随系统', scheme: null, wide: true, description: '自动根据操作系统匹配深浅模式' },
  // 浅色主题组 (5个，各占 3 列，共 15 列)
  { id: 'light', label: '纯白', scheme: 'light', wide: false, description: '纯净高亮，克莱因蓝高光' },
  { id: 'mist', label: '薄雾', scheme: 'light', wide: false, description: '清爽薄荷青绿，漫反射护眼' },
  { id: 'lilac', label: '丁香', scheme: 'light', wide: false, description: '雅致薰衣草紫调，柔和明丽' },
  { id: 'sand', label: '素纸', scheme: 'light', wide: false, description: '经典暖黄米纸质感，书籍沉浸' },
  { id: 'rose', label: '淡樱', scheme: 'light', wide: false, description: '温润樱花粉调，柔美细腻' },
  // 深色主题组 (5个，各占 3 列，共 15 列)
  { id: 'slate', label: '石板', scheme: 'dark', wide: false, description: '高级青灰冷调，极客首选' },
  { id: 'dark', label: '暗黑', scheme: 'dark', wide: false, description: '炭黑高对比度，标准工程夜间' },
  { id: 'pine', label: '冷杉', scheme: 'dark', wide: false, description: '墨绿冷调森林，护眼沉静' },
  { id: 'dusk', label: '暮色', scheme: 'dark', wide: false, description: '静谧暮霭夜色，淡雅紫调' },
  { id: 'ember', label: '余烬', scheme: 'dark', wide: false, description: '暖色炭火余温，温暖沉稳' },
  // 特别定制组 (3个，各占 5 列，共 15 列)
  { id: 'kaiyi', label: '天童凯伊 (粉)', scheme: 'dark', wide: true, description: '专属绀青深蓝与樱花粉点缀' },
  { id: 'cyber', label: '赛博翠绿', scheme: 'dark', wide: true, description: '纯黑极客底色与霓虹荧光绿' },
  { id: 'midnight', label: '纯黑极客', scheme: 'dark', wide: true, description: 'OLED 极黑与冰蓝点缀' },
]

export function applyTheme(themeId: string) {
  if (typeof window === 'undefined') return
  const root = document.documentElement
  let resolvedId = themeId
  if (resolvedId === 'auto') {
    resolvedId = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'slate' : 'light'
  }
  const theme = THEME_OPTIONS.find(t => t.id === resolvedId) || THEME_OPTIONS[6] // slate
  root.dataset.theme = resolvedId
  root.classList.toggle('dark', theme.scheme !== 'light')
  try {
    localStorage.setItem('chaite.theme', themeId)
  } catch {}
}
