import { useCallback, useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import type { AppState } from '@coado/shared'
import { AuthProvider, useAuth } from './lib/auth'
import { api, ApiError } from './lib/api'
import { StoreProvider } from './lib/store'
import { Layout } from './components/Layout'
import { LoadingScreen } from './components/LoadingScreen'
import { WelcomeProvider } from './components/welcome/Welcome'
import LoginPage from './pages/Login'
import Home from './pages/Home'
import Plans from './pages/Plans'
import Subjects from './pages/Subjects'
import Edital from './pages/Edital'
import PlanningPage from './pages/Planning'
import Reviews from './pages/Reviews'
import HistoryPage from './pages/History'
import Statistics from './pages/Statistics'
import Exams from './pages/Exams'
import Assessments from './pages/Assessments'
import FilesPage from './pages/Files'
import ProfilePage from './pages/Profile'
import SettingsPage from './pages/Settings'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Gate />
      </BrowserRouter>
    </AuthProvider>
  )
}

/** Decide entre carregamento, tela de entrada e o app */
function Gate() {
  const { state } = useAuth()
  if (state.status === 'loading') return <LoadingScreen />
  if (state.status === 'anonymous') return <LoginPage config={state.config} reason={state.reason} />
  return <AccountApp key={state.me.id} />
}

/** Baixa os dados da conta e monta o app em cima deles */
function AccountApp() {
  const { expire } = useAuth()
  const [data, setData] = useState<AppState | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setError(null)
    api
      .get<AppState>('/state')
      .then(setData)
      .catch((e: unknown) => {
        if (e instanceof ApiError && e.status === 401) expire()
        else setError(e instanceof ApiError ? e.message : 'Não foi possível carregar seus dados.')
      })
  }, [expire])

  useEffect(load, [load])

  if (!data) return <LoadingScreen error={error} onRetry={load} />

  return (
    <StoreProvider initial={data} onUnauthorized={expire}>
      <WelcomeProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="planos" element={<Plans />} />
            <Route path="disciplinas" element={<Subjects />} />
            <Route path="edital" element={<Edital />} />
            <Route path="planejamento" element={<PlanningPage />} />
            <Route path="revisoes" element={<Reviews />} />
            <Route path="historico" element={<HistoryPage />} />
            <Route path="estatisticas" element={<Statistics />} />
            <Route path="simulados" element={<Exams />} />
            <Route path="avaliacoes" element={<Assessments />} />
            <Route path="arquivos" element={<FilesPage />} />
            <Route path="perfil" element={<ProfilePage />} />
            <Route path="configuracoes" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </WelcomeProvider>
    </StoreProvider>
  )
}
