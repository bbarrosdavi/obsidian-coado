---
creation date: <% tp.file.creation_date("YYYY-MM-DD HH:mm") %>
tags:
  - note
  - plano
  - week
---
## Plano para <% tp.file.title.split(' ')[0] %>

## Tarefas & Backlog da Semana
- [ ] 

---

## Tarefas Diarias

```dataview
TABLE 
  file.tasks.text AS "Tarefas",
  file.tasks.completed AS "Status (Concluido)"
FROM "System/Planos"
WHERE file.name >= "<% tp.date.weekday("YYYY-MM-DD", 0) %> Plano" AND file.name <= "<% tp.date.weekday("YYYY-MM-DD", 6) %> Plano"
SORT file.name ASC
```
