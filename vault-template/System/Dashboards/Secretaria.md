---
tags:
  - dashboards
cssclasses:
  - noyaml
  - dashboard
  - wide-page
---
```datacorejsx
const script = await dc.require(dc.fileLink("System/Scripts/Widgets/dc-secretaria.jsx"));
return function View() { return script.Func(); }
```
