import type { AppState, Category, TimerPrefs } from './types'

export const BUILTIN_CATEGORIES: Category[] = [
  { id: 'teoria', name: 'Teoria', builtin: true },
  { id: 'revisao', name: 'Revisão', builtin: true },
  { id: 'questoes', name: 'Questões', builtin: true },
]

export const DEFAULT_TIMER_PREFS: TimerPrefs = {
  pomodoroStudy: 25,
  pomodoroShort: 5,
  pomodoroLong: 15,
  pomodoroRounds: 4,
  countdown: 60,
  sound: true,
}

export const DEFAULT_REVIEW_INTERVALS = [1, 7, 30, 60, 120]

export const emptyState = (): AppState => ({
  version: 1,
  plans: [],
  activePlanId: null,
  subjects: [],
  topics: [],
  categories: BUILTIN_CATEGORIES.map((c) => ({ ...c })),
  studies: [],
  reviews: [],
  plannings: {},
  exams: [],
  assessments: [],
  reminders: [],
  note: '',
  theme: 'system',
  timerPrefs: { ...DEFAULT_TIMER_PREFS },
  reviewIntervals: [...DEFAULT_REVIEW_INTERVALS],
})
