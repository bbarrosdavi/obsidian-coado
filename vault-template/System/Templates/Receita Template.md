---
calories: ""
protein: ""
carbs: ""
fat: ""
type: []
---
<%*
// 1. Prompt for Recipe Name
const recipeName = await tp.system.prompt("Recipe Name (e.g. Chicken Parm)", "Untitled Recipe");
// 2. Rename the file
await tp.file.rename(recipeName);
// 3. Move to Recipes folder (Optional - Uncomment if you have a specific folder)
// await tp.file.move("Resources/Recipes/" + recipeName);
%>---
categories:
  - "[[Receitas]]"
cuisine: 
type: [] 
servings: 2
calories: 
protein: 
carbs: 
fat: 
author: []
url: 
rating: 0
created: <% tp.date.now("YYYY-MM-DD") %>
last-cooked: 
---

# 🥘 <% recipeName %>

```datacorejsx
const script = await dc.require(dc.fileLink("System/Scripts/Widgets/dc-recipeEditor.jsx"));
return function View() { return script.Func(); }
```

![[Insert Image Here]]

## 🛒 Ingredients

## 🍳 Directions

1.

## 📝 Notes


## 🛍️ Shopping List

```datacorejsx
const script = await dc.require(dc.fileLink("System/Scripts/Widgets/dc-shoppingList.jsx"));
return function View() { return script.Func(); }
```
