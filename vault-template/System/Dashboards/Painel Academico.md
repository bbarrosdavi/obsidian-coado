---
cssclasses:
  - noyaml
  - dashboard
  - wide-page
tags:
  - dashboards
  - academico
---
```datacorejsx
const { PainelAcademico } = await dc.require(dc.fileLink("System/Scripts/Widgets/dc-academicoIntegrado.jsx"));
return <PainelAcademico />;
```
