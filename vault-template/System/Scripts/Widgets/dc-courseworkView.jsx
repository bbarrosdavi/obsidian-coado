// ═══════════════════════════════════════════════════════════════════════════════
// COURSEWORK VIEW v3 - painel da nota de trabalho/aula/exame
// Navegação da disciplina vinculada (tarefas, exames, aulas, materiais),
// cabeçalho com tipo, status (atraso em data local) e nota, e editor dos campos
// due_date, scheduled, status, priority, nota e type.
//
// Mecanismos: portão de visibilidade; uma query (System/Academico) com a
// derivação memorizada; frontmatter reativo pelo índice (sem listener do
// metadataCache nem timer de montagem); rascunho local só durante a edição.
// ═══════════════════════════════════════════════════════════════════════════════

const { useTheme } = await dc.require(dc.fileLink("System/Scripts/Core/dc-themeProvider.jsx"));
const { gate } = await dc.require(dc.fileLink("System/Scripts/Core/dc-visibleGate.jsx"));
const { GloButton, alpha } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloButton.jsx"));
const { GloBadge } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloBadge.jsx"));

const DASHBOARD = "System/Dashboards/Painel Academico.md";
const ROTULO_TIPO = {
    tarefa: "Tarefa", trabalho: "Tarefa", assignment: "Tarefa",
    exame: "Exame", exam: "Exame", midterm: "Exame", final: "Exame",
    projeto: "Projeto", project: "Projeto",
    aula: "Nota de Aula", nota: "Nota de Aula", note: "Nota de Aula", nota_de_aula: "Nota de Aula", lecture: "Nota de Aula",
    quiz: "Quiz", leitura: "Leitura", reading: "Leitura",
    "redação": "Redação", redacao: "Redação", essay: "Redação",
    pratica: "Prática", "prática": "Prática", revisao: "Revisão", "revisão": "Revisão",
};
const T_TAREFA = ["tarefa", "trabalho", "assignment", "projeto", "project", "redação", "redacao", "essay", "quiz", "leitura", "reading", "pratica", "prática", "revisao", "revisão"];
const T_EXAME = ["exam", "exame"];
const T_AULA = ["nota", "note", "lecture", "aula", "nota_de_aula"];
const STATUS = [{ value: "open", label: "Aberto" }, { value: "in-progress", label: "Em andamento" }, { value: "done", label: "Concluído" }];
const PRIORIDADE = [{ value: "low", label: "Baixa" }, { value: "normal", label: "Normal" }, { value: "medium", label: "Média" }, { value: "high", label: "Alta" }];
const TIPOS = [
    { value: "tarefa", label: "Tarefa" }, { value: "exame", label: "Exame" }, { value: "projeto", label: "Projeto" },
    { value: "aula", label: "Nota de Aula" }, { value: "quiz", label: "Quiz" }, { value: "pratica", label: "Prática" },
    { value: "revisao", label: "Revisão" }, { value: "leitura", label: "Leitura" }, { value: "redação", label: "Redação" },
];

// Leitura como no original: objetos viram JSON, o resto String().
const pageField = (p, f) => {
    if (p?.value) { try { const v = p.value(f); if (v !== undefined && v !== null) return typeof v === "object" ? JSON.stringify(v) : String(v); } catch (e) { /* ignora */ } }
    return p?.[f] !== undefined && p?.[f] !== null ? String(p[f]) : "";
};
const pathOf = (p) => p?.$path || p?.file?.path || p?.path || "";
const nameOf = (p) => (pathOf(p).split("/").pop() || "").replace(/\.md$/, "");
const ehTemplate = (p) => { const path = pathOf(p); return path.startsWith("System/Templates/") || /Template/i.test(path.split("/").pop() || ""); };
const openFile = (path) => { if (path) app.workspace.openLinkText(path, "", false); };
const pad2 = (n) => String(n).padStart(2, "0");
const isoOf = (v) => {
    if (!v) return "";
    if (typeof v === "object") {
        if (typeof v.toISODate === "function") { try { return v.toISODate(); } catch (e) { /* ignora */ } }
        if (v instanceof Date) return `${v.getFullYear()}-${pad2(v.getMonth() + 1)}-${pad2(v.getDate())}`;
    }
    const s = String(v);
    return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : s;
};
const hojeISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };

/** Vínculo de disciplina: link do datacore (path/display) ou texto "[[...]]". */
function linkOf(raw) {
    if (!raw) return { path: "", name: "" };
    if (typeof raw === "object") return { path: raw.path || "", name: raw.display || raw.path?.split("/").pop()?.replace(/\.md$/, "") || "" };
    const s = String(raw).replace(/[\[\]]/g, "").trim();
    return { path: s, name: s };
}
// Para itens vindos do índice o original lia `class` como texto (JSON de link).
function linkOfText(text) {
    if (!text) return { path: "", name: "" };
    try { const o = JSON.parse(text); if (o && typeof o === "object") return { path: o.path || "", name: o.display || o.path?.split("/").pop()?.replace(/\.md$/, "") || "" }; } catch (e) { /* texto puro */ }
    const s = text.replace(/[\[\]]/g, "").trim();
    return { path: s, name: s };
}

// ─────────────────────────────────────────────────────────────────────────────
// DADOS
// ─────────────────────────────────────────────────────────────────────────────

function useNav(currentPath, link) {
    const pages = dc.useQuery('@page and path("System/Academico")');
    return dc.useMemo(() => {
        let cls = null;
        if (link.path || link.name) {
            const page = pages.find(p => {
                if (ehTemplate(p)) return false;
                const cats = pageField(p, "categories");
                if (!cats.includes("Disciplinas") && !cats.includes("Class")) return false;
                if (link.path && pathOf(p) === link.path) return true;
                if (link.name && nameOf(p) === link.name) return true;
                const code = pageField(p, "codigo");
                return !!(code && link.name && link.name.includes(code));
            });
            cls = page ? { path: pathOf(page), name: nameOf(page), code: pageField(page, "codigo") } : { path: link.path || null, name: link.name || null, code: null };
        }
        let items = [];
        if (cls?.path || cls?.name) {
            items = pages.filter(p => {
                if (ehTemplate(p)) return false;
                const cats = pageField(p, "categories");
                if (!["Coursework", "Trabalhos Curso", "Trabalhos_Curso", "Lecture", "Notas de Aula"].some(c => cats.includes(c))) return false;
                const it = linkOfText(pageField(p, "class"));
                if (cls.path && it.path && (it.path === cls.path || it.path.includes(cls.path) || cls.path.includes(it.path))) return true;
                if (cls.name && it.name && (it.name === cls.name || it.name.includes(cls.name) || cls.name.includes(it.name))) return true;
                return !!(cls.code && it.name && it.name.includes(cls.code));
            }).map(p => ({ path: pathOf(p), name: nameOf(p), type: pageField(p, "type").toLowerCase(), isCurrent: pathOf(p) === currentPath }));
        }
        // Materiais: pasta Materiais/ da disciplina + fontes[] da nota da disciplina.
        let dir = "";
        if (cls?.path) dir = cls.path.split("/").slice(0, -1).join("/");
        else { const m = currentPath.match(/^(System\/Academico\/Disciplinas\/[^\/]+)/); if (m) dir = m[1]; }
        const seen = new Set(), materials = [];
        const walk = (f) => { for (const c of f?.children || []) { if (c.children) walk(c); else if (!seen.has(c.path)) { seen.add(c.path); materials.push({ path: c.path, name: c.name, ext: (c.extension || "").toUpperCase() }); } } };
        if (dir) walk(app.vault.getAbstractFileByPath(`${dir}/Materiais`));
        const cf = cls?.path && app.vault.getAbstractFileByPath(cls.path);
        const fontes = cf && app.metadataCache.getFileCache(cf)?.frontmatter?.["fontes"];
        if (Array.isArray(fontes)) for (const it of fontes) {
            if (typeof it !== "string") continue;
            const dest = app.metadataCache.getFirstLinkpathDest(it.replace(/^\[\[/, "").replace(/\]\]$/, "").trim(), cls.path);
            if (dest && !seen.has(dest.path)) { seen.add(dest.path); materials.push({ path: dest.path, name: dest.name, ext: (dest.extension || "").toUpperCase() }); }
        }
        materials.sort((a, b) => a.name.localeCompare(b.name));
        return {
            cls, materials,
            assignments: items.filter(i => T_TAREFA.includes(i.type)),
            exams: items.filter(i => T_EXAME.includes(i.type)),
            lectures: items.filter(i => T_AULA.includes(i.type)),
        };
    }, [pages, currentPath, link.path, link.name]);
}

// ─────────────────────────────────────────────────────────────────────────────
// PEÇAS
// ─────────────────────────────────────────────────────────────────────────────

function QuickNav({ nav, theme }) {
    const [open, setOpen] = dc.useState(null);
    const muted = theme?.["color-text-muted"] || "var(--text-muted)";
    const primary = theme?.["color-primary"] || "#7c3aed";
    const sections = [
        { id: "assignments", label: `Tarefas (${nav.assignments.length})`, items: nav.assignments },
        { id: "exams", label: `Exames (${nav.exams.length})`, items: nav.exams },
        { id: "lectures", label: `Aulas (${nav.lectures.length})`, items: nav.lectures },
        { id: "materials", label: `Materiais (${nav.materials.length})`, items: nav.materials },
    ];
    const cur = sections.find(s => s.id === open);
    return (
        <div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", padding: "8px 12px", background: alpha(primary, 0.08), borderRadius: 10, border: `1px solid ${alpha(primary, 0.13)}` }}>
                <GloButton size="small" variant="liquid-glass" glow={false} lift={false} label="Dashboard" onClick={() => openFile(DASHBOARD)} />
                <GloButton size="small" variant="liquid-glass" glow={false} lift={false} active label={nav.cls?.code || nav.cls?.name || "Disciplina"}
                    onClick={() => nav.cls?.path ? openFile(nav.cls.path) : new Notice("Nenhuma disciplina vinculada")} />
                {sections.map(s => (
                    <GloButton key={s.id} size="small" variant="liquid-glass" glow={false} lift={false} active={open === s.id} label={s.label} onClick={() => setOpen(open === s.id ? null : s.id)} />
                ))}
            </div>
            {cur && (
                <div style={{ marginTop: 8, maxHeight: 220, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
                    {cur.items.length ? cur.items.map((it, i) => (
                        <div key={it.path || i} onClick={() => openFile(it.path)} style={{
                            display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 6, cursor: "pointer", fontSize: 13,
                            background: it.isCurrent ? alpha(primary, 0.18) : "var(--background-modifier-hover, rgba(0,0,0,0.05))",
                        }}>
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</span>
                            <span style={{ fontSize: 11, color: it.isCurrent ? primary : muted, flexShrink: 0 }}>{it.isCurrent ? "esta nota" : it.ext || ""}</span>
                        </div>
                    )) : <div style={{ textAlign: "center", color: muted, fontSize: 12, padding: 12 }}>Nenhum item encontrado</div>}
                </div>
            )}
        </div>
    );
}

function EditField({ label, value, fieldKey, targetPath, type = "text", options = [], theme }) {
    let shown = value;
    if (shown === undefined || shown === null) shown = "";
    if (Array.isArray(shown)) shown = shown[0] || "";
    if (type === "date") shown = isoOf(shown);
    else if (typeof shown === "string" && shown.startsWith("[[") && shown.endsWith("]]")) shown = shown.slice(2, -2);
    shown = String(shown);
    const [draft, setDraft] = dc.useState(null);
    const save = async (val) => {
        const file = app.vault.getAbstractFileByPath(targetPath);
        if (!file) { new Notice("Arquivo não encontrado"); return; }
        try { await app.fileManager.processFrontMatter(file, fm => { fm[fieldKey] = val; }); } catch (e) { console.error(e); }
    };
    const box = {
        background: "var(--background-modifier-form-field, rgba(0,0,0,0.2))", border: `1px solid ${alpha(theme?.["color-primary"] || "#7c3aed", 0.25)}`,
        borderRadius: 6, color: theme?.["color-text"] || "var(--text-normal)", padding: "4px 8px", width: "100%", fontSize: 13, outline: "none", height: 30,
    };
    return (
        <label style={{ display: "flex", flexDirection: "column", gap: 3, flex: 1, minWidth: 120 }}>
            <span style={{ fontSize: 10.5, color: theme?.["color-text-muted"], textTransform: "uppercase", fontWeight: 600, letterSpacing: ".04em" }}>{label}</span>
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

function statusLook(status, due, theme) {
    const map = { open: "Aberto", "in-progress": "Em andamento", done: "Concluído" };
    let label = map[status] || status || "—";
    let tone = "primary";
    if (status === "done") tone = "success";
    else if (status === "submitted") tone = "info";
    else if (status === "in-progress") tone = "warning";
    const vence = isoOf(due);
    let days = null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(vence)) {
        days = Math.round((new Date(`${vence}T00:00:00`) - new Date(`${hojeISO()}T00:00:00`)) / 86400000);
        if (status !== "done" && status !== "submitted" && days < 0) { tone = "error"; label = "Atrasado"; }
    }
    return { label, tone, days };
}

// ─────────────────────────────────────────────────────────────────────────────
// PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

function CourseworkViewReal() {
    const { theme } = useTheme();
    const current = dc.useCurrentFile();
    const currentPath = dc.useCurrentPath();
    const v = (k) => current?.value?.(k);
    const fm = {
        class: v("class"), type: v("type"), status: v("status"), priority: v("priority"),
        due: v("due_date") || v("due"), scheduled: v("scheduled"), nota: v("nota"),
    };
    const link = linkOf(fm.class);
    const nav = useNav(currentPath, link);
    const tipo = ROTULO_TIPO[String(fm.type || "").toLowerCase()] || fm.type || "Trabalhos de Curso";
    const st = statusLook(fm.status, fm.due, theme);
    const prazo = st.days === null ? null : st.days === 0 ? "vence hoje" : st.days > 0 ? `vence em ${st.days} ${st.days === 1 ? "dia" : "dias"}` : `venceu há ${-st.days} ${st.days === -1 ? "dia" : "dias"}`;
    const success = theme?.["color-success"] || "#10b981";
    const primary = theme?.["color-primary"] || "#7c3aed";

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "4px 0" }}>
            <QuickNav nav={nav} theme={theme} />
            {/* Faixa rosa com o tipo e os campos embaixo, como antes da migração do LifeOS (o cartão de vidro deixava esbranquiçado). */}
            <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "10px 16px",
                    background: alpha(primary, 0.1), borderRadius: "12px 12px 0 0", border: `1px solid ${alpha(primary, 0.27)}`, borderBottom: "none" }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", minWidth: 0 }}>
                        <span style={{ fontWeight: 700, color: primary, textTransform: "uppercase", fontSize: 12, letterSpacing: ".04em" }}>{tipo}</span>
                        <span style={{ fontSize: 12, color: theme?.["color-text-muted"] || "var(--text-muted)" }}>{[nav.cls?.code || nav.cls?.name, prazo].filter(Boolean).join(" · ")}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <GloBadge variant="soft" status={st.tone}>{st.label}</GloBadge>
                        {/* `nota`, não `grade`: é o que o editor grava e o que dc-subjectData lê. */}
                        {fm.nota && <span style={{ padding: "4px 12px", borderRadius: 8, fontWeight: 700, fontSize: 16, color: success, background: alpha(success, 0.15), fontVariantNumeric: "tabular-nums" }}>{String(fm.nota)}</span>}
                    </div>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12, padding: 16, background: "var(--background-modifier-hover, rgba(0,0,0,0.05))",
                    borderRadius: "0 0 12px 12px", border: `1px solid ${alpha(primary, 0.27)}` }}>
                    <EditField label="Data de entrega" value={fm.due} fieldKey="due_date" targetPath={currentPath} type="date" theme={theme} />
                    <EditField label="Agendado" value={fm.scheduled} fieldKey="scheduled" targetPath={currentPath} type="date" theme={theme} />
                    <EditField label="Status" value={fm.status} fieldKey="status" targetPath={currentPath} type="select" options={STATUS} theme={theme} />
                    <EditField label="Prioridade" value={fm.priority} fieldKey="priority" targetPath={currentPath} type="select" options={PRIORIDADE} theme={theme} />
                    <EditField label="Nota" value={fm.nota} fieldKey="nota" targetPath={currentPath} theme={theme} />
                    <EditField label="Tipo" value={fm.type} fieldKey="type" targetPath={currentPath} type="select" options={TIPOS} theme={theme} />
                </div>
            </div>
        </div>
    );
}

const CourseworkView = gate(CourseworkViewReal);
return { CourseworkView, Func: CourseworkView };
