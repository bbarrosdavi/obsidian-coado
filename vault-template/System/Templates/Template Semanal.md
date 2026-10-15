---
creation date: <% tp.file.creation_date("YYYY-MM-DD HH:mm") %>
periodo: <% tp.date.now("YYYY-[W]WW") %>
tags:
  - periodico
  - semanal
---

# Visão da Semana <% tp.date.now("YYYY-[W]WW") %>

> [!abstract]- 📝 Journal da Semana
> ![[System/Periodicos/Journals/Semanais/<% tp.date.now("YYYY-[W]WW") %> Diario]]

> [!abstract]- 🎯 Plano de Ação Semanal
> ![[System/Planos/Semanais/<% tp.date.now("YYYY-[W]WW") %> Plano]]

## 📊 Hábitos & Tendências (Média dos Dias)

```dataview
TABLE 
  round(sum(sleep-hours) / length(rows), 1) + "h" AS "Sono Médio",
  round(sum(mood) / length(rows), 1) + "/5" AS "Humor Médio",
  round(sum(energy) / length(rows), 1) + "/5" AS "Energia Média"
FROM "System/Periodicos"
WHERE week = this.periodo
GROUP BY week
```

## ✅ Tarefas da Semana

```dataview
TASK
FROM "System/TaskNotes"
WHERE file.tasks.status = "x" AND file.tasks.completion >= date("<% tp.date.now('YYYY-MM-DD', -7) %>")
```

## 📅 Dias desta Semana

```dataview
TABLE 
  health-score AS "Pontuação",
  sleep-hours AS "Sono",
  water-ml + "ml" AS "Água",
  exercise AS "Exercício"
FROM "System/Periodicos"
WHERE week = this.periodo
SORT file.name ASC
```