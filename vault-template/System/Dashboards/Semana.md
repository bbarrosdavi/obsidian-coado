---
tags:
  - dashboards
cssclasses:
  - dashboard
  - noyaml
---
```datacorejsx
const script = await dc.require(dc.fileLink("System/Scripts/Widgets/dc-semana.jsx"));
return function View() { return script.Func(); }
```
