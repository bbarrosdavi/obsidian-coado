import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { AuthConfig, Me, ProfilePatch } from '@coado/shared'
import { api, ApiError } from './api'
import { native } from './native'

type AuthState =
  | { status: 'loading' }
  | { status: 'anonymous'; config: AuthConfig | null; reason?: 'expired' | 'offline' }
  | { status: 'authenticated'; me: Me }

interface Auth {
  state: AuthState
  /** usuário logado (lança fora de rotas autenticadas) */
  me: Me | null
  signInWithGoogle: (returnTo?: string) => void
  devLogin: (name?: string) => Promise<void>
  logout: () => Promise<void>
  updateProfile: (patch: ProfilePatch) => Promise<Me>
  deleteAccount: () => Promise<void>
  /** sessão recusada pela api no meio do uso */
  expire: () => void
  reload: () => void
}

const Ctx = createContext<Auth | null>(null)

const loadConfig = () => api.get<AuthConfig>('/auth/config').catch(() => null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' })

  const load = useCallback(async () => {
    try {
      const me = await api.get<Me>('/me')
      setState({ status: 'authenticated', me })
    } catch (e) {
      const offline = e instanceof ApiError && e.offline
      setState({ status: 'anonymous', config: await loadConfig(), reason: offline ? 'offline' : undefined })
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // dentro do app Android: a sessão da WebView é renovada (ou o login nativo reaparece) por ele
  useEffect(() => {
    native()?.authChanged(state.status)
  }, [state.status])

  const value = useMemo<Auth>(() => {
    const toAnonymous = async (reason?: 'expired') =>
      setState({ status: 'anonymous', config: await loadConfig(), reason })

    return {
      state,
      me: state.status === 'authenticated' ? state.me : null,
      signInWithGoogle: (returnTo = window.location.pathname) => {
        window.location.assign(`/api/auth/google?returnTo=${encodeURIComponent(returnTo)}`)
      },
      devLogin: async (name) => {
        await api.post('/auth/dev', name ? { name } : {})
        await load()
      },
      logout: async () => {
        await api.post('/auth/logout').catch(() => undefined)
        await toAnonymous()
      },
      updateProfile: async (patch) => {
        const me = await api.patch<Me>('/me', patch)
        setState({ status: 'authenticated', me })
        return me
      },
      deleteAccount: async () => {
        await api.delete('/me')
        await toAnonymous()
      },
      expire: () => void toAnonymous('expired'),
      reload: () => void load(),
    }
  }, [state, load])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth fora do AuthProvider')
  return ctx
}

/** Usuário logado — só use dentro da área autenticada */
export function useMe(): Me {
  const { me } = useAuth()
  if (!me) throw new Error('useMe sem sessão')
  return me
}

export const firstName = (name: string) => name.trim().split(/\s+/)[0] || name
