<%*
// 1. GET TERM INFO
// Notas de semestre são identificadas pela PROPRIEDADE type (convenção de tags §Vocabulários
// de propriedade). A tag plana `semestre` foi aposentada — aceita aqui só como fallback
// para notas antigas ainda não migradas.
const termFiles = app.vault.getMarkdownFiles().filter(f => {
    const fm = app.metadataCache.getFileCache(f)?.frontmatter;
    return fm?.type === "semestre" || fm?.tags?.includes("semestre");
});
// Create a dropdown of available terms
const termOptions = termFiles.map(f => f.basename);
const selectedTermName = await tp.system.suggester(termOptions, termOptions);
const selectedTermFile = termFiles.find(f => f.basename === selectedTermName);

// Read the start/end dates from the Term Note
const termCache = app.metadataCache.getFileCache(selectedTermFile);
const termStart = termCache?.frontmatter?.start || tp.date.now("YYYY-MM-DD");
const termEnd = termCache?.frontmatter?.end || tp.date.now("YYYY-MM-DD");

// 2. GET CLASS DETAILS
const courseCode = await tp.system.prompt("Codigo da Disciplina (ex: ACU-101):");
const courseName = await tp.system.prompt("Nome da Disciplina:");
const classDays = await tp.system.prompt("Dias (MO,TU,WE,TH,FR) - Separados por virgula:", "MO,WE");
const classTime = await tp.system.prompt("Horario de Inicio (HH:MM):", "18:00");

// Optional class details
const instructor = await tp.system.prompt("Professor (opcional):", "");
const credits = await tp.system.prompt("Creditos (opcional):", "");

// 3. GENERATE RECURRENCE STRING (TaskNotes / iCal Format)
// Format: DTSTART:20260105T180000Z;FREQ=WEEKLY;BYDAY=MO,WE;UNTIL=20260419
const cleanDate = (d) => d.replaceAll("-", "");
const cleanTime = (t) => t.replaceAll(":", "") + "00";
const recurrenceString = `DTSTART:${cleanDate(termStart)}T${cleanTime(classTime)}Z;FREQ=WEEKLY;BYDAY=${classDays.toUpperCase()};UNTIL=${cleanDate(termEnd)}`;
const scheduledString = `${termStart}T${classTime}`;

// 4. FILE PLACEMENT
const fileName = `${courseCode} ${courseName}`;
const rootFolder = "System/Academico/Disciplinas";
const classFolder = `System/Academico/Disciplinas/${fileName}`; 

if (!app.vault.getAbstractFileByPath(rootFolder)) await app.vault.createFolder(rootFolder);
if (!app.vault.getAbstractFileByPath(classFolder)) await app.vault.createFolder(classFolder);

await tp.file.rename(fileName);
await tp.file.move(`${classFolder}/${fileName}`);
_%>
---
tags:
  - academico
categories:
  - "[[Disciplinas]]"

codigo: <% courseCode %>
disciplina: <% courseName %>
professor: <% instructor %>
creditos: <% credits ? parseInt(credits) : "" %>
semestre: <% selectedTermName %>
type: disciplina
status: open
priority: normal
scheduled: <% scheduledString %>
recurrence: <% recurrenceString %>
recurrence_anchor: scheduled
cssclasses:
  - dashboard
  - wide-page
---

# <% courseCode %> - <% courseName %>

```datacorejsx
const { ClassView } = await dc.require(dc.fileLink("System/Scripts/Widgets/dc-classView.jsx"));
return <ClassView />;
```

```datacorejsx
const { SubjectDashboard } = await dc.require(dc.fileLink("System/Scripts/Widgets/dc-subjectMetrics.jsx"));
return <SubjectDashboard />;
```

![[Trabalhos de Curso.base#Por Disciplina|embed-clean]]