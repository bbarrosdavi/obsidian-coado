# Obsidian Coado / Trilha — Ecossistema Acadêmico Completo (Vault + Tinteiro + Trilha + Widget Niri/DMS)

Ecossistema acadêmico integrado em **Markdown/YAML puro** dentro do **Obsidian**, combinando:

1. **`vault-template/` — Template de Vault Acadêmica pronta para uso ("no preset")**:
   - **Painéis Datacore (`System/Scripts/`)**:
     - `dc-academicoIntegrado.jsx` (`System/Dashboards/Painel Academico.md`): unifica o Academic Dashboard (disciplinas, prazos, entregas, aulas, kanban, calendário) com o motor de ciclo de estudos, revisões espaçadas, constância e estatísticas do **Coado / Trilha**.
     - `dc-coadoPainel.jsx` (`System/Academico/Semestres/<Semestre> Estudo.md`): 6 abas completas (Início, Planejamento/Ciclo, Revisões + Anki, Estatísticas, Edital/Ementa, Histórico) + modal de registro de estudo.
     - `dc-classView.jsx`, `dc-courseworkView.jsx`, `dc-studySessions.jsx`, `dc-subjectMetrics.jsx`, `dc-secretaria.jsx` e `dc-semana.jsx`.
   - **Preset `.obsidian/` completo já configurado**:
     - **[Tinteiro](./tinteiro)** pré-instalado e configurado (`Ink/Writing` e `Ink/Drawing` com renderização WebGL2 na GPU a 60+ fps, compatível com `.svg` do Ink).
     - **TaskNotes** pré-configurado com Pomodoro, notas-razão `<COD> Estudo <Semestre>.md` e views `.base` (`kanban-academico.base`, `calendar-default.base`, `agenda-default.base`).
     - **Datacore**, **Templater** (templates de `Semestre`, `Disciplina`, `Notas de Aula` com seção Tinteiro e `Trabalho/Exame`), **Style Settings**, **Kanban** e tema **Primary** + snippets CSS.
   - **Semestre e disciplinas de exemplo inclusos (`2026-02`)**: abre direto no Obsidian funcionando sem configuração manual.

2. **`dms-plugin/vaultAcademico/` + `niri/` — Widget Desktop para Niri & Dank Material Shell (DMS)**:
   - Janela flutuante em **Liquid Glass** (`niri-fixar-git` / GPU blur) + pill compacto na **DankBar**.
   - Exibe e controla em tempo real:
     - **Próxima sessão do ciclo** (com play/pause direto no `tasknotesPomodoro`, botão de pular sessão `⏭` e clique para puxar qualquer matéria para `#1` da fila).
     - **4 cards de indicadores** (`Semana`, `Sequência`, `Pendências`, `Avaliação`).
     - **Faixa de constância semanal** (7 cards dos dias da semana).
     - **4 abas**: `Ciclo`, `Prazos` (tarefas e provas com checkbox direto na vault), `Revisões` (revisões espaçadas 1/7/30d + disparo do `AnkiConnect`) e `Matérias` (progresso da ementa com toggle de tópicos).
     - **Gaveta de registro rápido de estudo** com atualização atômica do YAML da vault.

3. **`trilha/` + `bridge/` — Servidor Web/API, Apps Android + Wear OS (Trilha / Coado) e Ponte Bidirecional**:
   - `trilha/`: stack completa (`apps/api`, `apps/web`, `apps/android` para celular e relógio Wear OS) com modo universidade (avaliações, ciclo de estudos, revisões e estatísticas).
   - `bridge/coado_ponte.py`: sincronização bidirecional em 3 vias entre a **Vault Obsidian**, a API do **Trilha / Coado** e a coleção do **Anki** (`collection.anki2`).

4. **`tinteiro/` — Plugin de Escrita e Desenho à Mão em WebGL2 para o Obsidian**:
   - Código-fonte completo e bundle compilado (`dist/`), também pré-instalado em `vault-template/.obsidian/plugins/tinteiro`.

---

## Estrutura do Repositório

```text
obsidian-coado/
├── vault-template/                 # Vault Obsidian pronta para abrir com todo o preset
│   ├── .obsidian/                  # Tinteiro, Datacore, TaskNotes, Templater, Primary, snippets
│   └── System/
│       ├── Academico/              # Semestres (2026-02 + 2026-02 Estudo) e Disciplinas de exemplo
│       ├── Dashboards/             # Painel Academico.md, Academic Dashboard.md, Home.md, Semana.md
│       ├── Scripts/                # Core (dc-coadoCore.jsx) + Widgets (dc-coadoPainel, dc-academicoIntegrado...)
│       ├── TaskNotes/Views/        # kanban-academico.base, calendar-default.base, agenda-default.base
│       └── Templates/              # Disciplina, Notas de Aula (c/ Tinteiro), Trabalho/Exame, Semestre
├── dms-plugin/
│   └── vaultAcademico/             # Plugin QML + motor Python para Dank Material Shell (Niri)
├── niri/
│   └── vault-academico.kdl         # Regra window-rule Liquid Glass para o Niri
├── bridge/
│   ├── coado_ponte.py              # Ponte bidirecional Vault <-> Trilha/Coado <-> Anki
│   └── coado.env.example           # Exemplo de variáveis de ambiente da ponte
├── trilha/                         # Web + API (Docker) + Apps Android (Phone & Wear OS)
├── tinteiro/                       # Código-fonte e build do plugin Tinteiro (WebGL2 Ink)
└── install.sh                      # Instalador automatizado
```

---

## Instalação Rápida

```bash
git clone https://github.com/bbarrosdavi/obsidian-coado.git
cd obsidian-coado
chmod +x install.sh
./install.sh
```

Para instalar o sistema acadêmico e o preset do Tinteiro sobre uma vault existente:

```bash
./install.sh /caminho/para/sua/vault
```

### Ativar o Widget no Dank Material Shell (Niri)

Em `~/.config/DankMaterialShell/plugin_settings.json`:

```json
"vaultAcademico": {
  "enabled": true,
  "caminhoVault": "/caminho/para/sua/vault",
  "semestre": "2026-02",
  "abrirAoIniciar": true,
  "mostrarDisciplinaNaBarra": false,
  "mostrarHorasNaBarra": false
}
```

E em `~/.config/DankMaterialShell/settings.json` (dentro de `rightWidgets`):

```json
{
  "id": "vaultAcademico",
  "enabled": true
}
```

Reinicie o DMS:

```bash
dms restart
```

### Comandos IPC do Widget (`dms ipc`)

| Comando | Ação |
|---|---|
| `dms ipc call vaultAcademico toggle` | Abre ou recolhe a janela do widget acadêmico |
| `dms ipc call vaultAcademico show` | Abre a janela flutuante |
| `dms ipc call vaultAcademico hide` | Recolhe a janela flutuante |
| `dms ipc call vaultAcademico startNext` | Inicia o Pomodoro na próxima sessão do ciclo |
| `dms ipc call vaultAcademico skipNext` | Pula a sessão atual para o fim da fila do ciclo |
| `dms ipc call vaultAcademico openDashboard` | Abre o `Painel Academico.md` no Obsidian |
| `dms ipc call vaultAcademico refresh` | Recarrega imediatamente os dados da vault |

---

## Licença

Distribuído sob a licença MIT. Consulte [`LICENSE`](./LICENSE).
