<%*
// Notas de aula. Antes de 25/08/2026 este arquivo era uma CÓPIA de uma nota real,
// não um template. Trazia `date: 2026-04-04` fixo, `class: ""` vazio e o título
// "caseiro" herdado da nota de origem. Toda aula nascia com os três defeitos, e o
// `class` vazio é o pior deles: é a propriedade que monta o índice da disciplina,
// então a nota existia e o tutor não a encontrava.

// 1. DISCIPLINA: do diretório onde a nota está sendo criada.
// O caminho normal é criar dentro de System/Academico/Disciplinas/<COD Nome>/.
const disciplinas = app.vault.getMarkdownFiles().filter(f => {
    // `Disciplina Template.md` declara `type: disciplina` de verdade e apareceria
    // na lista como se fosse matéria.
    if (f.path.startsWith("System/Templates/")) return false;
    const fm = app.metadataCache.getFileCache(f)?.frontmatter;
    return fm?.type === "disciplina";
});

const pastaAtual = tp.file.folder(false);
let notaDisciplina = disciplinas.find(f => f.parent?.name === pastaAtual);

// Fora de uma pasta de disciplina, perguntar em vez de gravar vazio.
if (!notaDisciplina) {
    const nomes = disciplinas.map(f => f.basename);
    const escolhido = await tp.system.suggester(nomes, nomes, false, "Disciplina desta aula:");
    notaDisciplina = disciplinas.find(f => f.basename === escolhido);
}

const nomeDisciplina = notaDisciplina?.basename ?? "";
const fmDisciplina = notaDisciplina
    ? app.metadataCache.getFileCache(notaDisciplina)?.frontmatter
    : null;
const codigo = fmDisciplina?.codigo ?? nomeDisciplina.split(" ")[0];

// 2. DATA DA AULA: hoje por padrão, editável (aula anotada depois acontece).
const dataAula = await tp.system.prompt("Data da aula:", tp.date.now("YYYY-MM-DD"));

// 3. NOME E LOCAL. O nome só muda se for descartável (o "Untitled" do Obsidian e
// o "Aula-<timestamp>" do botão da dashboard), nunca um nome já escolhido.
// O local é sempre a pasta da disciplina: os botões de `dc-academicDashboard.jsx`
// criam em `app.vault.getRoot()`, então sem o move a aula fica solta na raiz.
const titulo = tp.file.title;
const descartavel = /^(Untitled|Sem t[íi]tulo)/i.test(titulo) || /^[\wÀ-ú]+-\d{4}-\d{2}-\d{2}-\d{6}$/.test(titulo);
const nomeFinal = descartavel ? `${codigo} Aula ${dataAula.slice(5)}` : titulo;

const pastaDisciplina = notaDisciplina?.parent?.path ?? "";
if (pastaDisciplina && tp.file.folder(true) !== pastaDisciplina) {
    await tp.file.move(`${pastaDisciplina}/${nomeFinal}`);
} else if (nomeFinal !== titulo) {
    await tp.file.rename(nomeFinal);
}
-%>
---
tags:
  - academico
categories:
  - "[[Trabalhos Curso]]"
class: "[[<% nomeDisciplina %>]]"
type: aula
status: done
date: <% dataAula %>
topics: []
---

# <% codigo %>, aula de <% dataAula %>

```datacorejsx
const { CourseworkView } = await dc.require(dc.fileLink("System/Scripts/Widgets/dc-courseworkView.jsx"));
return <CourseworkView />;
```

## Conceitos Chave

## Notas

> [!tip] Sumário

## Referências

## Caderno Manuscrito (Tinteiro)

> Use os comandos **Tinteiro: Insert new handwritten section** ou **Tinteiro: Insert new drawing** para criar blocos manuscritos GPU (WebGL2) nesta aula.
