import { z } from 'zod'
import type {
  AppState,
  Category,
  Exam,
  Assessment,
  Plan,
  Planning,
  Reminder,
  Review,
  Study,
  Subject,
  TimerPrefs,
  Topic,
} from './types'

/*
 * Validação de tudo que chega na API. Os limites protegem o banco (tamanho/forma);
 * o conteúdo em si é livre para não travar a sincronização de dados antigos.
 */

const MAX_ROWS = 20_000

export const IdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/, 'id inválido')
export const DateStrSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'data deve ser YYYY-MM-DD')
const Timestamp = z.string().max(40).refine((v) => !Number.isNaN(Date.parse(v)), 'data/hora inválida')
const text = (max: number) => z.string().max(max)
const int = (min: number, max: number) => z.number().int().min(min).max(max)
const num = (min: number, max: number) => z.number().min(min).max(max)

const DAY = 86_400

export const PlanSchema = z.object({
  id: IdSchema,
  name: text(200),
  org: text(300).optional(),
  role: text(300).optional(),
  notes: text(10_000).optional(),
  examDate: DateStrSchema.optional(),
  kind: z.enum(['concurso', 'universidade']).optional(),
  weeklyGoal: z.object({ minutes: int(0, 7 * 24 * 60), questions: int(0, 1_000_000) }),
  createdAt: Timestamp,
}) satisfies z.ZodType<Plan>

export const SubjectSchema = z.object({
  id: IdSchema,
  planId: IdSchema,
  name: text(200),
  color: text(32),
  order: int(-1_000_000, 1_000_000),
  archived: z.boolean().optional(),
}) satisfies z.ZodType<Subject>

export const TopicSchema = z.object({
  id: IdSchema,
  subjectId: IdSchema,
  name: text(1000),
  order: int(-1_000_000, 1_000_000),
  finished: z.boolean(),
  finishedAt: Timestamp.optional(),
  links: z.array(z.object({ title: text(300), url: text(2048) })).max(100),
}) satisfies z.ZodType<Topic>

export const CategorySchema = z.object({
  id: IdSchema,
  name: text(100),
  builtin: z.boolean().optional(),
}) satisfies z.ZodType<Category>

export const StudySchema = z.object({
  id: IdSchema,
  planId: IdSchema,
  subjectId: IdSchema,
  topicId: IdSchema.optional(),
  categoryId: IdSchema,
  date: DateStrSchema,
  time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  duration: int(0, 7 * DAY),
  material: text(1000),
  hits: int(0, 1_000_000),
  misses: int(0, 1_000_000),
  pages: z.array(z.object({ start: int(0, 1_000_000), end: int(0, 1_000_000) })).max(200),
  videos: z.array(z.object({ title: text(300), start: int(0, 7 * DAY), end: int(0, 7 * DAY) })).max(200),
  comment: text(20_000),
  countInPlanning: z.boolean(),
  assessmentId: IdSchema.optional(),
  createdAt: Timestamp,
}) satisfies z.ZodType<Study>

export const ReviewSchema = z.object({
  id: IdSchema,
  planId: IdSchema,
  studyId: IdSchema,
  subjectId: IdSchema,
  topicId: IdSchema.optional(),
  dueDate: DateStrSchema,
  interval: int(0, 3650),
  status: z.enum(['pending', 'done', 'ignored']),
  doneAt: Timestamp.optional(),
}) satisfies z.ZodType<Review>

export const PlanningSchema = z.object({
  planId: IdSchema,
  type: z.enum(['cycle', 'weekly']),
  config: z.object({
    weeklyMinutes: int(0, 7 * 24 * 60),
    days: z.array(z.boolean()).length(7),
    minSession: int(0, 24 * 60),
    maxSession: int(0, 24 * 60),
    subjects: z
      .array(z.object({ subjectId: IdSchema, importance: num(0, 100), knowledge: num(0, 100) }))
      .max(500),
  }),
  cycle: z.array(z.object({ id: IdSchema, subjectId: IdSchema, duration: int(0, 24 * 60) })).max(2000),
  completedCycles: int(0, 1_000_000),
  cycleStartedAt: DateStrSchema,
}) satisfies z.ZodType<Planning>

export const ExamSchema = z.object({
  id: IdSchema,
  planId: IdSchema,
  date: DateStrSchema,
  name: text(300),
  style: z.enum(['multiple', 'true_false']),
  board: text(200),
  timeSpent: int(0, 7 * DAY),
  rows: z
    .array(
      z.object({
        subjectId: IdSchema,
        weight: num(0, 1000),
        total: int(0, 100_000),
        hits: int(0, 100_000),
        misses: int(0, 100_000),
      }),
    )
    .max(500),
  comment: text(20_000),
}) satisfies z.ZodType<Exam>

export const ReminderSchema = z.object({
  id: IdSchema,
  text: text(2000),
  date: DateStrSchema.optional(),
  done: z.boolean(),
  createdAt: Timestamp,
}) satisfies z.ZodType<Reminder>

export const AssessmentSchema = z.object({
  id: IdSchema,
  planId: IdSchema,
  subjectId: IdSchema,
  name: text(300),
  kind: z.enum(['prova', 'trabalho', 'lista', 'apresentacao', 'outro']),
  date: DateStrSchema,
  time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  weight: text(60).optional(),
  grade: num(0, 1000).optional(),
  maxGrade: num(0, 1000).optional(),
  done: z.boolean(),
  notes: text(10_000),
  createdAt: Timestamp,
}) satisfies z.ZodType<Assessment>

export const ThemeSchema = z.enum(['light', 'dark', 'system'])

export const TimerPrefsSchema = z.object({
  pomodoroStudy: int(1, 600),
  pomodoroShort: int(1, 600),
  pomodoroLong: int(1, 600),
  pomodoroRounds: int(1, 100),
  countdown: int(1, 6000),
  sound: z.boolean(),
}) satisfies z.ZodType<TimerPrefs>

/** Preferências da conta (campos "soltos" do AppState) */
export const SettingsSchema = z.object({
  activePlanId: IdSchema.nullable(),
  theme: ThemeSchema,
  timerPrefs: TimerPrefsSchema,
  reviewIntervals: z.array(int(0, 3650)).max(30),
  note: text(100_000),
})
export type Settings = z.infer<typeof SettingsSchema>

/** Estado completo — usado para importar backup / substituir tudo */
export const AppStateSchema = z.object({
  version: z.literal(1),
  plans: z.array(PlanSchema).max(1000),
  activePlanId: IdSchema.nullable(),
  subjects: z.array(SubjectSchema).max(MAX_ROWS),
  topics: z.array(TopicSchema).max(MAX_ROWS * 5),
  categories: z.array(CategorySchema).max(500),
  studies: z.array(StudySchema).max(MAX_ROWS * 5),
  reviews: z.array(ReviewSchema).max(MAX_ROWS * 10),
  plannings: z.record(IdSchema, PlanningSchema),
  exams: z.array(ExamSchema).max(MAX_ROWS),
  assessments: z.array(AssessmentSchema).max(MAX_ROWS).default([]),
  reminders: z.array(ReminderSchema).max(MAX_ROWS),
  note: text(100_000),
  theme: ThemeSchema,
  timerPrefs: TimerPrefsSchema,
  reviewIntervals: z.array(int(0, 3650)).max(30),
}) satisfies z.ZodType<AppState>

const ids = z.array(IdSchema).max(MAX_ROWS)

/** Lote de alterações enviado pelo navegador (ver diffState) */
export const SyncRequestSchema = z.object({
  upserts: z
    .object({
      categories: z.array(CategorySchema).max(500),
      plans: z.array(PlanSchema).max(1000),
      subjects: z.array(SubjectSchema).max(MAX_ROWS),
      topics: z.array(TopicSchema).max(MAX_ROWS),
      studies: z.array(StudySchema).max(MAX_ROWS),
      reviews: z.array(ReviewSchema).max(MAX_ROWS),
      plannings: z.array(PlanningSchema).max(1000),
      exams: z.array(ExamSchema).max(MAX_ROWS),
      assessments: z.array(AssessmentSchema).max(MAX_ROWS),
      reminders: z.array(ReminderSchema).max(MAX_ROWS),
    })
    .partial()
    .optional(),
  deletes: z
    .object({
      categories: ids,
      plans: ids,
      subjects: ids,
      topics: ids,
      studies: ids,
      reviews: ids,
      /** ids de plano */
      plannings: ids,
      exams: ids,
      assessments: ids,
      reminders: ids,
    })
    .partial()
    .optional(),
  settings: SettingsSchema.partial().optional(),
})
export type SyncRequest = z.infer<typeof SyncRequestSchema>

export const ProfilePatchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  onboarded: z.boolean().optional(),
})
export type ProfilePatch = z.infer<typeof ProfilePatchSchema>

export const FilePatchSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  planId: IdSchema.nullable().optional(),
  subjectId: IdSchema.nullable().optional(),
})
export type FilePatch = z.infer<typeof FilePatchSchema>
