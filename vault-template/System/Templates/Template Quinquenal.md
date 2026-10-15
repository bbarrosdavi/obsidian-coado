---
creation date: <% tp.file.creation_date("YYYY-MM-DD HH:mm") %>
periodo: <% 
  const y = tp.date.now("YYYY"); 
  const start = y - (y % 5);
  tR += start + "-" + (start + 4);
%>
tags:
  - periodico
  - quinquenal
---

# Visão do Quinquênio <% 
  const year = parseInt(tp.date.now("YYYY")); 
  const qStart = year - (year % 5);
  tR += qStart + "-" + (qStart + 4);
%>

> [!abstract]- 📝 Reflexões de Longo Prazo
> ![[System/Periodicos/Journals/Quinquenais/<% 
  const y2 = parseInt(tp.date.now("YYYY")); 
  const start2 = y2 - (y2 % 5);
  tR += start2 + "-" + (start2 + 4);
%> Diario]]

> [!abstract]- 🎯 Projeto de 5 Anos
> ![[System/Planos/Quinquenais/<% 
  const y3 = parseInt(tp.date.now("YYYY")); 
  const start3 = y3 - (y3 % 5);
  tR += start3 + "-" + (start3 + 4);
%> Plano]]

## 📅 Anos deste Quinquênio

```dataview
TABLE 
  file.cday AS "Fechado em"
FROM "System/Periodicos/Anuais"
WHERE substring(file.name, 0, 4) >= "<% qStart %>" AND substring(file.name, 0, 4) <= "<% qStart + 4 %>"
SORT file.name ASC
```