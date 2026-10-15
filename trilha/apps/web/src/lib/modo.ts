import type { AssessmentKind, DateStr, Plan, PlanKind } from './types'
import { diffDays, today } from './utils'
import { plural } from '../components/charts/filters'
import { useStore } from './store'

/** Plano sem tipo é concurso: as contas antigas seguem como estavam */
export const kindOf = (plan: Plan | null | undefined): PlanKind => plan?.kind ?? 'concurso'

export const PLAN_KINDS: { value: PlanKind; label: string; desc: string }[] = [
  { value: 'concurso', label: 'Concurso ou certificação', desc: 'Um edital, uma data de prova e simulados.' },
  { value: 'universidade', label: 'Universidade ou escola', desc: 'Semestre com programa por disciplina, provas e entregas.' },
]

/** Palavras que mudam com o tipo do plano ativo */
export interface Termos {
  universidade: boolean
  edital: string
  editalTitulo: string
  progresso: string
  avaliacoes: string
  rotaAvaliacoes: string
  org: string
  role: string
}

const CONCURSO: Termos = {
  universidade: false,
  edital: 'Edital',
  editalTitulo: 'Edital verticalizado',
  progresso: 'Progresso no edital',
  avaliacoes: 'Simulados',
  rotaAvaliacoes: '/simulados',
  org: 'Órgão / Edital',
  role: 'Cargo',
}

const UNIVERSIDADE: Termos = {
  universidade: true,
  edital: 'Programa',
  editalTitulo: 'Programa das disciplinas',
  progresso: 'Progresso no programa',
  avaliacoes: 'Avaliações',
  rotaAvaliacoes: '/avaliacoes',
  org: 'Instituição',
  role: 'Curso',
}

export const termosDe = (kind: PlanKind): Termos => (kind === 'universidade' ? UNIVERSIDADE : CONCURSO)

export function useTermos(): Termos {
  const { plan } = useStore()
  return termosDe(kindOf(plan))
}

export const ASSESSMENT_KINDS: { value: AssessmentKind; label: string }[] = [
  { value: 'prova', label: 'Prova' },
  { value: 'trabalho', label: 'Trabalho' },
  { value: 'lista', label: 'Lista' },
  { value: 'apresentacao', label: 'Apresentação' },
  { value: 'outro', label: 'Outro' },
]

export const assessmentKindLabel = (k: AssessmentKind) => ASSESSMENT_KINDS.find((x) => x.value === k)?.label ?? k

/** "hoje", "amanhã", "em 5 dias", "há 2 dias" */
export function quando(date: DateStr, ref: DateStr = today()): string {
  const d = diffDays(date, ref)
  if (d === 0) return 'hoje'
  if (d === 1) return 'amanhã'
  if (d === -1) return 'ontem'
  return d > 0 ? `em ${plural(d, 'dia')}` : `há ${plural(-d, 'dia')}`
}
