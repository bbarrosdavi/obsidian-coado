import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { applyPalette, applyTheme, cachedPalette, cachedTheme } from './lib/legacy'
import { BRAND } from './lib/brand'

document.title = `${BRAND}: ciclo de estudos, revisões e progresso`

// pinta com o último tema usado enquanto a conta carrega; a paleta é desta instância e não depende da conta
applyTheme(cachedTheme())
applyPalette(cachedPalette())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
