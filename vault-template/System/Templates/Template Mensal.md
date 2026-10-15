---
creation date: <% tp.file.creation_date("YYYY-MM-DD HH:mm") %>
periodo: <% tp.date.now("YYYY-MM") %>
tags:
  - periodico
  - mensal
---

# Visão do Mês <% tp.date.now("YYYY-MM") %>

> [!abstract]- 📝 Journal Mensal
> ![[System/Periodicos/Journals/Mensais/<% tp.date.now("YYYY-MM") %> Diario]]

> [!abstract]- 🎯 Plano de Ação do Mês
> ![[System/Planos/Mensais/<% tp.date.now("YYYY-MM") %> Plano]]

## 📊 Hábitos & Tendências (Balanço do Mês)

```dataview
TABLE 
  round(sum(sleep-hours) / length(rows), 1) + "h" AS "Sono Médio",
  round(sum(mood) / length(rows), 1) + "/5" AS "Humor Médio",
  round(sum(water-ml) / length(rows), 0) + "ml" AS "Água Média Diária"
FROM "System/Periodicos"
WHERE contains(file.name, this.periodo)
GROUP BY substring(file.name, 0, 7)
```

## ✅ Tarefas Concluídas no Mês

```dataview
TASK
FROM "System/TaskNotes"
WHERE file.tasks.status = "x" AND file.tasks.completion >= date("<% tp.date.now('YYYY-MM-01') %>")
```

## 📅 Semanas deste Mês

```dataview
TABLE 
  file.cday AS "Criado em"
FROM "System/Periodicos/Semanais"
WHERE contains(file.name, this.periodo)
SORT file.name ASC
```