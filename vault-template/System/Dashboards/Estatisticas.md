---
tags:
  - dashboards
cssclasses:
  - dashboard
  - noyaml
---
```datacorejsx
const script = await dc.require(dc.fileLink("System/Scripts/Widgets/dc-taskStats.jsx"));
return function View() { return script.Func(); }
```
