# Coado — web

SPA em React 19 + Vite + Tailwind. Em produção roda num nginx que também encaminha `/api` para a api;
em desenvolvimento o Vite faz esse proxy (`vite.config.ts`). Veja o [README da raiz](../../README.md) para subir tudo.

## Estrutura

- `src/App.tsx`: entrada → login → carregamento da conta → app
- `src/lib/auth.tsx`: sessão (`/api/me`), login com Google, logout, perfil
- `src/lib/store.tsx`: estado global e ações; persiste via `SyncEngine`
- `src/lib/sync.ts`: envia as diferenças em lote para `POST /api/sync`, com novas tentativas
- `src/lib/api.ts`: cliente HTTP (cabeçalho anti-CSRF, erros tipados, upload com progresso)
- `src/lib/legacy.ts`: dados antigos do `localStorage` (oferecidos na primeira entrada) e cache do tema
- `src/lib/utils.ts`: datas, formatação, agregações, ciclo, constância
- `src/components/welcome/`: apresentação da plataforma no primeiro acesso
- `src/components/cafe-art.tsx`, `art.tsx`: ilustrações SVG do tema
- `src/pages/`: telas (inclui `Login`, `Profile` e `Files`)
- `nginx/`: configuração do container (proxy, cache e cabeçalhos de segurança)

O modelo de dados fica em [`packages/shared`](../../packages/shared/src/types.ts).
