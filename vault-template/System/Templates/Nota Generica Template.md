<%*
// Nota genérica de disciplina. O botão "Nova Nota" de `dc-classView.jsx` e de
// `dc-academicDashboard.jsx` apontava para este arquivo desde sempre, mas ele
// não existia: o clique só emitia "Template missing". Criado em 25/08/2026 no
// mesmo padrão de `Notas de Aula Template.md` e `Trabalho Template.md`.

// 1. DISCIPLINA: do diretório onde a nota está sendo criada.
// Os botões de `dc-academicDashboard.jsx` criam na raiz do vault — nesse caso,
// perguntar em vez de gravar `class` vazio, que é o que torna a nota invisível.
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
    const escolhido = await tp.system.suggester(nomes, nomes, false, "Disciplina desta nota:");
    notaDisciplina = disciplinas.find(f => f.basename === escolhido);
}

const nomeDisciplina = notaDisciplina?.basename ?? "";
const fmDisciplina = notaDisciplina
    ? app.metadataCache.getFileCache(notaDisciplina)?.frontmatter
    : null;
const codigo = fmDisciplina?.codigo ?? nomeDisciplina.split(" ")[0];

// 2. ASSUNTO: o que nenhuma inferência alcança, e o que dá nome ao arquivo.
// A aula se identifica pela data e o trabalho pela entrega; a nota avulsa não
// tem nenhum dos dois, então nomear por data faria duas notas do mesmo dia
// colidirem.
const assunto = await tp.system.prompt("Assunto da nota:", "");
const nomeFinal = `${codigo} ${assunto}`.trim();

// 3. LOCAL E NOME: a nota pertence à pasta da disciplina.
const pastaDisciplina = notaDisciplina?.parent?.path ?? "";
if (pastaDisciplina && tp.file.folder(true) !== pastaDisciplina) {
    await tp.file.move(`${pastaDisciplina}/${nomeFinal}`);
} else if (nomeFinal && nomeFinal !== tp.file.title) {
    await tp.file.rename(nomeFinal);
}
-%>
---
tags:
  - academico
categories:
  - "[[Trabalhos Curso]]"
class: "[[<% nomeDisciplina %>]]"
type: nota
status: done
date: <% tp.date.now("YYYY-MM-DD") %>
topics: []
---

# <% codigo %> - <% assunto %>

```datacorejsx
const { CourseworkView } = await dc.require(dc.fileLink("System/Scripts/Widgets/dc-courseworkView.jsx"));
return <CourseworkView />;
```

## Notas

## Referências
