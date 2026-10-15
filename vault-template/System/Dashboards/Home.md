---
cssclasses:
  - noyaml
  - dashboard
  - wide-page
tags:
  - system
  - dashboards
banner: https://c4.wallpaperflare.com/wallpaper/675/644/887/artwork-the-legend-of-zelda-the-legend-of-zelda-breath-of-the-wild-link-wallpaper-preview.jpg
content-start: 221
banner-display: cover
banner-fade: -10
banner-radius: 0
"-":
---
```datacorejsx
if (dc.scriptCache?.scripts) {
    for (const k of Array.from(dc.scriptCache.scripts.keys())) {
        if (k.includes("dc-dailyWrapperV5") || k.includes("dc-studySessions")) dc.scriptCache.scripts.delete(k);
    }
}
const script = await dc.require(dc.fileLink("System/Scripts/Wrappers/dc-dailyWrapperV5.jsx"));
return function View() { return script.Func(); }
```

![[TaskNotes/Views/kanban-default.base|kanban-default]]