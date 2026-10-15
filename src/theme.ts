export type AppTheme = 'dark' | 'light'

export const THEME_KEY = 'iyge-v2-theme'

export function readTheme(): AppTheme {
  try {
    return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

export function applyTheme(theme: AppTheme) {
  const root = document.documentElement
  root.dataset.theme = theme
  root.classList.toggle('dark', theme === 'dark')
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    // 偏好写不进去时仍切换当前画面
  }
}
