---
tags:
  - academico
categories:
  - "[[Disciplinas]]"
codigo: CALC1
disciplina: Cálculo Diferencial e Integral I
professor: Prof. Exemplo
creditos: 6
semestre: 2026-02
type: disciplina
natureza: pratica
prioridade: alta
meta_nota: 8.0
status: open
priority: normal
scheduled: 2026-08-11T08:00
recurrence: DTSTART:20260811T080000Z;FREQ=WEEKLY;BYDAY=TU,TH;UNTIL=20261218
recurrence_anchor: scheduled
conteudo_programatico:
  - id: t01
    aula: 1
    nome: Limites e Teorema do Confronto
  - id: t02
    aula: 2
    nome: Regras de Derivação e Regra da Cadeia
  - id: t03
    aula: 3
    nome: Otimização e Taxas Relacionadas
  - id: t04
    aula: 4
    nome: Teorema Fundamental do Cálculo
  - id: t05
    aula: 5
    nome: Integração por Substituição e por Partes
cssclasses:
  - dashboard
  - wide-page
---

# CALC1 - Cálculo Diferencial e Integral I

## Avaliações

| Avaliação | Peso | Data | Conteúdo |
|---|---|---|---|
| **Prova 1** | 50% | 18/11/2026 | Limites e Derivadas |
| **Prova 2** | 50% | 12/12/2026 | Integrais |

```datacorejsx
const { ClassView } = await dc.require(dc.fileLink("System/Scripts/Widgets/dc-classView.jsx"));
return <ClassView />;
```

```datacorejsx
const { SubjectDashboard } = await dc.require(dc.fileLink("System/Scripts/Widgets/dc-subjectMetrics.jsx"));
return <SubjectDashboard />;
```

![[Trabalhos de Curso.base#Por Disciplina|embed-clean]]
