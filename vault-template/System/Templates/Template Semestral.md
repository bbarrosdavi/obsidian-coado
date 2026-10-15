---
creation date: <% tp.file.creation_date("YYYY-MM-DD HH:mm") %>
periodo: <% 
  const month = parseInt(tp.date.now("MM"));
  const h = month <= 6 ? "H1" : "H2";
  tR += tp.date.now("YYYY") + "-" + h;
%>
tags:
  - periodico
  - semestral
---

# Visão do Semestre <% 
  const m = parseInt(tp.date.now("MM"));
  const half = m <= 6 ? "H1" : "H2";
  tR += tp.date.now("YYYY") + "-" + half;
%>

> [!abstract]- 📝 Journal Semestral (Review)
> ![[System/Periodicos/Journals/Semestrais/<% 
  const m2 = parseInt(tp.date.now("MM"));
  const half2 = m2 <= 6 ? "H1" : "H2";
  tR += tp.date.now("YYYY") + "-" + half2;
%> Diario]]

> [!abstract]- 🎯 Metas & Planejamento Semestral
> ![[System/Planos/Semestrais/<% 
  const m3 = parseInt(tp.date.now("MM"));
  const half3 = m3 <= 6 ? "H1" : "H2";
  tR += tp.date.now("YYYY") + "-" + half3;
%> Plano]]

## 📊 Hábitos & Tendências (Balanço do Semestre)

```dataview
TABLE 
  round(sum(sleep-hours) / length(rows), 1) + "h" AS "Sono Médio",
  round(sum(mood) / length(rows), 1) + "/5" AS "Humor Médio",
  round(sum(energy) / length(rows), 1) + "/5" AS "Energia Média",
  sum(exercise-minutes) + " min" AS "Total Exercício"
FROM "System/Periodicos"
WHERE contains(file.name, substring(this.periodo, 0, 4)) AND (this.periodo.endswith("H1") ? substring(file.name, 5, 7) <= "06" : substring(file.name, 5, 7) > "06")
GROUP BY substring(file.name, 0, 7)
```

## ✅ Grandes Conquistas (Tarefas Completadas)

```dataview
TASK
FROM "System/TaskNotes"
WHERE file.tasks.status = "x" AND (this.periodo.endswith("H1") ? file.tasks.completion >= date("<% tp.date.now('YYYY-01-01') %>") AND file.tasks.completion <= date("<% tp.date.now('YYYY-06-30') %>") : file.tasks.completion >= date("<% tp.date.now('YYYY-07-01') %>") AND file.tasks.completion <= date("<% tp.date.now('YYYY-12-31') %>"))
```

## 📅 Meses deste Semestre

```dataview
TABLE 
  file.cday AS "Criado em"
FROM "System/Periodicos/Mensais"
WHERE contains(file.name, substring(this.periodo, 0, 4)) AND (this.periodo.endswith("H1") ? substring(file.name, 5, 7) <= "06" : substring(file.name, 5, 7) > "06")
SORT file.name ASC
```