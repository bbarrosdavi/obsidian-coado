-- Relógio (Wear OS): sessões de dispositivo e códigos de pareamento.
--
-- O relógio não faz o fluxo do Google. Em Configurações, o navegador pede um código curto que
-- vale por poucos minutos; o relógio troca esse código por um token longo (Authorization: Bearer),
-- que vira uma sessão comum da conta, só que de outro tipo e com validade maior. Ela aparece em
-- "Onde você está conectado" e pode ser encerrada de lá, como qualquer navegador.

alter table sessions
  add column kind text not null default 'web' check (kind in ('web', 'device'));

create table pair_codes (
  code       text primary key,
  user_id    uuid not null references users on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index pair_codes_user_idx on pair_codes (user_id);
