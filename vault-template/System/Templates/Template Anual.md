---
creation date: <% tp.file.creation_date("YYYY-MM-DD HH:mm") %>
periodo: <% tp.date.now("YYYY") %>
tags:
  - periodico
  - anual
---

# Visão do Ano <% tp.date.now("YYYY") %>

> [!abstract]- 📝 Journal Anual (Review)
> ![[System/Periodicos/Journals/Anuais/<% tp.date.now("YYYY") %> Diario]]

> [!abstract]- 🎯 Metas & Planejamento Anual
> ![[System/Planos/Anuais/<% tp.date.now("YYYY") %> Plano]]

## 📊 Hábitos & Tendências (Balanço do Ano)

```dataview
TABLE 
  round(sum(sleep-hours) / length(rows), 1) + "h" AS "Sono Médio",
  round(sum(mood) / length(rows), 1) + "/5" AS "Humor Médio",
  round(sum(energy) / length(rows), 1) + "/5" AS "Energia Média",
  sum(exercise-minutes) + " min" AS "Total Exercício"
FROM "System/Periodicos"
WHERE contains(file.name, this.periodo)
GROUP BY substring(file.name, 0, 4)
```

## ✅ Grandes Conquistas (Tarefas Completadas)

```dataview
TASK
FROM "System/TaskNotes"
WHERE file.tasks.status = "x" AND file.tasks.completion >= date("<% tp.date.now('YYYY-01-01') %>")
```

## 📅 Meses deste Ano

```dataview
TABLE 
  file.cday AS "Criado em"
FROM "System/Periodicos/Mensais"
WHERE contains(file.name, this.periodo)
SORT file.name ASC
```