<%*
// 1. Solicita Nome do Projeto/MOC
const mocName = await tp.system.prompt("Nome do Projeto/Tópico (Ex: DRL)");
if (!mocName) return;

// 2. Solicita Pasta de Destino (Recursiva para permitir subpastas como LAMIA/Aravita)
const folders = app.vault.getAllLoadedFiles()
    .filter(x => x instanceof tp.obsidian.TFolder)
    .filter(x => !x.path.startsWith(".") && !x.path.startsWith("Ω") && x.name !== "bin" && !x.path.includes("Ω_Anexos") && !x.path.includes("Templates"))
    .map(x => x.path)
    .sort();

const targetFolder = await tp.system.suggester(folders, folders, false, "Selecione a pasta onde criar o MOC (o script criará uma subpasta com o nome do projeto)");
if (!targetFolder) return;

// 3. Prepara Caminhos e Pastas
const safeName = mocName.replace(/[/\\:]/g, "-").trim();
const projectFolder = `${targetFolder}`;

const fileName = `MOC_${safeName.replace(/ /g, "_")}`;

// 5. Conteúdo do Template
const content = `---
title: "${mocName} - Map of Content"
tags: [tipo/moc, status/ativo]
created: ${tp.date.now("YYYY-MM-DD HH:mm")}
modified: ${tp.date.now("YYYY-MM-DD HH:mm")}
project: [[${fileName}|${mocName}]]
status: ativo
priority: "alta"
cssclasses: dashboard, wide-page
---
# ${mocName} - Map of Content

> [!note]- Navegação
> [[GES_DASHBOARD_CENTRAL|Central]] → **${mocName}**

> [!info]+ Subprojeto ${mocName}
> Descrição do sistema/projeto **${mocName}** para otimização de gestão de estoque usando simulador diferenciável e políticas neurais.
---
## Visão Geral ${mocName}

> [!abstract]+ Objetivo
> Implementar sistema de **${mocName}** para otimização de gestão de estoque usando:
> - Simulador diferenciável (backpropagation)
> - Versão paramétrica otimizada
> - Políticas neurais (POMDP)
>
> **Fase Atual**: 1 - Planejamento
> **Marco**: Definição de Escopo

> [!tip]+ Progresso ${mocName}
> 
> \`\`\`dataview
> TABLE WITHOUT ID
>   length(filter(rows, (r) => r.status = "done")) as "Done",
>   length(filter(rows, (r) => r.status = "in-progress")) as "In Progress",
>   length(filter(rows, (r) => r.status = "open" OR r.status = "none")) as "Open",
>   "<progress value=\"" + string(length(filter(rows, (r) => r.status = "done"))) + "\" max=\"" + string(length(rows)) + "\"></progress> " + round(length(filter(rows, (r) => r.status = "done")) * 100.0 / length(rows), 1) + "%" as "%"
> FROM "${targetFolder}"
> WHERE contains(tags, "tipo/task")
> GROUP BY file.name
> LIMIT 1
> \`\`\`
## Documentação Técnica

> [!multi-column]
>
> > [!info]+ Planejamento e Arquitetura
> > \`\`\`dataview
> > LIST FROM "${projectFolder}/01_Gestão"
> > WHERE contains(tags, "tipo/planejamento") OR contains(tags, "tipo/gestao")
> > SORT created DESC
> > LIMIT 5
> > \`\`\`
>
> > [!info]+ Documentação Específica
> > \`\`\`dataview
> > LIST FROM "${projectFolder}/02_Docs"
> > WHERE contains(tags, "tipo/documentacao")
> > SORT created DESC
> > LIMIT 5
> > \`\`\`
>
> > [!book]+ Papers e Referências
> > - [[${projectFolder}/02_Docs/Placeholder_Paper.pdf|Placeholder Paper]]
> > - **Autor**: Tópico Relevante
> > - **Publicação**: Artigo ou Livro
> > 
> > **Links**:
> > - [Link Externo](https://example.com)
>
> > [!book]+ Dataset e Features
> > - [[${projectFolder}/01_Gestão/Placeholder_Dataset_Explicacao|Explicação Dataset]]
> > - [[${projectFolder}/01_Gestão/Placeholder_Features_Enriquecimento|Features Enriquecimento]]

> [!info]+ Documentos Técnicos (tipo/documentacao)
> \`\`\`dataview
> TABLE title AS "Título", file.folder AS "Pasta", created AS "Criado"
> FROM "${targetFolder}"
> WHERE contains(tags, "tipo/documentacao")
> SORT created DESC
> \`\`\`

> [!info]+ Notas Técnicas (tipo/nota-tecnica)
> \`\`\`dataview
> TABLE title AS "Título", file.folder AS "Pasta", created AS "Criado"
> FROM "${targetFolder}"
> WHERE contains(tags, "tipo/nota-tecnica")
> SORT created DESC
> \`\`\`
>
> ---
> > [!note]- Navegação
> > [[GES_DASHBOARD_CENTRAL|Central]] → **${mocName}**
`;

// 6. Cria o Arquivo na nova pasta
await tp.file.create_new(content, fileName, true, projectFolder);

return "";
%>
