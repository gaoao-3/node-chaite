export interface ThemeOption {
  id: string
  label: string
  scheme: 'dark' | 'light'
  bg: string
  panel: string
  accent: string
  description: string
}

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'slate',
    label: '石板冷灰',
    scheme: 'dark',
    bg: '#090a0f',
    panel: '#10121a',
    accent: '#38bdf8',
    description: '现代极简冷灰，干净通透 (推荐)',
  },
  {
    id: 'dark',
    label: '暗黑经典',
    scheme: 'dark',
    bg: '#09090b',
    panel: '#121215',
    accent: '#60a5fa',
    description: '标准炭黑高对比度，久看舒适',
  },
  {
    id: 'midnight',
    label: '纯黑极客',
    scheme: 'dark',
    bg: '#090a0f',
    panel: '#11131c',
    accent: '#818cf8',
    description: '深邃 OLED 纯黑，极客之选',
  },
  {
    id: 'cyber',
    label: '赛博翠绿',
    scheme: 'dark',
    bg: '#080c10',
    panel: '#0d131a',
    accent: '#10b981',
    description: '终端黑客风，霓虹翠绿高光',
  },
  {
    id: 'kaiyi',
    label: '天童凯伊',
    scheme: 'dark',
    bg: '#0b0f19',
    panel: '#131926',
    accent: '#f472b6',
    description: '专属绀青深蓝与樱花粉点缀',
  },
  {
    id: 'dusk',
    label: '暮色霞光',
    scheme: 'dark',
    bg: '#1e1a24',
    panel: '#26212e',
    accent: '#cdb4f0',
    description: '静谧暮霭夜色，淡雅紫调',
  },
  {
    id: 'pine',
    label: '北欧冷杉',
    scheme: 'dark',
    bg: '#19201f',
    panel: '#212b28',
    accent: '#34d399',
    description: '墨绿冷调森林，护眼沉静',
  },
  {
    id: 'light',
    label: '纯净浅白',
    scheme: 'light',
    bg: '#f8fafc',
    panel: '#ffffff',
    accent: '#2563eb',
    description: '明亮通透，iOS / macOS 风格',
  },
  {
    id: 'mist',
    label: '薄雾霜灰',
    scheme: 'light',
    bg: '#f4f6f8',
    panel: '#ffffff',
    accent: '#0d9488',
    description: '柔和漫反射灰白，轻盈不刺眼',
  },
  {
    id: 'sand',
    label: '暖调素纸',
    scheme: 'light',
    bg: '#faf7f2',
    panel: '#ffffff',
    accent: '#d97706',
    description: '书籍暖调米纸质感，阅读舒适',
  },
  {
    id: 'rose',
    label: '薄粉淡樱',
    scheme: 'light',
    bg: '#fff5f7',
    panel: '#ffffff',
    accent: '#e11d48',
    description: '柔美樱粉质感，温润细腻',
  },
]

export function applyTheme(themeId: string) {
  if (typeof window === 'undefined') return
  const root = document.documentElement
  const theme = THEME_OPTIONS.find(t => t.id === themeId) || THEME_OPTIONS[0]
  root.dataset.theme = theme.id
  root.classList.toggle('dark', theme.scheme === 'dark')
  try {
    localStorage.setItem('chaite.theme', theme.id)
  } catch {}
}
