<%*
// 1. Solicitação do Título Declarativo
const title = await tp.system.prompt("Título Declarativo da Nota Atômica");
if (!title) return;

const yamlTitle = title.replace(/"/g, '\\"');

// 2. Seleção de Maturidade
const maturityDisplay = [
    "Semente (Rascunho / Ideia Inicial)",
    "Muda (Em Desenvolvimento / Conexões em Formação)",
    "Árvore (Consolidada / Conhecimento Estável)"
];
const maturityValues = ["semente", "muda", "arvore"];

const selectedMaturity = await tp.system.suggester(maturityDisplay, maturityValues);
if (!selectedMaturity) return;

// 3. Seleção de Área e Projeto no ProjectOS
const rootChildren = app.vault.getRoot().children;
const areas = rootChildren
    .filter(x => x instanceof tp.obsidian.TFolder && !x.name.startsWith(".") && !x.name.startsWith("Ω") && x.name !== "Z_Vault" && x.name !== "System")
    .map(x => x.name);

const selectedArea = await tp.system.suggester(areas, areas);
if (!selectedArea) return;

const areaFolderObj = app.vault.getAbstractFileByPath(selectedArea);
let projects = [];
if (areaFolderObj && areaFolderObj.children) {
    projects = areaFolderObj.children
        .filter(x => x instanceof tp.obsidian.TFolder)
        .map(x => x.name);
}

const selectedProject = await tp.system.suggester(projects, projects);
if (!selectedProject) return;

// 4. Mapeamento de Destino e Taxonomia
const targetFolder = `${selectedArea}/${selectedProject}/02_Docs`;
const areaTag = `area/${selectedArea.toLowerCase()}`;
const projectTag = `projeto/${selectedProject.toLowerCase().replace(/\s+/g, "-").normalize("NFD").replace(/[̀-ͯ]/g, "")}`;
const typeTag = `tipo/evergreen/${selectedMaturity}`;

// Resolução do Link do Dashboard
const projFiles = app.vault.getMarkdownFiles().filter(f => f.path.startsWith(`${selectedArea}/${selectedProject}`));
const dashFile = projFiles.find(f => f.name.includes("DASHBOARD")) || projFiles.find(f => f.name.includes(selectedProject));
const dashboardLink = dashFile ? `[[${dashFile.basename}]]` : `[[${selectedProject}]]`;

// Renomeação e Mover para 02_Docs do Projeto
const datePrefix = tp.date.now("YYYY-MM-DD");
const safeTitle = title.replace(/[/\\:]/g, "").replace(/\s+/g, "_");
const newFileName = `${datePrefix}_INS_${safeTitle}`;

await tp.file.rename(newFileName);
await tp.file.move(`${targetFolder}/${newFileName}`);
_%>
---
title: "<% yamlTitle %>"
tags: [<% typeTag %>, <% areaTag %>, <% projectTag %>, status/ativo]
created: <% tp.date.now("YYYY-MM-DD HH:mm") %>
modified: <% tp.date.now("YYYY-MM-DD HH:mm") %>
project: "<% dashboardLink %>"
---

# <% title %>


