import type { Assessment, Category, Exam, Plan, Planning, Reminder, Review, Study, Subject, Topic } from '@coado/shared'

/*
 * Mapeamento entre as tabelas (snake_case, colunas planas) e os tipos do domínio (camelCase).
 * Campos opcionais do domínio viram NULL no banco e voltam omitidos no JSON.
 */

// linhas vindas do pg: colunas dinâmicas
type Row = Record<string, any>

export interface Entity<T> {
  table: string
  /** coluna que identifica a linha dentro da conta (PK = user_id + key) */
  key: 'id' | 'plan_id'
  /** colunas além de user_id, com o tipo SQL usado em jsonb_to_recordset */
  columns: [name: string, type: string][]
  orderBy: string
  toRow: (e: T) => Row
  fromRow: (r: Row) => T
}

/** remove chaves undefined para o JSON sair limpo */
const compact = <T extends object>(o: T): T =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : undefined)
const opt = <V>(v: V | null | undefined) => (v === null ? undefined : v)

export const categories: Entity<Category> = {
  table: 'categories',
  key: 'id',
  columns: [
    ['id', 'text'],
    ['name', 'text'],
    ['builtin', 'boolean'],
  ],
  // padrão na ordem de criação (Teoria, Revisão, Questões); as da pessoa por nome
  orderBy: "builtin desc, array_position(array['teoria', 'revisao', 'questoes'], id), name",
  toRow: (c) => ({ id: c.id, name: c.name, builtin: c.builtin ?? false }),
  fromRow: (r) => compact({ id: r.id, name: r.name, builtin: r.builtin || undefined }),
}

export const plans: Entity<Plan> = {
  table: 'plans',
  key: 'id',
  columns: [
    ['id', 'text'],
    ['name', 'text'],
    ['org', 'text'],
    ['role', 'text'],
    ['notes', 'text'],
    ['exam_date', 'date'],
    ['kind', 'text'],
    ['weekly_goal_minutes', 'integer'],
    ['weekly_goal_questions', 'integer'],
    ['created_at', 'timestamptz'],
  ],
  orderBy: 'created_at, id',
  toRow: (p) => ({
    id: p.id,
    name: p.name,
    org: p.org ?? null,
    role: p.role ?? null,
    notes: p.notes ?? null,
    exam_date: p.examDate ?? null,
    kind: p.kind ?? 'concurso',
    weekly_goal_minutes: p.weeklyGoal.minutes,
    weekly_goal_questions: p.weeklyGoal.questions,
    created_at: p.createdAt,
  }),
  fromRow: (r) =>
    compact({
      id: r.id,
      name: r.name,
      org: opt(r.org),
      role: opt(r.role),
      notes: opt(r.notes),
      examDate: opt(r.exam_date),
      kind: r.kind === 'universidade' ? 'universidade' : undefined,
      weeklyGoal: { minutes: r.weekly_goal_minutes, questions: r.weekly_goal_questions },
      createdAt: iso(r.created_at)!,
    }),
}

export const subjects: Entity<Subject> = {
  table: 'subjects',
  key: 'id',
  columns: [
    ['id', 'text'],
    ['plan_id', 'text'],
    ['name', 'text'],
    ['color', 'text'],
    ['position', 'integer'],
    ['archived', 'boolean'],
  ],
  orderBy: 'plan_id, position, id',
  toRow: (s) => ({
    id: s.id,
    plan_id: s.planId,
    name: s.name,
    color: s.color,
    position: s.order,
    archived: s.archived ?? false,
  }),
  fromRow: (r) =>
    compact({
      id: r.id,
      planId: r.plan_id,
      name: r.name,
      color: r.color,
      order: r.position,
      archived: r.archived || undefined,
    }),
}

export const topics: Entity<Topic> = {
  table: 'topics',
  key: 'id',
  columns: [
    ['id', 'text'],
    ['subject_id', 'text'],
    ['name', 'text'],
    ['position', 'integer'],
    ['finished', 'boolean'],
    ['finished_at', 'timestamptz'],
    ['links', 'jsonb'],
  ],
  orderBy: 'subject_id, position, id',
  toRow: (t) => ({
    id: t.id,
    subject_id: t.subjectId,
    name: t.name,
    position: t.order,
    finished: t.finished,
    finished_at: t.finishedAt ?? null,
    links: t.links,
  }),
  fromRow: (r) =>
    compact({
      id: r.id,
      subjectId: r.subject_id,
      name: r.name,
      order: r.position,
      finished: r.finished,
      finishedAt: iso(r.finished_at),
      links: r.links,
    }),
}

export const studies: Entity<Study> = {
  table: 'studies',
  key: 'id',
  columns: [
    ['id', 'text'],
    ['plan_id', 'text'],
    ['subject_id', 'text'],
    ['topic_id', 'text'],
    ['category_id', 'text'],
    ['date', 'date'],
    ['time', 'text'],
    ['duration', 'integer'],
    ['material', 'text'],
    ['hits', 'integer'],
    ['misses', 'integer'],
    ['pages', 'jsonb'],
    ['videos', 'jsonb'],
    ['comment', 'text'],
    ['count_in_planning', 'boolean'],
    ['assessment_id', 'text'],
    ['created_at', 'timestamptz'],
  ],
  orderBy: 'date, time nulls first, created_at, id',
  toRow: (s) => ({
    id: s.id,
    plan_id: s.planId,
    subject_id: s.subjectId,
    topic_id: s.topicId ?? null,
    category_id: s.categoryId,
    date: s.date,
    time: s.time ?? null,
    duration: s.duration,
    material: s.material,
    hits: s.hits,
    misses: s.misses,
    pages: s.pages,
    videos: s.videos,
    comment: s.comment,
    count_in_planning: s.countInPlanning,
    assessment_id: s.assessmentId ?? null,
    created_at: s.createdAt,
  }),
  fromRow: (r) =>
    compact({
      id: r.id,
      planId: r.plan_id,
      subjectId: r.subject_id,
      topicId: opt(r.topic_id),
      categoryId: r.category_id,
      date: r.date,
      time: opt(r.time),
      duration: r.duration,
      material: r.material,
      hits: r.hits,
      misses: r.misses,
      pages: r.pages,
      videos: r.videos,
      comment: r.comment,
      countInPlanning: r.count_in_planning,
      assessmentId: opt(r.assessment_id),
      createdAt: iso(r.created_at)!,
    }),
}

export const reviews: Entity<Review> = {
  table: 'reviews',
  key: 'id',
  columns: [
    ['id', 'text'],
    ['plan_id', 'text'],
    ['study_id', 'text'],
    ['subject_id', 'text'],
    ['topic_id', 'text'],
    ['due_date', 'date'],
    ['interval', 'integer'],
    ['status', 'text'],
    ['done_at', 'timestamptz'],
  ],
  orderBy: 'due_date, id',
  toRow: (r) => ({
    id: r.id,
    plan_id: r.planId,
    study_id: r.studyId,
    subject_id: r.subjectId,
    topic_id: r.topicId ?? null,
    due_date: r.dueDate,
    interval: r.interval,
    status: r.status,
    done_at: r.doneAt ?? null,
  }),
  fromRow: (r) =>
    compact({
      id: r.id,
      planId: r.plan_id,
      studyId: r.study_id,
      subjectId: r.subject_id,
      topicId: opt(r.topic_id),
      dueDate: r.due_date,
      interval: r.interval,
      status: r.status,
      doneAt: iso(r.done_at),
    }),
}

export const plannings: Entity<Planning> = {
  table: 'plannings',
  key: 'plan_id',
  columns: [
    ['plan_id', 'text'],
    ['type', 'text'],
    ['config', 'jsonb'],
    ['cycle', 'jsonb'],
    ['completed_cycles', 'integer'],
    ['cycle_started_at', 'date'],
  ],
  orderBy: 'plan_id',
  toRow: (p) => ({
    plan_id: p.planId,
    type: p.type,
    config: p.config,
    cycle: p.cycle,
    completed_cycles: p.completedCycles,
    cycle_started_at: p.cycleStartedAt,
  }),
  fromRow: (r) => ({
    planId: r.plan_id,
    type: r.type,
    config: r.config,
    cycle: r.cycle,
    completedCycles: r.completed_cycles,
    cycleStartedAt: r.cycle_started_at,
  }),
}

export const exams: Entity<Exam> = {
  table: 'exams',
  key: 'id',
  columns: [
    ['id', 'text'],
    ['plan_id', 'text'],
    ['date', 'date'],
    ['name', 'text'],
    ['style', 'text'],
    ['board', 'text'],
    ['time_spent', 'integer'],
    ['rows', 'jsonb'],
    ['comment', 'text'],
  ],
  orderBy: 'date, id',
  toRow: (e) => ({
    id: e.id,
    plan_id: e.planId,
    date: e.date,
    name: e.name,
    style: e.style,
    board: e.board,
    time_spent: e.timeSpent,
    rows: e.rows,
    comment: e.comment,
  }),
  fromRow: (r) => ({
    id: r.id,
    planId: r.plan_id,
    date: r.date,
    name: r.name,
    style: r.style,
    board: r.board,
    timeSpent: r.time_spent,
    rows: r.rows,
    comment: r.comment,
  }),
}

export const assessments: Entity<Assessment> = {
  table: 'assessments',
  key: 'id',
  columns: [
    ['id', 'text'],
    ['plan_id', 'text'],
    ['subject_id', 'text'],
    ['name', 'text'],
    ['kind', 'text'],
    ['date', 'date'],
    ['time', 'text'],
    ['weight', 'text'],
    ['grade', 'double precision'],
    ['max_grade', 'double precision'],
    ['done', 'boolean'],
    ['notes', 'text'],
    ['created_at', 'timestamptz'],
  ],
  orderBy: 'date, time nulls first, id',
  toRow: (a) => ({
    id: a.id,
    plan_id: a.planId,
    subject_id: a.subjectId,
    name: a.name,
    kind: a.kind,
    date: a.date,
    time: a.time ?? null,
    weight: a.weight ?? null,
    grade: a.grade ?? null,
    max_grade: a.maxGrade ?? null,
    done: a.done,
    notes: a.notes,
    created_at: a.createdAt,
  }),
  fromRow: (r) =>
    compact({
      id: r.id,
      planId: r.plan_id,
      subjectId: r.subject_id,
      name: r.name,
      kind: r.kind,
      date: r.date,
      time: opt(r.time),
      weight: opt(r.weight),
      grade: opt(r.grade),
      maxGrade: opt(r.max_grade),
      done: r.done,
      notes: r.notes,
      createdAt: iso(r.created_at)!,
    }),
}

export const reminders: Entity<Reminder> = {
  table: 'reminders',
  key: 'id',
  columns: [
    ['id', 'text'],
    ['text', 'text'],
    ['date', 'date'],
    ['done', 'boolean'],
    ['created_at', 'timestamptz'],
  ],
  orderBy: 'created_at, id',
  toRow: (r) => ({ id: r.id, text: r.text, date: r.date ?? null, done: r.done, created_at: r.createdAt }),
  fromRow: (r) =>
    compact({ id: r.id, text: r.text, date: opt(r.date), done: r.done, createdAt: iso(r.created_at)! }),
}

/** Ordem pai → filho: upserts seguem esta ordem, deletes a inversa */
export const ENTITIES = { categories, plans, subjects, topics, assessments, studies, reviews, plannings, exams, reminders }
export type EntityName = keyof typeof ENTITIES
// avaliações antes dos estudos, que podem apontar para elas
export const UPSERT_ORDER: EntityName[] = ['categories', 'plans', 'subjects', 'topics', 'assessments', 'studies', 'reviews', 'plannings', 'exams', 'reminders']
export const DELETE_ORDER: EntityName[] = ['reviews', 'studies', 'assessments', 'exams', 'plannings', 'topics', 'subjects', 'plans', 'categories', 'reminders']
