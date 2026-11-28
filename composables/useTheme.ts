export type ThemeChoice = 'light' | 'dark'

const STORAGE_KEY = 'cloud-seller-theme'

/**
 * Tema do site. Sem escolha salva, segue a preferência do sistema (CSS via prefers-color-scheme).
 * Ao clicar no botão, a escolha vira explícita (data-theme no <html>) e fica salva no navegador.
 */
export function useTheme() {
  const theme = useState<ThemeChoice>('theme', () => 'light')

  function systemPrefersDark() {
    return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
  }

  function apply(value: ThemeChoice) {
    theme.value = value
    document.documentElement.setAttribute('data-theme', value)
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', value === 'dark' ? '#0b121c' : '#f4f7fb')
  }

  function init() {
    let saved: string | null = null
    try { saved = localStorage.getItem(STORAGE_KEY) } catch { /* armazenamento indisponível */ }
    apply(saved === 'dark' || saved === 'light' ? saved : (systemPrefersDark() ? 'dark' : 'light'))
  }

  function toggle() {
    const next: ThemeChoice = theme.value === 'dark' ? 'light' : 'dark'
    apply(next)
    try { localStorage.setItem(STORAGE_KEY, next) } catch { /* ignora */ }
  }

  return { theme, init, toggle }
}
