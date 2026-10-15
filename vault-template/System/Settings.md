---
tags:
  - settings
  - configuracao
cssclasses:
  - dashboard
widget-theme: mewSpinClean
color-override: ""
flashy-mode: false
widget-backgrounds: false
show-weekly-plan: true
__preview_toggle_on: false
__preview_toggle_off: false
installed-modules:
  - id: tracker
    label: Tendências
    icon: 📉
    widget: dc-activityTracker
    description: Heatmaps & trend graphs
  - id: morning
    label: Manhã
    icon: 🌅
    widget: dc-sleepTracker
    description: Sleep tracking & daily plan viewer
  - id: activities
    label: Atividades
    icon: 📊
    widget: dc-activityLogger
    description: Log and track daily activities
  - id: meals
    label: Refeições
    icon: 🍽️
    widget: dc-todayMenu
    description: Meal planning & nutrition tracking
  - id: journal
    label: Diário
    icon: 📝
    widget:
    description: Quick access to the daily journal
  - id: movement
    label: Movimento
    icon: 💪
    widget: dc-workoutToday
    description: Daily workout tracking
  - id: nav
    label: Navegação
    icon: ""
    widget:
    description: Espelho da barra de navegação do fim da Home V5 (só existe na V5)
  - id: evening
    label: Noite
    icon: 🌙
    widget: dc-eveningReflection
    description: Evening reflection & gratitude
installed-dashboards: []
activities:
  - id: sleep
    name: Sono
    type: value
    field: sleep-hours
    goal: 8
    unit: horas
    icon: 🌙
    color: "#00B894"
    hidden: true
    managed: true
    managedBy: dc-sleepTracker
  - id: mood
    name: Humor
    type: value
    field: mood
    goal: 5
    icon: 😊
    color: "#A29BFE"
    hidden: true
    managed: true
    managedBy: dc-sleepTracker
  - id: energy
    name: Energia
    type: value
    field: energy
    goal: 5
    icon: ⚡
    color: "#FDCB6E"
    hidden: true
    managed: true
    managedBy: dc-sleepTracker
  - id: water
    name: Água
    type: value
    field: water-ml
    goal: 3000
    unit: ml
    icon: 💧
    color: "#0984E3"
    hidden: true
    managed: false
  - id: gratitude
    name: Gratitude
    type: count
    field: gratitude
    icon: ❤️
    color: "#FD79A8"
    hidden: true
    managed: false
  - id: study
    name: Study
    type: value
    field: study-hours
    goal: 4
    unit: horas
    icon: 📚
    color: "#9B59B6"
    increment: 0.5
    hidden: false
    managed: false
    pomodoro: true
    pomodoroTag: academico
  - id: exercise
    name: Exercício
    type: value
    field: exercise-minutes
    goal: 30
    unit: min
    icon: 🏋️
    color: "#E17055"
    hidden: true
    managed: true
    managedBy: dc-workoutToday
    goalManagedBy: weeklyWorkout
  - id: workout-days
    name: Dias de treino
    type: count
    field: workout-completed
    goal: 4
    unit: dias/semana
    icon: 💪
    color: "#6C5CE7"
    hidden: true
    managed: true
    goalManagedBy: weeklyWorkout
  - id: calories
    name: Calories
    type: value
    field: consumed-calories
    goal: 2000
    unit: kcal
    icon: 🔥
    color: "#FF7675"
    hidden: true
    managed: true
    managedBy: dc-todayMenu
    goalManagedBy: mealPlanner
  - id: protein
    name: Protein
    type: value
    field: consumed-protein
    goal: 150
    unit: g
    icon: 🥩
    color: "#E17055"
    hidden: true
    managed: true
    managedBy: dc-todayMenu
    goalManagedBy: mealPlanner
  - id: carbs
    name: Carbs
    type: value
    field: consumed-carbs
    goal: 250
    unit: g
    icon: 🍞
    color: "#FDCB6E"
    hidden: true
    managed: true
    managedBy: dc-todayMenu
    goalManagedBy: mealPlanner
  - id: fat
    name: Fat
    type: value
    field: consumed-fat
    goal: 65
    unit: g
    icon: 🥑
    color: "#00B894"
    hidden: true
    managed: true
    managedBy: dc-todayMenu
    goalManagedBy: mealPlanner
  - id: activity_1775332368527
    name: Meditar
    field: meditar
    type: boolean
    color: "#6dfd8a"
    icon: 🧘🏻
    managed: false
    hidden: true
  - id: activity_1776118899390
    name: Economia
    field: economia
    type: rating
    goal: 100
    color: "#18b404"
    icon: 💸
    managed: false
    hidden: true
    max: 50
  - id: activity_1787588299342
    name: trabalho
    field: horas_trabalho
    type: value
    goal: 6
    unit: hr
    color: "#00CEC9"
    icon: 📊
    increment: 0.5
    managed: false
    hidden: false
installed-capsules:
  active-af:
    version: 1.1.0
    installedAt: 2026-04-03T03:34:10.174Z
    files:
      - System/Categories/Journal.md
      - System/Dashboards/Activity Manager.md
      - System/Scripts/Widgets/dc-activities.jsx
      - System/Scripts/Widgets/dc-activityLogger.jsx
      - System/Scripts/Widgets/dc-activityManager.jsx
      - System/Scripts/Widgets/dc-activityTracker.jsx
      - System/Scripts/Widgets/dc-eveningReflection.jsx
      - System/Scripts/Widgets/dc-journalNav.jsx
      - System/Scripts/Widgets/dc-randomQuote.jsx
      - System/Scripts/Widgets/dc-sleepTracker.jsx
      - System/Scripts/Widgets/dc-waterTracker.jsx
      - System/Templates/Bases/Diario.base
      - System/Templates/Journal Template.md
  academic-af:
    version: 1.0.0
    installedAt: 2026-02-17T21:17:01.367Z
    files:
      - System/Categories/Classes.md
      - System/Categories/Coursework.md
      - System/Dashboards/Academic Dashboard.md
      - System/Scripts/Widgets/dc-academicDashboard.jsx
      - System/Scripts/Widgets/dc-classView.jsx
      - System/Scripts/Widgets/dc-courseworkView.jsx
      - System/TaskNotes/Views/agenda-default.base
      - System/TaskNotes/Views/calendar-default.base
      - System/TaskNotes/Views/kanban-default.base
      - System/TaskNotes/Views/kanban-academico.base
      - System/TaskNotes/Views/mini-calendar-default.base
      - System/TaskNotes/Views/relationships.base
      - System/TaskNotes/Views/tasks-default.base
      - System/Templates/Bases/Disciplinas.base
      - System/Templates/Bases/Trabalhos de Curso.base
      - System/Templates/Class Template.md
      - System/Templates/Coursework Template.md
      - System/Templates/Lecture Notes Template.md
      - System/Templates/Term Template.md
  academic-af examples:
    version: 1.0.0
    installedAt: 2026-04-03T03:33:53.860Z
    files:
      - System/Academic/Classes/ACU-201 Acu Test/ACU-201 Acu Test.md
      - System/Academic/Classes/ACU-201 Acu Test/ACU-201 Assignment 01-17.md
      - System/Academic/Classes/ACU-201 Acu Test/ACU-201 Exam 01-17.md
      - System/Academic/Classes/CSS-101 css snippets/CSS-101 Assignment 01-17.md
      - System/Academic/Classes/CSS-101 css snippets/CSS-101 Exam 01-17.md
      - System/Academic/Classes/CSS-101 css snippets/CSS-101 Lecture 01-17.md
      - System/Academic/Classes/CSS-101 css snippets/CSS-101 css snippets.md
      - System/Academic/Classes/ENG-101 English Class Example/ENG-101 Assignment 01-14.md
      - System/Academic/Classes/ENG-101 English Class Example/ENG-101 English Class Example.md
      - System/Academic/Classes/ENG-101 English Class Example/ENG-101 Exam 01-14.md
      - System/Academic/Classes/ENG-101 English Class Example/ENG-101 Lecture 01-14.md
      - System/Academic/Classes/ENG-101 English Class Example/ENG-101 Project 01-14.md
      - System/Academic/Terms/Spring 2026.md
  workout-af:
    version: 1.0.0
    installedAt: 2026-04-03T03:34:02.865Z
    files:
      - System/Assets/Anatomy/INKSCAPE_GUIDE.md
      - System/Assets/Anatomy/Muscles_front_and_back.svg
      - System/Assets/Anatomy/PATH_REFERENCE.md
      - System/Assets/Anatomy/all_paths_data.json
      - System/Assets/Anatomy/comprehensive_muscle_mapper.html
      - System/Assets/Anatomy/muscle_data.json
      - System/Assets/Anatomy/muscle_helper.py
      - System/Assets/Anatomy/muscle_mapper.html
      - System/Assets/Anatomy/muscle_mapper_v2.html
      - System/Assets/Anatomy/muscle_mapping.json
      - System/Assets/Anatomy/muscle_paths.txt
      - System/Assets/Anatomy/muscles_labeled.svg
      - System/Categories/Exercise.md
      - System/Categories/Workout Plan.md
      - System/Planejadores/Planejador de Exercicio.md
      - System/Scripts/Componentes/dc-exercisePicker.jsx
      - System/Scripts/Widgets/dc-muscleMap.jsx
      - System/Scripts/Widgets/dc-weeklyWorkout.jsx
      - System/Scripts/Widgets/dc-workoutBuilder.jsx
      - System/Scripts/Widgets/dc-workoutToday.jsx
      - System/Templates/Bases/Exercicio.base
      - System/Templates/Bases/Plano de Treino.base
      - System/Templates/Exercise Template.md
      - System/Templates/Workout-Plan Template.md
  kitchen-af:
    version: 1.0.0
    installedAt: 2026-04-03T03:34:04.767Z
    files:
      - System/Categories/Meal Plans.md
      - System/Categories/Recipes.md
      - System/Planejadores/Planejador de Refeicoes.md
      - System/Scripts/Widgets/dc-mealPlanner.jsx
      - System/Scripts/Widgets/dc-recipeEditor.jsx
      - System/Scripts/Widgets/dc-shoppingList.jsx
      - System/Scripts/Widgets/dc-todayMenu.jsx
      - System/Templates/Bases/Planos de Refeicoes.base
      - System/Templates/Bases/Receitas.base
      - System/Templates/Meal Plan Template.md
      - System/Templates/Recipe Template.md
  rice-af:
    version: 1.0.0
    installedAt: 2026-04-03T03:45:48.167Z
    files:
      - System/Dashboards/Theme-Dashboard.md
      - System/Themes/default2.md
      - System/Themes/mewSpin.md
      - System/Themes/mewSpinClean.md
      - System/Themes/bongoCat.md
      - System/Themes/Charizard.md
      - System/Themes/dittoDance.md
      - System/Themes/e-ink-01.md
      - System/Themes/orangeOrangu.md
      - System/Themes/rareParrot.md
      - System/Themes/style-settings-crouchingTiger.json
      - System/Themes/style-settings-hiddenDragon.json
      - System/Themes/style-settings-killaBee.json
      - System/Themes/style-settings-makoBlue.json
      - System/Themes/style-settings-mewSpin.json
      - System/Themes/style-settings-mewSpinClean.json
      - System/Themes/style-settings-redHawk.json
      - System/Themes/style-settings-savageCroc.json
      - System/Themes/style-settings-violetViper.json
      - System/Themes/style-settings-whiteCrane.json
  duration: 5
  breathIn: 4
  breathHold: 0
  breathOut: 4
  breathHoldOut: 0
  preset: simple
  colors:
    - "#7c3aed"
    - "#7c3aed"
  colorMode: gradient
  animation: mandala
  audioEnabled: true
  audioStart: true
  audioEnd: true
  audioBreath: false
  volume: 0.5
  customAudioStart: ""
  customAudioEnd: ""
active-tracker-layers:
  - activity_1787588299342
  - sleep
  - energy
  - study
---

```datacorejsx
const { Settings } = await dc.require(dc.fileLink("System/Scripts/Widgets/dc-settings.jsx"));
return <Settings />;
```
