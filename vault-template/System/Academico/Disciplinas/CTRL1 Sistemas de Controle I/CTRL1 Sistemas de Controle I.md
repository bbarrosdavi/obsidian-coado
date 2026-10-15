---
tags:
  - academico
categories:
  - "[[Disciplinas]]"
codigo: CTRL1
disciplina: Sistemas de Controle I
professor: Prof. Exemplo
creditos: 4
semestre: 2026-02
type: disciplina
natureza: teorica
prioridade: alta
meta_nota: 8.5
status: open
priority: high
scheduled: 2026-08-10T10:00
recurrence: DTSTART:20260810T100000Z;FREQ=WEEKLY;BYDAY=MO,WE;UNTIL=20261218
recurrence_anchor: scheduled
conteudo_programatico:
  - id: t01
    aula: 1
    nome: Transformada de Laplace e Funções de Transferência
  - id: t02
    aula: 2
    nome: Diagramas de Blocos e Fórmula de Mason
  - id: t03
    aula: 3
    nome: Resposta Transitória de Sistemas de 1ª e 2ª Ordem
  - id: t04
    aula: 4
    nome: Critério de Estabilidade de Routh-Hurwitz
  - id: t05
    aula: 5
    nome: Lugar Geométrico das Raízes (LGR)
  - id: t06
    aula: 6
    nome: Projeto de Compensadores PID
cssclasses:
  - dashboard
  - wide-page
---

# CTRL1 - Sistemas de Controle I

## Avaliações

| Avaliação | Peso | Data | Conteúdo |
|---|---|---|---|
| **Prova 1** | 40% | 10/11/2026 | Tópicos 1 a 3 |
| **Prova 2** | 40% | 08/12/2026 | Tópicos 4 a 6 |
| **Projeto Prático** | 20% | 01/12/2026 | Controlador PID |

```datacorejsx
const { ClassView } = await dc.require(dc.fileLink("System/Scripts/Widgets/dc-classView.jsx"));
return <ClassView />;
```

```datacorejsx
const { SubjectDashboard } = await dc.require(dc.fileLink("System/Scripts/Widgets/dc-subjectMetrics.jsx"));
return <SubjectDashboard />;
```

![[Trabalhos de Curso.base#Por Disciplina|embed-clean]]
