-- Modo universidade/escola.
--
-- O plano ganha um tipo: 'concurso' (o original: edital, uma data de prova, simulados; serve também a
-- certificações) ou 'universidade' (universidade e escola: semestre, programa por disciplina, várias
-- avaliações e entregas). Planos existentes ficam como concurso.
--
-- Avaliações e entregas são várias por disciplina, com data, peso e nota. Um estudo pode apontar para a
-- avaliação a que serviu; se ela for apagada, o vínculo vira nulo (como o tópico).

alter table plans
  add column kind text not null default 'concurso' check (kind in ('concurso', 'universidade'));

create table assessments (
  user_id    uuid not null,
  id         text not null,
  plan_id    text not null,
  subject_id text not null,
  name       text not null,
  kind       text not null check (kind in ('prova', 'trabalho', 'lista', 'apresentacao', 'outro')),
  date       date not null,
  time       text,
  weight     text,
  grade      double precision,
  max_grade  double precision,
  done       boolean not null default false,
  notes      text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  foreign key (user_id, plan_id) references plans (user_id, id) on delete cascade,
  foreign key (user_id, subject_id) references subjects (user_id, id) on delete cascade
);
create index assessments_plan_idx on assessments (user_id, plan_id, date);

alter table studies
  add column assessment_id text,
  add foreign key (user_id, assessment_id) references assessments (user_id, id) on delete set null (assessment_id);
