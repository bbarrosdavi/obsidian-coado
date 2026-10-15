<%*
// 1. PROMPT THE USER
const planName = await tp.system.prompt("Nome do Treino (ex: Dia de Perna)", "Novo Treino");
const focus = await tp.system.prompt("Foco (ex: Quadríceps e Panturrilhas)", "Condicionamento Geral");
const duration = await tp.system.prompt("Duração (minutos)", "45");
const difficulty = await tp.system.prompt("Dificuldade (ex: Intermediário)", "Intermediário");

// 2. RENAME THE FILE
await tp.file.rename(planName);

// 3. GENERATE THE FILE CONTENT
// Chaves lidas pelos widgets (dc-workoutBuilder, dc-workoutToday): focus, duration,
// warmup, exercises, cooldown. As antigas em português (foco, duracao, aquecimento,
// exercicios, desaquecimento) não eram lidas por nenhum widget.
// We use tR (Template Response) to output the string using the variables above.
tR += `---
categories:
  - "[[Plano de Treino]]"
focus: ${focus}
duration: ${duration}
dificuldade: ${difficulty}
warmup: []
exercises: []
cooldown: []
created: ${tp.date.now("YYYY-MM-DD")}
---

\`\`\`datacorejsx
const script = await dc.require(dc.fileLink("System/Scripts/Widgets/dc-workoutBuilder.jsx"));
return function View() { return script.Func(); }
\`\`\`

# ${planName}

**Foco:** ${focus}
**Duração:** ~${duration} minutos
**Dificuldade:** ${difficulty}

---

## Acompanhamento do Progresso

Acompanhe seu desempenho nas notas diárias:
- Peso usado
- Repetições completadas
- Nível de energia
- Notas sobre a forma

## Relacionado

- [[System/Categorias/Exercicio|Biblioteca de Exercícios]]
- [[Planejador de Exercicio|Planejador Semanal de Exercícios]]
`
%>