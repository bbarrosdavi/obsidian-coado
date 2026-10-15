<%*
const termName = await tp.system.prompt("Nome do Semestre (ex: Primavera 2026)");
const start = await tp.system.prompt("Data de Inicio (AAAA-MM-DD)", "2026-01-05");
const end = await tp.system.prompt("Data de Fim (AAAA-MM-DD)", "2026-04-19");
await tp.file.rename(termName);
await tp.file.move("System/Academico/Semestres/" + termName);
_%>
---
tags: [semestre, academico]
status: active
start: <% start %>
end: <% end %>
---
# <% termName %>

![[Disciplinas.base#Por Semestre]]