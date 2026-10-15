import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react'
import { diffState } from '@coado/shared'
import type {
  AppState,
  Assessment,
  Category,
  Exam,
  ID,
  Plan,
  Planning,
  Reminder,
  Review,
  ReviewStatus,
  Study,
  Subject,
  Topic,
} from './types'
import { addDays, nowTime, today, uid } from './utils'
import { emptyState, seededState } from '../data/seed'
import { api } from './api'
import { native } from './native'
import { applyTheme, cacheTheme } from './legacy'
import { SyncEngine, type SyncStatus } from './sync'

/** Dados do formulário de registro de estudo (sem id/planId) */
export type StudyInput = Omit<Study, 'id' | 'planId' | 'createdAt'> & {
  /** Marcar o tópico como concluído */
  finishTopic?: boolean
  /** Intervalos (dias) para agendar revisões; vazio = nenhuma */
  reviewIntervals?: number[]
}

/** Prefill para abrir o modal de estudo (vindo do cronômetro, planejamento, revisão…) */
export type StudyDraft = Partial<StudyInput> & { editingId?: ID; reviewId?: ID }

export interface TimerRequest {
  subjectId?: ID
  topicId?: ID
  categoryId?: ID
}

interface Store {
  state: AppState
  plan: Plan | null
  /** disciplinas do plano ativo (não arquivadas), ordenadas */
  subjects: Subject[]
  /** estudos do plano ativo */
  studies: Study[]
  reviews: Review[]
  planning: Planning | null
  exams: Exam[]
  /** avaliações e entregas do plano ativo, da mais próxima para a mais distante */
  assessments: Assessment[]
  topicsOf: (subjectId: ID) => Topic[]

  // UI global
  studyDraft: StudyDraft | null
  openStudy: (draft?: StudyDraft) => void
  closeStudy: () => void
  timer: TimerRequest | null
  openTimer: (req?: TimerRequest) => void
  closeTimer: () => void

  // ações
  update: (fn: (s: AppState) => AppState) => void
  setActivePlan: (id: ID) => void
  savePlan: (p: Partial<Plan> & { name: string }) => ID
  deletePlan: (id: ID) => void
  saveSubject: (s: Partial<Subject> & { name: string }) => ID
  deleteSubject: (id: ID) => void
  saveTopic: (t: Partial<Topic> & { name: string; subjectId: ID }) => ID
  deleteTopic: (id: ID) => void
  setTopicFinished: (id: ID, finished: boolean) => void
  reorderTopics: (subjectId: ID, orderedIds: ID[]) => void
  addCategory: (name: string) => Category
  saveStudy: (input: StudyInput, editingId?: ID) => ID
  deleteStudy: (id: ID) => void
  setReviewStatus: (id: ID, status: ReviewStatus) => void
  savePlanning: (p: Planning) => void
  deletePlanning: (planId: ID) => void
  restartCycle: () => void
  saveExam: (e: Omit<Exam, 'id' | 'planId'> & { id?: ID }) => void
  deleteExam: (id: ID) => void
  saveAssessment: (a: Partial<Assessment> & Pick<Assessment, 'name' | 'subjectId' | 'date'>) => ID
  deleteAssessment: (id: ID) => void
  saveReminder: (r: Partial<Reminder> & { text: string }) => void
  deleteReminder: (id: ID) => void
  setNote: (note: string) => void
  setTheme: (t: AppState['theme']) => void
  /** Substitui todos os dados da conta (backup, exemplo, dados antigos do navegador) */
  importState: (s: AppState) => Promise<void>
  resetAll: (withSeed: boolean) => Promise<void>

  // sincronização com a conta
  sync: {
    status: SyncStatus
    errorMessage: string
    retry: () => void
    /** envia já o que estiver pendente */
    flush: () => Promise<void>
    /** descarta o estado local e baixa de novo da conta */
    reload: () => Promise<void>
  }
}

const Ctx = createContext<Store | null>(null)

/** Recarrega da conta ao voltar para a aba depois desse tempo (mudanças feitas em outro aparelho) */
const REFRESH_AFTER_MS = 60_000

export function StoreProvider({ initial, onUnauthorized, children }: { initial: AppState; onUnauthorized: () => void; children: ReactNode }) {
  const [state, setState] = useState<AppState>(initial)
  const [studyDraft, setStudyDraft] = useState<StudyDraft | null>(null)
  const [timer, setTimer] = useState<TimerRequest | null>(null)
  const [engine] = useState(() => new SyncEngine(initial, onUnauthorized))
  const syncStatus = useSyncExternalStore(engine.subscribe, engine.getStatus)

  useEffect(() => engine.push(state), [engine, state])
  useEffect(() => () => engine.dispose(), [engine])

  // salva antes de sair e recarrega ao voltar para a aba
  useEffect(() => {
    let lastFetch = Date.now()
    const refresh = async () => {
      if (!engine.idle || Date.now() - lastFetch < REFRESH_AFTER_MS) return
      lastFetch = Date.now()
      const before = engine.snapshot
      const fresh = await api.get<AppState>('/state').catch(() => null)
      if (!fresh || !engine.idle || engine.snapshot !== before) return
      if (diffState(before, fresh)) {
        engine.rebase(fresh)
        setState(fresh)
      }
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') void engine.flush({ keepalive: true })
      else void refresh()
    }
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!engine.dirty) return
      void engine.flush({ keepalive: true })
      e.preventDefault()
    }
    const onOnline = () => engine.retry()
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('beforeunload', onBeforeUnload)
    window.addEventListener('online', onOnline)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('beforeunload', onBeforeUnload)
      window.removeEventListener('online', onOnline)
    }
  }, [engine])

  // tema
  useEffect(() => {
    cacheTheme(state.theme)
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => applyTheme(state.theme)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [state.theme])

  const update = useCallback((fn: (s: AppState) => AppState) => setState(fn), [])

  /** Troca tudo na conta e adota a resposta do servidor como novo estado */
  const replaceAll = useCallback(
    async (next: AppState) => {
      await engine.settle()
      const saved = await api.put<AppState>('/state', next)
      engine.rebase(saved)
      setState(saved)
    },
    [engine],
  )

  const reload = useCallback(async () => {
    await engine.settle()
    const fresh = await api.get<AppState>('/state')
    engine.rebase(fresh)
    setState(fresh)
  }, [engine])

  const planId = state.activePlanId
  const plan = state.plans.find((p) => p.id === planId) ?? null

  const derived = useMemo(() => {
    const subjects = state.subjects
      .filter((s) => s.planId === planId && !s.archived)
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
    const studies = state.studies.filter((s) => s.planId === planId)
    const reviews = state.reviews.filter((r) => r.planId === planId)
    const exams = state.exams.filter((e) => e.planId === planId).sort((a, b) => b.date.localeCompare(a.date))
    const planning = planId ? state.plannings[planId] ?? null : null
    const assessments = state.assessments
      .filter((a) => a.planId === planId)
      .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? ''))
    return { subjects, studies, reviews, exams, planning, assessments }
  }, [state, planId])

  const topicsOf = useCallback(
    (subjectId: ID) => state.topics.filter((t) => t.subjectId === subjectId).sort((a, b) => a.order - b.order),
    [state.topics],
  )

  const actions = useMemo(() => {
    const setActivePlan = (id: ID) => update((s) => ({ ...s, activePlanId: id }))

    const savePlan: Store['savePlan'] = (p) => {
      const id = p.id ?? uid()
      update((s) => {
        const exists = s.plans.some((x) => x.id === id)
        const plans = exists
          ? s.plans.map((x) => (x.id === id ? { ...x, ...p } : x))
          : [...s.plans, { weeklyGoal: { minutes: 0, questions: 0 }, createdAt: new Date().toISOString(), ...p, id }]
        return { ...s, plans, activePlanId: s.activePlanId ?? id }
      })
      return id
    }

    const deletePlan = (id: ID) =>
      update((s) => {
        const subjectIds = new Set(s.subjects.filter((x) => x.planId === id).map((x) => x.id))
        const plans = s.plans.filter((p) => p.id !== id)
        const plannings = { ...s.plannings }
        delete plannings[id]
        return {
          ...s,
          plans,
          activePlanId: s.activePlanId === id ? plans[0]?.id ?? null : s.activePlanId,
          subjects: s.subjects.filter((x) => x.planId !== id),
          topics: s.topics.filter((t) => !subjectIds.has(t.subjectId)),
          studies: s.studies.filter((x) => x.planId !== id),
          reviews: s.reviews.filter((x) => x.planId !== id),
          exams: s.exams.filter((x) => x.planId !== id),
          assessments: s.assessments.filter((x) => x.planId !== id),
          plannings,
        }
      })

    const saveSubject: Store['saveSubject'] = (sub) => {
      const id = sub.id ?? uid()
      update((s) => {
        const exists = s.subjects.some((x) => x.id === id)
        if (exists) return { ...s, subjects: s.subjects.map((x) => (x.id === id ? { ...x, ...sub } : x)) }
        const order = s.subjects.filter((x) => x.planId === s.activePlanId).length
        return {
          ...s,
          subjects: [...s.subjects, { color: '#A0C4FF', order, planId: s.activePlanId!, ...sub, id }],
        }
      })
      return id
    }

    const deleteSubject = (id: ID) =>
      update((s) => {
        const plannings = Object.fromEntries(
          Object.entries(s.plannings).map(([k, p]) => [
            k,
            {
              ...p,
              cycle: p.cycle.filter((c) => c.subjectId !== id),
              config: { ...p.config, subjects: p.config.subjects.filter((x) => x.subjectId !== id) },
            },
          ]),
        )
        return {
          ...s,
          subjects: s.subjects.filter((x) => x.id !== id),
          topics: s.topics.filter((t) => t.subjectId !== id),
          studies: s.studies.filter((x) => x.subjectId !== id),
          reviews: s.reviews.filter((x) => x.subjectId !== id),
          exams: s.exams.map((e) => ({ ...e, rows: e.rows.filter((r) => r.subjectId !== id) })),
          assessments: s.assessments.filter((x) => x.subjectId !== id),
          plannings,
        }
      })

    const saveTopic: Store['saveTopic'] = (t) => {
      const id = t.id ?? uid()
      update((s) => {
        const exists = s.topics.some((x) => x.id === id)
        if (exists) return { ...s, topics: s.topics.map((x) => (x.id === id ? { ...x, ...t } : x)) }
        const order = Math.max(0, ...s.topics.filter((x) => x.subjectId === t.subjectId).map((x) => x.order)) + 1
        return { ...s, topics: [...s.topics, { finished: false, links: [], order, ...t, id }] }
      })
      return id
    }

    const deleteTopic = (id: ID) =>
      update((s) => ({
        ...s,
        topics: s.topics.filter((t) => t.id !== id),
        studies: s.studies.map((x) => (x.topicId === id ? { ...x, topicId: undefined } : x)),
        reviews: s.reviews.map((x) => (x.topicId === id ? { ...x, topicId: undefined } : x)),
      }))

    const setTopicFinished = (id: ID, finished: boolean) =>
      update((s) => ({
        ...s,
        topics: s.topics.map((t) =>
          t.id === id ? { ...t, finished, finishedAt: finished ? new Date().toISOString() : undefined } : t,
        ),
      }))

    const reorderTopics = (subjectId: ID, orderedIds: ID[]) =>
      update((s) => ({
        ...s,
        topics: s.topics.map((t) => (t.subjectId === subjectId ? { ...t, order: orderedIds.indexOf(t.id) + 1 } : t)),
      }))

    const addCategory = (name: string): Category => {
      const cat = { id: uid(), name }
      update((s) => ({ ...s, categories: [...s.categories, cat] }))
      return cat
    }

    const saveStudy: Store['saveStudy'] = (input, editingId) => {
      const id = editingId ?? uid()
      const { finishTopic, reviewIntervals, ...data } = input
      update((s) => {
        const study: Study = {
          ...data,
          time: data.time ?? nowTime(),
          id,
          planId: s.activePlanId!,
          createdAt: s.studies.find((x) => x.id === id)?.createdAt ?? new Date().toISOString(),
        }
        const studies = editingId ? s.studies.map((x) => (x.id === id ? study : x)) : [...s.studies, study]
        let reviews = s.reviews
        if (reviewIntervals?.length) {
          reviews = [
            ...reviews.filter((r) => !(r.studyId === id && r.status === 'pending')),
            ...reviewIntervals.map<Review>((interval) => ({
              id: uid(),
              planId: study.planId,
              studyId: id,
              subjectId: study.subjectId,
              topicId: study.topicId,
              dueDate: addDays(study.date, interval),
              interval,
              status: 'pending',
            })),
          ]
        }
        const topics =
          finishTopic && study.topicId
            ? s.topics.map((t) =>
                t.id === study.topicId ? { ...t, finished: true, finishedAt: t.finishedAt ?? new Date().toISOString() } : t,
              )
            : s.topics
        return { ...s, studies, reviews, topics }
      })
      return id
    }

    const deleteStudy = (id: ID) =>
      update((s) => ({
        ...s,
        studies: s.studies.filter((x) => x.id !== id),
        reviews: s.reviews.filter((r) => r.studyId !== id),
      }))

    const setReviewStatus = (id: ID, status: ReviewStatus) =>
      update((s) => ({
        ...s,
        reviews: s.reviews.map((r) =>
          r.id === id ? { ...r, status, doneAt: status === 'pending' ? undefined : new Date().toISOString() } : r,
        ),
      }))

    const savePlanning = (p: Planning) => update((s) => ({ ...s, plannings: { ...s.plannings, [p.planId]: p } }))

    const deletePlanning = (pid: ID) =>
      update((s) => {
        const plannings = { ...s.plannings }
        delete plannings[pid]
        return { ...s, plannings }
      })

    const restartCycle = () =>
      update((s) => {
        const p = s.activePlanId ? s.plannings[s.activePlanId] : null
        if (!p) return s
        return {
          ...s,
          plannings: { ...s.plannings, [p.planId]: { ...p, completedCycles: p.completedCycles + 1, cycleStartedAt: today() } },
        }
      })

    const saveExam: Store['saveExam'] = (e) =>
      update((s) => {
        const id = e.id ?? uid()
        const exam: Exam = { ...e, id, planId: s.activePlanId! }
        const exists = s.exams.some((x) => x.id === id)
        return { ...s, exams: exists ? s.exams.map((x) => (x.id === id ? exam : x)) : [...s.exams, exam] }
      })

    const deleteExam = (id: ID) => update((s) => ({ ...s, exams: s.exams.filter((x) => x.id !== id) }))

    const saveAssessment: Store['saveAssessment'] = (a) => {
      const id = a.id ?? uid()
      update((s) => {
        const exists = s.assessments.some((x) => x.id === id)
        if (exists) return { ...s, assessments: s.assessments.map((x) => (x.id === id ? { ...x, ...a } : x)) }
        const novo: Assessment = { kind: 'prova', done: false, notes: '', createdAt: new Date().toISOString(), planId: s.activePlanId!, ...a, id }
        return { ...s, assessments: [...s.assessments, novo] }
      })
      return id
    }

    // os estudos ficam; só perdem o vínculo
    const deleteAssessment = (id: ID) =>
      update((s) => ({
        ...s,
        assessments: s.assessments.filter((x) => x.id !== id),
        studies: s.studies.map((x) => (x.assessmentId === id ? { ...x, assessmentId: undefined } : x)),
      }))

    const saveReminder: Store['saveReminder'] = (r) =>
      update((s) => {
        const id = r.id ?? uid()
        const exists = s.reminders.some((x) => x.id === id)
        return {
          ...s,
          reminders: exists
            ? s.reminders.map((x) => (x.id === id ? { ...x, ...r } : x))
            : [...s.reminders, { done: false, createdAt: new Date().toISOString(), ...r, id }],
        }
      })

    const deleteReminder = (id: ID) => update((s) => ({ ...s, reminders: s.reminders.filter((x) => x.id !== id) }))
    const setNote = (note: string) => update((s) => ({ ...s, note }))
    const setTheme = (theme: AppState['theme']) => update((s) => ({ ...s, theme }))
    const importState = (next: AppState) => replaceAll({ ...emptyState(), ...next })
    const resetAll = (withSeed: boolean) => replaceAll(withSeed ? seededState() : emptyState())

    return {
      update,
      setActivePlan,
      savePlan,
      deletePlan,
      saveSubject,
      deleteSubject,
      saveTopic,
      deleteTopic,
      setTopicFinished,
      reorderTopics,
      addCategory,
      saveStudy,
      deleteStudy,
      setReviewStatus,
      savePlanning,
      deletePlanning,
      restartCycle,
      saveExam,
      deleteExam,
      saveAssessment,
      deleteAssessment,
      saveReminder,
      deleteReminder,
      setNote,
      setTheme,
      importState,
      resetAll,
    }
  }, [update, replaceAll])

  const value: Store = {
    state,
    plan,
    ...derived,
    topicsOf,
    studyDraft,
    openStudy: (draft) => setStudyDraft(draft ?? {}),
    closeStudy: () => setStudyDraft(null),
    timer,
    openTimer: (req) => {
      const app = native()
      if (app) app.openTimer(JSON.stringify(req ?? {}))
      else setTimer(req ?? {})
    },
    closeTimer: () => setTimer(null),
    ...actions,
    sync: { status: syncStatus, errorMessage: engine.errorMessage, retry: () => engine.retry(), flush: () => engine.flush(), reload },
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useStore fora do StoreProvider')
  return ctx
}
