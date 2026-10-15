import { Link } from 'react-router-dom'
import { FolderOpen } from 'lucide-react'
import { PageHeader } from '../components/Layout'
import { Card, Empty, ProgressBar } from '../components/ui'
import { useStore } from '../lib/store'
import { fmtDuration, pct, totals } from '../lib/utils'
import { Donut } from '../components/charts/Donut'
import { plural } from '../components/charts/filters'
import { ConstancyCard } from '../components/home/ConstancyCard'
import { PanelTable } from '../components/home/PanelTable'
import { ExamDateCard, WeeklyGoalsCard } from '../components/home/GoalCards'
import { WeeklyChartCard } from '../components/home/WeeklyChartCard'
import { PlanningCard, RecentCard, StudyTimeCard, TodayReviewsCard } from '../components/home/ActivityCards'
import { RemindersCard } from '../components/home/RemindersCard'
import { CozyBanner } from '../components/home/CozyBanner'
import { NextAssessmentsCard } from '../components/home/AssessmentsCard'
import { useTermos } from '../lib/modo'

const label = 'text-xs font-semibold uppercase tracking-wider text-muted'

export default function HomePage() {
  const { plan, subjects, studies, topicsOf } = useStore()
  const termos = useTermos()

  if (!plan)
    return (
      <>
        <PageHeader title="Início" />
        <Card>
          <Empty
            icon={<FolderOpen size={40} />}
            title="Nenhum plano ativo"
            action={
              <Link to="/planos" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
                Criar um plano
              </Link>
            }
          >
            Crie um plano de estudos, para um concurso ou um semestre, e comece a acompanhar seu progresso.
          </Empty>
        </Card>
      </>
    )

  const t = totals(studies)
  const topics = subjects.flatMap((s) => topicsOf(s.id))
  const finished = topics.filter((x) => x.finished).length
  const progress = pct(finished, topics.length)

  return (
    <>
      <PageHeader title="Início" />
      <CozyBanner />
      <div className="grid gap-5 lg:grid-cols-3">
        <Card>
          <p className={label}>Tempo de estudo</p>
          <p className="mt-3 text-3xl font-semibold tabular">{fmtDuration(t.duration)}</p>
          <p className="mt-1 text-sm text-muted">{plural(t.days, 'dia estudado', 'dias estudados')}</p>
        </Card>
        <Card>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className={label}>Desempenho</p>
              <p className="mt-3 text-sm">
                <b className="tabular text-ok">{t.hits}</b> <span className="text-muted">acertos</span>
              </p>
              <p className="text-sm">
                <b className="tabular text-bad">{t.misses}</b> <span className="text-muted">erros</span>
              </p>
              <p className="mt-1 text-xs text-muted">{plural(t.questions, 'questão', 'questões')}</p>
            </div>
            <Donut hits={t.hits} misses={t.misses} size={92} thickness={11} />
          </div>
        </Card>
        <Card>
          <p className={label}>{termos.progresso}</p>
          <p className="mt-3 text-3xl font-semibold tabular">{progress}%</p>
          <ProgressBar value={progress} className="mt-3" />
          <p className="mt-2 text-sm text-muted">
            {finished} de {plural(topics.length, 'tópico concluído', 'tópicos concluídos')}
          </p>
        </Card>

        <ConstancyCard studies={studies} className="lg:col-span-2" />
        {termos.universidade ? <NextAssessmentsCard /> : <ExamDateCard key={plan.id} plan={plan} />}

        <PanelTable subjects={subjects} studies={studies} className="lg:col-span-2 lg:row-span-2" />
        <WeeklyGoalsCard key={`goal-${plan.id}`} plan={plan} studies={studies} />
        <TodayReviewsCard />

        <WeeklyChartCard studies={studies} className="lg:col-span-2" />
        <PlanningCard />

        <StudyTimeCard studies={studies} subjects={subjects} />
        <RemindersCard />
        <RecentCard studies={studies} />
      </div>
    </>
  )
}
