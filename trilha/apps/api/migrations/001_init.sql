-- Esquema inicial do Coado.
--
-- Multi-inquilino por chave composta: toda tabela de domínio tem PK (user_id, id) e as FKs entre
-- elas incluem user_id. Assim o banco garante que um registro nunca aponta para dados de outra
-- conta, e ids gerados no navegador não colidem entre usuários.

create table users (
  id            uuid primary key default gen_random_uuid(),
  google_sub    text not null unique,
  email         text not null,
  name          text not null,
  avatar_url    text,
  onboarded_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  last_login_at timestamptz
);

create table sessions (
  id           uuid primary key default gen_random_uuid(),
  -- sha256 do token do cookie; o token em si nunca é salvo
  token_hash   bytea not null unique,
  user_id      uuid not null references users on delete cascade,
  user_agent   text,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at   timestamptz not null
);
create index sessions_user_idx on sessions (user_id);
create index sessions_expires_idx on sessions (expires_at);

create table user_settings (
  user_id          uuid primary key references users on delete cascade,
  active_plan_id   text,
  theme            text not null default 'system' check (theme in ('light', 'dark', 'system')),
  timer_prefs      jsonb not null,
  review_intervals integer[] not null,
  note             text not null default '',
  updated_at       timestamptz not null default now()
);

create table plans (
  user_id               uuid not null references users on delete cascade,
  id                    text not null,
  name                  text not null,
  org                   text,
  role                  text,
  notes                 text,
  exam_date             date,
  weekly_goal_minutes   integer not null default 0,
  weekly_goal_questions integer not null default 0,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  primary key (user_id, id)
);

create table subjects (
  user_id    uuid not null,
  id         text not null,
  plan_id    text not null,
  name       text not null,
  color      text not null,
  position   integer not null default 0,
  archived   boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  foreign key (user_id, plan_id) references plans (user_id, id) on delete cascade
);
create index subjects_plan_idx on subjects (user_id, plan_id);

create table topics (
  user_id     uuid not null,
  id          text not null,
  subject_id  text not null,
  name        text not null,
  position    integer not null default 0,
  finished    boolean not null default false,
  finished_at timestamptz,
  links       jsonb not null default '[]',
  updated_at  timestamptz not null default now(),
  primary key (user_id, id),
  foreign key (user_id, subject_id) references subjects (user_id, id) on delete cascade
);
create index topics_subject_idx on topics (user_id, subject_id);

create table categories (
  user_id    uuid not null references users on delete cascade,
  id         text not null,
  name       text not null,
  builtin    boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table studies (
  user_id           uuid not null,
  id                text not null,
  plan_id           text not null,
  subject_id        text not null,
  topic_id          text,
  -- sem FK: ao apagar uma categoria o navegador move os estudos para "teoria"
  category_id       text not null,
  date              date not null,
  time              text,
  duration          integer not null default 0,
  material          text not null default '',
  hits              integer not null default 0,
  misses            integer not null default 0,
  pages             jsonb not null default '[]',
  videos            jsonb not null default '[]',
  comment           text not null default '',
  count_in_planning boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  primary key (user_id, id),
  foreign key (user_id, plan_id) references plans (user_id, id) on delete cascade,
  foreign key (user_id, subject_id) references subjects (user_id, id) on delete cascade,
  foreign key (user_id, topic_id) references topics (user_id, id) on delete set null (topic_id)
);
create index studies_plan_date_idx on studies (user_id, plan_id, date);
create index studies_subject_idx on studies (user_id, subject_id);
create index studies_topic_idx on studies (user_id, topic_id);

create table reviews (
  user_id    uuid not null,
  id         text not null,
  plan_id    text not null,
  study_id   text not null,
  subject_id text not null,
  topic_id   text,
  due_date   date not null,
  interval   integer not null,
  status     text not null check (status in ('pending', 'done', 'ignored')),
  done_at    timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  foreign key (user_id, plan_id) references plans (user_id, id) on delete cascade,
  foreign key (user_id, study_id) references studies (user_id, id) on delete cascade,
  foreign key (user_id, subject_id) references subjects (user_id, id) on delete cascade,
  foreign key (user_id, topic_id) references topics (user_id, id) on delete set null (topic_id)
);
create index reviews_due_idx on reviews (user_id, plan_id, status, due_date);
create index reviews_study_idx on reviews (user_id, study_id);
create index reviews_subject_idx on reviews (user_id, subject_id);
create index reviews_topic_idx on reviews (user_id, topic_id);

create table plannings (
  user_id          uuid not null,
  plan_id          text not null,
  type             text not null check (type in ('cycle', 'weekly')),
  config           jsonb not null,
  cycle            jsonb not null default '[]',
  completed_cycles integer not null default 0,
  cycle_started_at date not null,
  updated_at       timestamptz not null default now(),
  primary key (user_id, plan_id),
  foreign key (user_id, plan_id) references plans (user_id, id) on delete cascade
);

create table exams (
  user_id    uuid not null,
  id         text not null,
  plan_id    text not null,
  date       date not null,
  name       text not null,
  style      text not null check (style in ('multiple', 'true_false')),
  board      text not null default '',
  time_spent integer not null default 0,
  rows       jsonb not null default '[]',
  comment    text not null default '',
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  foreign key (user_id, plan_id) references plans (user_id, id) on delete cascade
);
create index exams_plan_idx on exams (user_id, plan_id, date);

create table reminders (
  user_id    uuid not null references users on delete cascade,
  id         text not null,
  text       text not null,
  date       date,
  done       boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table files (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users on delete cascade,
  plan_id     text,
  subject_id  text,
  name        text not null,
  mime        text not null,
  size        bigint not null check (size >= 0),
  -- caminho relativo dentro do armazenamento (UPLOAD_DIR)
  storage_key text not null unique,
  created_at  timestamptz not null default now(),
  foreign key (user_id, plan_id) references plans (user_id, id) on delete set null (plan_id),
  foreign key (user_id, subject_id) references subjects (user_id, id) on delete set null (subject_id)
);
create index files_user_idx on files (user_id, created_at desc);
