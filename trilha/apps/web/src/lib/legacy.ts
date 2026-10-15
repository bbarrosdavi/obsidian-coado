import { emptyState, type AppState } from '@coado/shared'
import { SUBJECT_COLORS } from './utils'
import { native } from './native'

/*
 * Antes da conta (quando o app ainda se chamava Rumo), tudo ficava no localStorage. Na primeira entrada oferecemos trazer
 * esses dados para a conta; depois a chave é renomeada para não perguntar de novo.
 */

const LEGACY_KEY = 'rumo:v1'
const MIGRATED_KEY = 'rumo:v1:migrado'
const THEME_KEY = 'coado:tema'
const PALETTE_KEY = 'coado:paleta'

/** Paleta usada antes da paleta âmbar; cores nela são trocadas pelas pastéis equivalentes */
const LEGACY_COLORS = [
  '#FEAEA5', '#FFB6C1', '#FFEDBB', '#B0EAEB', '#FF9999', '#FFDE87', '#B9ACBD', '#ABE0AC',
  '#E8BDFF', '#AFCAF9', '#9ED8C4', '#F7C59F', '#C3B1E1', '#A0C4FF', '#FDCB82', '#B5EAD7',
]

const migrateColors = (s: AppState): AppState => ({
  ...s,
  subjects: s.subjects.map((sub) => {
    const i = LEGACY_COLORS.indexOf(sub.color.toUpperCase())
    return i === -1 ? sub : { ...sub, color: SUBJECT_COLORS[i] }
  }),
})

export function readLegacyState(): AppState | null {
  try {
    const raw = localStorage.getItem(LEGACY_KEY)
    if (!raw) return null
    const parsed = { ...emptyState(), ...JSON.parse(raw) } as AppState
    if (!Array.isArray(parsed.plans) || !parsed.plans.length) return null
    return migrateColors(parsed)
  } catch {
    return null
  }
}

export function markLegacyMigrated() {
  try {
    const raw = localStorage.getItem(LEGACY_KEY)
    if (raw) localStorage.setItem(MIGRATED_KEY, raw)
    localStorage.removeItem(LEGACY_KEY)
  } catch {
    /* storage indisponível */
  }
}

/** Tema em cache para pintar a tela certa antes de os dados chegarem */
export function cachedTheme(): AppState['theme'] {
  try {
    const t = localStorage.getItem(THEME_KEY)
    return t === 'light' || t === 'dark' ? t : 'system'
  } catch {
    return 'system'
  }
}

export function cacheTheme(theme: AppState['theme']) {
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    /* ignore */
  }
}

export function applyTheme(theme: AppState['theme']) {
  const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
}

/**
 * Paleta de cores. É escolha de cada instância (este navegador, este aparelho) e não sincroniza pela
 * conta: fica só no localStorage. `cafe` é o id interno da original (âmbar); fica assim para não invalidar a escolha já salva.
 */
export type Palette = 'cafe' | 'grafite' | 'oceano' | 'floresta' | 'ameixa' | 'magenta'

const PALETTES: Palette[] = ['cafe', 'grafite', 'oceano', 'floresta', 'ameixa', 'magenta']

/** Paleta salva nesta instância (a original, se não houver) */
export function cachedPalette(): Palette {
  try {
    const p = localStorage.getItem(PALETTE_KEY) as Palette | null
    return p && PALETTES.includes(p) ? p : 'cafe'
  } catch {
    return 'cafe'
  }
}

export function cachePalette(palette: Palette) {
  try {
    localStorage.setItem(PALETTE_KEY, palette)
  } catch {
    /* ignore */
  }
}

/** Troca e guarda a paleta desta instância */
export function choosePalette(palette: Palette) {
  cachePalette(palette)
  applyPalette(palette)
}

/** A paleta troca só as variáveis de cor (index.css, `:root[data-palette=…]`); a original não marca nada */
export function applyPalette(palette: Palette) {
  const root = document.documentElement
  if (!palette || palette === 'cafe') delete root.dataset.palette
  else root.dataset.palette = palette
  native()?.setPalette?.(palette || 'cafe')
}
