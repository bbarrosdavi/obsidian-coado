<%*
// Trabalhos, exames e projetos. Antes de 25/08/2026 este arquivo era uma CÓPIA de
// uma nota real, não um template: `class: ""` vazio, `status: done`, `due_date`
// fixo em 2026-04-11 e o título "caseiro" herdado da nota de origem. O `class`
// vazio é o pior deles: é a propriedade que liga a nota à disciplina, então o
// trabalho existia e não aparecia na aba Tarefas de lugar nenhum.
// Mesma correção já aplicada em `Notas de Aula Template.md`.

// 1. DISCIPLINA: do diretório onde a nota está sendo criada.
// Os botões de `dc-classView.jsx` criam dentro da pasta da disciplina; os de
// `dc-academicDashboard.jsx` criam na raiz do vault — nesse caso, perguntar.
const disciplinas = app.vault.getMarkdownFiles().filter(f => {
    // `Disciplina Template.md` declara `type: disciplina` de verdade e apareceria
    // na lista como se fosse matéria.
    if (f.path.startsWith("System/Templates/")) return false;
    const fm = app.metadataCache.getFileCache(f)?.frontmatter;
    return fm?.type === "disciplina";
});

const pastaAtual = tp.file.folder(false);
let notaDisciplina = disciplinas.find(f => f.parent?.name === pastaAtual);

if (!notaDisciplina) {
    const nomes = disciplinas.map(f => f.basename);
    const escolhido = await tp.system.suggester(nomes, nomes, false, "Disciplina deste trabalho:");
    notaDisciplina = disciplinas.find(f => f.basename === escolhido);
}

const nomeDisciplina = notaDisciplina?.basename ?? "";
const fmDisciplina = notaDisciplina
    ? app.metadataCache.getFileCache(notaDisciplina)?.frontmatter
    : null;
const codigo = fmDisciplina?.codigo ?? nomeDisciplina.split(" ")[0];

// 2. TIPO: os botões já codificam a espécie no nome do arquivo
// ("ELT74A Exame 08-26", "Projeto-2026-08-25-223000"). Ler dali evita uma
// pergunta redundante. O vocabulário gravado é o mesmo do <select> de
// `dc-courseworkView.jsx` — `trabalho` NÃO é um valor válido, é o guarda-chuva.
const titulo = tp.file.title;
let tipo = /exame|exam/i.test(titulo) ? "exame"
    : /projeto|project/i.test(titulo) ? "projeto"
    : /trabalho|tarefa/i.test(titulo) ? "tarefa"
    : null;

if (!tipo) {
    // Mesmas opções do <select> de tipo em `dc-courseworkView.jsx`.
    const rotulos = ["Tarefa", "Exame", "Projeto", "Quiz", "Prática", "Revisão", "Leitura", "Redação"];
    const valores = ["tarefa", "exame", "projeto", "quiz", "pratica", "revisao", "leitura", "redação"];
    tipo = await tp.system.suggester(rotulos, valores, false, "Tipo deste trabalho:");
}

// 3. ENTREGA: só `due_date`. O TaskNotes é dono do frontmatter de nota
// `tipo/task` e mapeia due -> due_date, apagando um `due` que se escrevesse
// aqui. O `Trabalhos de Curso.base` e os widgets já leem `due_date`.
// `scheduled` é o que põe a tarefa NA AGENDA do TaskNotes; sem ele a nota
// aparece como tarefa sem data e não entra em nenhuma view de calendário.
const entregaDigitada = (await tp.system.prompt("Data de entrega:", tp.date.now("YYYY-MM-DD"))) ?? "";
// Só a data vai para due_date (texto junto quebrava o TaskNotes: "2026-09-27 APS 5").
// O que vier além da data continua no nome da nota, como antes.
const entrega = (entregaDigitada.match(/\d{4}-\d{2}-\d{2}/) || [tp.date.now("YYYY-MM-DD")])[0];
const entregaResto = entregaDigitada.replace(entrega, "").replace(/^[\s_-]+/, "").trim();

// 4. NOME E LOCAL. O nome só muda se for descartável (o "Untitled" do Obsidian e
// o "Trabalho-<timestamp>" do botão da dashboard), nunca um nome já escolhido.
// O local é sempre a pasta da disciplina: os botões de `dc-academicDashboard.jsx`
// criam em `app.vault.getRoot()`, então sem o move o trabalho fica solto na raiz.
const rotuloTipo = { tarefa: "Trabalho", exame: "Exame", projeto: "Projeto", quiz: "Quiz", pratica: "Prática", revisao: "Revisão", leitura: "Leitura", "redação": "Redação" }[tipo] ?? "Trabalho";
const descartavel = /^(Untitled|Sem t[íi]tulo)/i.test(titulo) || /^[\wÀ-ú]+-\d{4}-\d{2}-\d{2}-\d{6}$/.test(titulo);
const nomeFinal = descartavel ? `${codigo} ${rotuloTipo} ${entrega.slice(5)}${entregaResto ? " " + entregaResto : ""}` : titulo;

const pastaDisciplina = notaDisciplina?.parent?.path ?? "";
if (pastaDisciplina && tp.file.folder(true) !== pastaDisciplina) {
    await tp.file.move(`${pastaDisciplina}/${nomeFinal}`);
} else if (nomeFinal !== titulo) {
    await tp.file.rename(nomeFinal);
}

// Cabeçalho sem repetir o código, que já está no nome do arquivo.
const tituloCurto = nomeFinal.replace(new RegExp(`^${codigo}\\s*`), "");
-%>
---
tags:
  - tipo/task
  - academico
categories:
  - "[[Trabalhos Curso]]"
class: "[[<% nomeDisciplina %>]]"
type: <% tipo %>
status: open
priority: normal
due_date: <% entrega %>
scheduled: <% tp.date.now("YYYY-MM-DD") %>
created: <% tp.date.now("YYYY-MM-DD") %>
nota:
---

# <% codigo %> - <% tituloCurto %>

```datacorejsx
const { CourseworkView } = await dc.require(dc.fileLink("System/Scripts/Widgets/dc-courseworkView.jsx"));
return <CourseworkView />;
```

## Requisitos / Detalhes

- [ ] 

## Resolução / Rascunho
