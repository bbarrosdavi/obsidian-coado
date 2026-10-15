// System/Scripts/Widgets/dc-classView.jsx
// ═══════════════════════════════════════════════════════════════════════════════
// CLASS VIEW v3 - painel da nota de disciplina
// Navegação rápida, editor do frontmatter da disciplina, números (avaliados,
// pendentes, atrasados, média, próximo prazo), criação de notas por template,
// próximos prazos com conclusão e avaliados. Clicar num item alterna o embed
// dele logo abaixo do bloco.
//
// Mecanismos: portão de visibilidade; uma query (System/Academico) e uma
// derivação memorizada, reativa pelo índice (sem listener do metadataCache nem
// timer de montagem); datas em meia-noite local.
// ═══════════════════════════════════════════════════════════════════════════════

const { useTheme } = await dc.require(dc.fileLink("System/Scripts/Core/dc-themeProvider.jsx"));
const { gate } = await dc.require(dc.fileLink("System/Scripts/Core/dc-visibleGate.jsx"));
const { GloButton, alpha } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloButton.jsx"));
const { GloBadge } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloBadge.jsx"));

const DASHBOARD = "System/Dashboards/Painel Academico.md";
const KANBAN = "System/TaskNotes/Views/kanban-default.base#Kanban da Disciplina";
// Vocabulário tolerante (pt-BR do <select>, en-US do Bases legado, "trabalho" do template antigo).
const T_TAREFA = ["tarefa", "trabalho", "assignment", "projeto", "project", "redação", "redacao", "essay", "quiz", "leitura", "reading", "pratica", "prática", "revisao", "revisão"];
const T_EXAME = ["exam", "exame"];
const T_AULA = ["nota", "note", "lecture", "aula", "nota_de_aula"];
const CONCLUIDO = ["graded", "completed", "submitted", "done"];

// Mesma leitura do original: valor cru do datacore (links, datas e listas
// intactos); a conversão para texto é String(), que nos links dá "[[...]]".
const field = (p, f) => {
    if (p?.value) { try { const v = p.value(f); if (v !== undefined && v !== null) return v; } catch (e) { /* ignora */ } }
    return p?.[f] ?? p?.frontmatter?.[f] ?? "";
};
const str = (v) => {
    if (v === null || v === undefined) return "";
    if (Array.isArray(v)) return v.map(x => str(x)).join(",");
    if (typeof v === "object" && v.toString === Object.prototype.toString) return JSON.stringify(v);
    return String(v);
};
const pathOf = (p) => p?.$path || p?.file?.path || p?.path || "";
const nameOf = (p) => (p?.$name || pathOf(p).split("/").pop() || "Sem título").replace(/\.md$/, "");
const ehTemplate = (p) => { const path = pathOf(p); return path.startsWith("System/Templates/") || /Template/i.test(path.split("/").pop() || ""); };
const toDate = (v) => {
    if (!v) return null;
    if (v instanceof Date) return isNaN(v) ? null : v;
    if (typeof v === "object" && typeof v.toJSDate === "function") return v.toJSDate();
    const iso = String(v).slice(0, 10);
    const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T00:00:00`) : new Date(v);
    return isNaN(d) ? null : d;
};
const dueText = (v) => { const d = toDate(v); return d ? `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}` : ""; };
const openFile = (path) => { if (path) app.workspace.openLinkText(path, "", false); };

// ─────────────────────────────────────────────────────────────────────────────
// DADOS
// ─────────────────────────────────────────────────────────────────────────────

function useClassData() {
    const pages = dc.useQuery('@page and path("System/Academico")');
    const current = dc.useCurrentFile();
    const currentPath = dc.useCurrentPath();
    const fm = {
        codigo: current?.value?.("codigo"), disciplina: current?.value?.("disciplina"), professor: current?.value?.("professor"),
        semestre: current?.value?.("semestre"), creditos: current?.value?.("creditos"), status: current?.value?.("status"),
        nota: current?.value?.("nota"), fontes: current?.value?.("fontes"),
    };
    const courseCode = str(fm.codigo);
    const fileName = currentPath.split("/").pop()?.replace(/\.md$/, "") || "";

    return dc.useMemo(() => {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const liga = (cls) => { const s = str(cls); return (courseCode && s.includes(courseCode)) || (fileName && s.includes(fileName)) || (currentPath && s.includes(currentPath)); };
        const classes = [], coursework = [];
        for (const p of pages) {
            if (ehTemplate(p)) continue;
            const cats = str(field(p, "categories"));
            if (cats.includes("Class") || cats.includes("Disciplinas")) {
                classes.push({ path: pathOf(p), name: nameOf(p), code: str(field(p, "codigo")) || nameOf(p), isCurrent: pathOf(p) === currentPath });
            }
            if (!(cats.includes("Coursework") || cats.includes("Trabalhos Curso") || cats.includes("Trabalhos_Curso"))) continue;
            if (!liga(field(p, "class"))) continue;
            // due_date antes de due: o TaskNotes renomeia a chave e apaga o due.
            const due = field(p, "due_date") || field(p, "due");
            const status = p.value ? p.value("status") : p.status;
            coursework.push({
                filePath: pathOf(p), fileName: nameOf(p),
                due, dueDate: toDate(due), status,
                isCompleted: CONCLUIDO.some(s => status && String(status).toLowerCase().includes(s)),
                grade: field(p, "nota") || field(p, "grade"),
                type: str(field(p, "type")).toLowerCase(),
            });
        }
        const upcoming = coursework.filter(w => !w.isCompleted && w.dueDate).sort((a, b) => a.dueDate - b.dueDate);
        const graded = coursework.filter(w => w.grade).sort((a, b) => (b.dueDate || 0) - (a.dueDate || 0));
        const overdue = upcoming.filter(w => w.dueDate < today).length;
        const nums = graded.map(w => parseFloat(String(w.grade).replace(",", "."))).filter(Number.isFinite);
        const next = upcoming.find(w => w.dueDate >= today) || null;

        // Materiais: pasta Materiais/ ao lado da nota + fontes[] do frontmatter.
        const dir = currentPath.split("/").slice(0, -1).join("/");
        const seen = new Set(), materials = [];
        const walk = (f) => { for (const c of f?.children || []) { if (c.children) walk(c); else if (!seen.has(c.path)) { seen.add(c.path); materials.push({ path: c.path, name: c.name, ext: (c.extension || "").toUpperCase() }); } } };
        walk(app.vault.getAbstractFileByPath(`${dir}/Materiais`));
        if (Array.isArray(fm.fontes)) for (const it of fm.fontes) {
            if (typeof it !== "string") continue;
            const dest = app.metadataCache.getFirstLinkpathDest(it.replace(/^\[\[/, "").replace(/\]\]$/, "").trim(), currentPath);
            if (dest && !seen.has(dest.path)) { seen.add(dest.path); materials.push({ path: dest.path, name: dest.name, ext: (dest.extension || "").toUpperCase() }); }
        }
        materials.sort((a, b) => a.name.localeCompare(b.name));

        return {
            classes, coursework, upcoming, graded, overdue, materials,
            average: nums.length ? nums.reduce((s, x) => s + x, 0) / nums.length : null,
            next, today,
            assignments: coursework.filter(w => T_TAREFA.includes(w.type)),
            exams: coursework.filter(w => T_EXAME.includes(w.type)),
            lectures: coursework.filter(w => T_AULA.includes(w.type)),
        };
    }, [pages, courseCode, fileName, currentPath, JSON.stringify(fm.fontes ?? null)]);
}

// ─────────────────────────────────────────────────────────────────────────────
// EMBED ABAIXO DO BLOCO
// Alterna `![[alvo]]` na linha logo abaixo do primeiro bloco de código da nota
// (linhas em branco no meio contam): igual remove, diferente troca, nenhum insere.
// Só essa linha: um embed de conteúdo mais adiante na nota nunca é tocado.
// ─────────────────────────────────────────────────────────────────────────────

async function toggleEmbed(notePath, target) {
    if (!target) return;
    const file = app.vault.getAbstractFileByPath(notePath);
    if (!file) return;
    const link = `![[${target}]]`;
    await app.vault.process(file, (content) => {
        const lines = content.split("\n");
        let end = -1, inside = false;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].trim().startsWith("```")) { if (inside) { end = i; break; } inside = true; }
        }
        if (end === -1) end = lines.length - 1;
        let at = -1, k = end + 1;
        while (k < lines.length && lines[k].trim() === "") k++;
        if (k < lines.length) { const l = lines[k].trim(); if (l.startsWith("![[") && l.endsWith("]]")) at = k; }
        if (at !== -1) { if (lines[at].trim() === link) lines.splice(at, 1); else lines[at] = link; }
        else if (lines[end + 1] !== "") lines.splice(end + 1, 0, "", link);
        else lines.splice(end + 1, 0, link);
        return lines.join("\n");
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// PEÇAS
// ─────────────────────────────────────────────────────────────────────────────

// Linha clicável como no original (fundo leve); destaque só por fundo, nunca borda lateral.
function Row({ onClick, left, right, active, primary, children }) {
    return (
        <div onClick={onClick} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8,
            padding: "8px 12px", borderRadius: 6, cursor: "pointer", fontSize: 13,
            background: active ? alpha(primary, 0.2) : "var(--background-modifier-hover, rgba(0,0,0,0.05))",
        }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>{left}</div>
            {right && <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, marginLeft: 8 }}>{right}</div>}
            {children}
        </div>
    );
}

// Abas e gaveta do original (faixa tingida; gaveta tracejada), sem emojis.
function QuickNav({ data, theme, muted }) {
    const [open, setOpen] = dc.useState(null);
    const primary = theme?.["color-primary"] || "#7c3aed";
    const sections = [
        { id: "dashboard", label: "Dashboard", action: () => openFile(DASHBOARD) },
        { id: "classes", label: `Disciplinas (${data.classes.length})`, items: data.classes },
        { id: "assignments", label: `Tarefas (${data.assignments.length})`, items: data.assignments },
        { id: "exams", label: `Exames (${data.exams.length})`, items: data.exams },
        { id: "lectures", label: `Aulas (${data.lectures.length})`, items: data.lectures },
        { id: "materials", label: `Materiais (${data.materials.length})`, items: data.materials },
    ];
    const cur = sections.find(s => s.id === open);
    return (
        <div style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", padding: "8px 12px", background: alpha(primary, 0.08), borderRadius: 10, border: `1px solid ${alpha(primary, 0.13)}` }}>
                {sections.map(s => (
                    <GloButton key={s.id} size="small" variant="liquid-glass" glow={false} lift={false} active={open === s.id} label={s.label}
                        style={{ border: `1px solid ${alpha(primary, open === s.id ? 0.4 : 0.22)}` }}
                        onClick={() => s.action ? s.action() : setOpen(open === s.id ? null : s.id)} />
                ))}
            </div>
            {cur && cur.items && (
                <div style={{ marginTop: 8, padding: 12, background: alpha(primary, 0.05), borderRadius: 10, border: `1px dashed ${alpha(primary, 0.2)}`, maxHeight: 200, overflowY: "auto" }}>
                    {cur.items.length ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            {cur.items.map((it, i) => (
                                <Row key={it.path || it.filePath || i} onClick={() => openFile(it.path || it.filePath)} active={it.isCurrent} primary={primary}
                                    left={<span style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name || it.fileName || "Sem título"}</span>}
                                    right={<>
                                        {it.ext && <span style={{ fontSize: 10, color: muted, background: alpha(primary, 0.1), padding: "2px 6px", borderRadius: 4, fontWeight: 600 }}>{it.ext}</span>}
                                        {it.code && <span style={{ fontSize: 11, color: muted }}>{it.code}</span>}
                                        {it.due && <span style={{ fontSize: 11, color: muted }}>{dueText(it.due)}</span>}
                                    </>} />
                            ))}
                        </div>
                    ) : <div style={{ textAlign: "center", color: muted, fontSize: 12, padding: 20 }}>Nenhum item encontrado</div>}
                </div>
            )}
        </div>
    );
}

function EditField({ label, value, fieldKey, targetPath, type = "text", options = [], theme }) {
    const shown = value === undefined || value === null ? "" : Array.isArray(value) ? String(value[0] ?? "") : typeof value === "string" && value.startsWith("[[") && value.endsWith("]]") ? value.slice(2, -2) : String(value);
    const [draft, setDraft] = dc.useState(null);   // rascunho só enquanto edita
    const save = async (val) => {
        const file = app.vault.getAbstractFileByPath(targetPath);
        if (!file) { new Notice("Arquivo não encontrado para salvar"); return; }
        try { await app.fileManager.processFrontMatter(file, fm => { fm[fieldKey] = val; }); } catch (e) { console.error(e); }
    };
    const box = {
        background: "rgba(0,0,0,0.2)", border: `1px solid ${alpha(theme?.["color-primary"] || "#7c3aed", 0.2)}`,
        borderRadius: 4, color: theme?.["color-text"] || "var(--text-normal)", padding: "4px 8px", width: "100%", fontSize: 13, outline: "none",
    };
    return (
        <label style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 120 }}>
            <span style={{ fontSize: 11, color: theme?.["color-text-muted"], textTransform: "uppercase", fontWeight: 600 }}>{label}</span>
            {type === "select" ? (
                <select value={shown} onChange={e => save(e.target.value)} style={{ ...box, cursor: "pointer" }}>
                    <option value="">—</option>
                    {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
            ) : (
                <input type={type} value={draft ?? shown} placeholder="—" style={box}
                    onFocus={() => setDraft(shown)}
                    onInput={e => setDraft(e.target.value)}
                    onBlur={() => { if (draft !== null && draft !== shown) save(draft); setDraft(null); }}
                    onKeyDown={e => { if (e.key === "Enter") e.target.blur(); }} />
            )}
        </label>
    );
}

function DeadlineRow({ item, today, theme, onEmbed }) {
    const days = item.dueDate ? Math.ceil((item.dueDate - today) / 86400000) : 999;
    const [color, text] = days < 0 ? [theme?.["color-red"] || "#ef4444", days === -1 ? "atrasado 1 dia" : `atrasado ${-days} dias`]
        : days === 0 ? [theme?.["color-orange"] || "#f59e0b", "hoje"]
        : days <= 3 ? [theme?.["color-orange"] || "#f59e0b", days === 1 ? "amanhã" : `em ${days} dias`]
        : [theme?.["color-success"] || "#10b981", `em ${days} dias`];
    const done = async (e) => {
        e.stopPropagation();
        const file = app.vault.getAbstractFileByPath(item.filePath);
        if (!file) return;
        try { await app.fileManager.processFrontMatter(file, fm => { fm.status = "done"; }); new Notice("Tarefa concluída"); } catch (err) { console.error(err); }
    };
    return (
        <Row onClick={() => onEmbed(item.filePath)}
            left={<span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <input type="checkbox" onClick={done} style={{ cursor: "pointer", flexShrink: 0, transform: "scale(1.1)" }} />
                {T_EXAME.includes(item.type) && <GloBadge size="small" variant="soft" status="warning">exame</GloBadge>}
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.fileName}</span>
            </span>}
            right={<span style={{ display: "flex", gap: 6, fontSize: 11 }}><span style={{ opacity: 0.6 }}>{dueText(item.dueDate)}</span><span style={{ color, fontWeight: 600 }}>{text}</span></span>} />
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

function ClassViewReal() {
    const { theme } = useTheme();
    const data = useClassData();
    const currentPath = dc.useCurrentPath();
    const current = dc.useCurrentFile();
    const courseCode = str(current?.value?.("codigo"));
    const muted = theme?.["color-text-muted"] || "var(--text-muted)";
    const embed = (target) => toggleEmbed(currentPath, target);
    // Valor cru do frontmatter: o Datacore converte "2026-02" em data, e o campo
    // mostrava e regravava "2026-02-01T00:00:00.000-03:00".
    const selfFile = currentPath ? app.vault.getFileByPath(currentPath) : null;
    const rawFm = (selfFile && app.metadataCache.getFileCache(selfFile)?.frontmatter) || {};
    const fm = (k) => rawFm[k];

    const createNote = async (template, suffix) => {
        const templater = app.plugins.plugins["templater-obsidian"];
        if (!templater) { new Notice("Templater não encontrado"); return; }
        const tpl = app.vault.getAbstractFileByPath(`System/Templates/${template}`);
        if (!tpl) { new Notice("Template ausente"); return; }
        // Pasta da disciplina com este código (a nota atual, quando é ela)
        const self = app.vault.getAbstractFileByPath(currentPath);
        const own = self && app.metadataCache.getFileCache(self)?.frontmatter?.["codigo"] === courseCode ? self : null;
        const classFile = own || (courseCode && app.vault.getMarkdownFiles().find(f => app.metadataCache.getFileCache(f)?.frontmatter?.["codigo"] === courseCode));
        const folder = classFile?.parent || app.vault.getRoot();
        try { await templater.templater.create_new_note_from_template(tpl, folder, `${courseCode} ${suffix} ${window.moment().format("MM-DD")}`, true); }
        catch (e) { console.error(e); }
    };

    const primary = theme?.["color-primary"] || "#7c3aed";
    const lbl = { fontSize: 11, textTransform: "uppercase", color: muted, fontWeight: 700 };
    const big = { fontSize: 24, fontWeight: 800, fontVariantNumeric: "tabular-nums" };
    const sep = { borderLeft: `1px solid ${alpha(primary, 0.2)}`, paddingLeft: 16 };   // divisória entre números, como no original
    const h4 = { borderBottom: `1px solid ${alpha(primary, 0.27)}`, paddingBottom: 8, marginBottom: 12 };
    const btn = { size: "small", variant: "liquid-glass", glow: false };
    return (
        <div style={{ padding: 10 }}>
            <QuickNav data={data} theme={theme} muted={muted} />

            {/* Campos e números lado a lado: a página da disciplina cabe numa tela. */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))", gap: 12, marginBottom: 12, alignItems: "stretch" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 10, padding: 12, background: "var(--background-modifier-hover, rgba(0,0,0,0.05))", borderRadius: 12, border: `1px dashed ${alpha(primary, 0.27)}` }}>
                <EditField label="Código" value={fm("codigo")} fieldKey="codigo" targetPath={currentPath} theme={theme} />
                <EditField label="Professor" value={fm("professor")} fieldKey="professor" targetPath={currentPath} theme={theme} />
                <EditField label="Semestre" value={fm("semestre")} fieldKey="semestre" targetPath={currentPath} theme={theme} />
                <EditField label="Créditos" value={fm("creditos")} fieldKey="creditos" type="number" targetPath={currentPath} theme={theme} />
                <EditField label="Status" value={fm("status")} fieldKey="status" type="select" targetPath={currentPath} theme={theme}
                    options={[{ value: "open", label: "Aberto" }, { value: "in-progress", label: "Em Andamento" }, { value: "done", label: "Concluído" }]} />
                <EditField label="Nota Final" value={fm("nota")} fieldKey="nota" targetPath={currentPath} theme={theme} />
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", alignContent: "center", gap: 16, padding: 12, background: alpha(primary, 0.1), borderRadius: 12, border: `1px solid ${alpha(primary, 0.2)}` }}>
                <div><div style={lbl}>Avaliados</div><div style={big}>{data.graded.length}</div></div>
                <div style={sep}><div style={lbl}>Pendentes</div><div style={big}>{data.upcoming.length}</div></div>
                <div style={sep}><div style={lbl}>Atrasados</div><div style={{ ...big, color: data.overdue ? (theme?.["color-red"] || "#ef4444") : undefined }}>{data.overdue}</div></div>
                <div style={sep}><div style={lbl}>Média</div><div style={big}>{data.average === null ? "—" : data.average.toFixed(1)}</div></div>
                <div style={{ ...sep, minWidth: 0 }}>
                    <div style={lbl}>Próximo prazo</div>
                    <div style={big}>{data.next ? dueText(data.next.dueDate) : "—"}</div>
                    {data.next && <div style={{ fontSize: 11, color: muted, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{data.next.fileName}</div>}
                </div>
            </div>
            </div>

            <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                <GloButton {...btn} label="Novo trabalho" onClick={() => createNote("Trabalho Template.md", "Trabalho")} />
                <GloButton {...btn} label="Exame" onClick={() => createNote("Trabalho Template.md", "Exame")} />
                <GloButton {...btn} label="Projeto" onClick={() => createNote("Trabalho Template.md", "Projeto")} />
                <GloButton {...btn} label="Nota de aula" onClick={() => createNote("Notas de Aula Template.md", "Aula")} />
                <GloButton {...btn} label="Nova nota" onClick={() => createNote("Nota Generica Template.md", "Nota")} />
                {/* Kanban filtrado pela pasta da disciplina, não o board global. */}
                <GloButton {...btn} label="Abrir kanban" onClick={() => embed(KANBAN)} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
                <div>
                    <h4 style={h4}>Próximos</h4>
                    {data.upcoming.length
                        ? <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{data.upcoming.map(it => <DeadlineRow key={it.filePath} item={it} today={data.today} theme={theme} onEmbed={embed} />)}</div>
                        : <div style={{ fontStyle: "italic", color: muted, fontSize: 13 }}>Nenhuma tarefa pendente.</div>}
                </div>
                <div>
                    <h4 style={h4}>Avaliados</h4>
                    {data.graded.length
                        ? <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{data.graded.map(it => (
                            <Row key={it.filePath} onClick={() => embed(it.filePath)} primary={primary}
                                left={<span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.fileName}</span>}
                                right={<span style={{ fontWeight: 700, fontSize: 13, color: theme?.["color-success"] }}>{str(it.grade)}</span>} />
                        ))}</div>
                        : <div style={{ fontStyle: "italic", color: muted, fontSize: 13 }}>Sem notas ainda.</div>}
                </div>
            </div>
        </div>
    );
}

const ClassView = gate(ClassViewReal);
return { ClassView, Func: ClassView };
