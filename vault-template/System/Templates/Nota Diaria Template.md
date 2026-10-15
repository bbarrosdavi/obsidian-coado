---
creation date: 2026-04-04 16:51
modification date: NaN
tags:
  - daily
  - journal
banner: "Attachments/Art Animation GIF by makio135.gif"
cssclasses:
  - dashboard
  - journal-theme
banner_icon: 🌸
banner_x: 0.5
banner_y: 0.38
week: 2026-14
sleep-quality:
sleep-hours:
weight:
mood:
energy: 0
water-ml: 0
exercise:
exercise-minutes:
breakfast: ""
lunch: ""
dinner: ""
snacks: []
consumed-calories: 0
consumed-protein: 0
consumed-carbs: 0
consumed-fat: 0
diet-quality:
gratitude:
stress-level:
study-hours:
learning: false
deep-work: false
cleaned: false
planned: false
creative: false
highlight:
challenge:
health-score: 😔 1.0/5
sleep-bedtime: 23:15
sleep-wakeup: 06:45
night-score: 0
night-checked: 0
night-total: 5
mood-evening: 4
emotions:
horas_trabalho: 0
---
Nothing here but frontmatter


This is a daily quote widget. It actually searches for your quote notes and will pull them at random when loaded. Start building your quote or joke library today!
```datacorejsx
const scriptPath = "System/Scripts/Widgets/dc-randomQuote.jsx";  // ⬅️ replace it with your jsx file path!
const target = dc.fileLink(scriptPath);
const result = await dc.require(target);
const view = result?.renderedView ?? result?.View ?? result;  
const Func = result?.Func ?? null;

return function View() {
    const currentFile = dc.useCurrentFile();
    if (Func) {
        return Func({ currentFile, scriptPath });
    }
    return view ?? <p>Failed to render</p>;
}
```
> [!abstract]+ 🎯 Plano para Hoje
> ![[System/Planos/<% tp.date.now("YYYY-MM-DD") %> Plano]]

> [!abstract]+ 📝 Journal Diário
> ![[System/Periodicos/Journals/Diarios/<% tp.date.now("YYYY-MM-DD") %> Diario]]




