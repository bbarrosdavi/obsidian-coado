import type { Exam } from '../../lib/types'
import { pct } from '../../lib/utils'

export const STYLE_LABEL: Record<Exam['style'], string> = {
  multiple: 'Múltipla escolha',
  true_false: 'Certo/Errado',
}

export interface ExamSummary {
  total: number
  hits: number
  misses: number
  blanks: number
  performance: number
  /** Pontuação ponderada. Em Certo/Errado, cada erro anula um acerto. */
  score: number
  maxScore: number
}

const round2 = (n: number) => Math.round(n * 100) / 100

export function summarizeExam({ rows, style }: Pick<Exam, 'rows' | 'style'>): ExamSummary {
  let total = 0,
    hits = 0,
    misses = 0,
    score = 0,
    maxScore = 0
  for (const r of rows) {
    total += r.total
    hits += r.hits
    misses += r.misses
    score += r.weight * (style === 'true_false' ? r.hits - r.misses : r.hits)
    maxScore += r.weight * r.total
  }
  return {
    total,
    hits,
    misses,
    blanks: Math.max(0, total - hits - misses),
    performance: pct(hits, total),
    score: round2(score),
    maxScore: round2(maxScore),
  }
}

export const fmtNum = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
