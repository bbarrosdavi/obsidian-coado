// ═══════════════════════════════════════════════════════════════════════════════
// ACADEMIC DASHBOARD v3
// Relógio e saudação, números (disciplinas ativas, prazos da semana,
// atrasados, média geral), criação de notas por template, prazos com
// conclusão, progresso por disciplina (com atrasados), notas recentes,
// semestres ativos e navegação que alterna embeds abaixo do bloco.
//
// Mecanismos: portão de visibilidade; uma query (System/Academico) e uma
// derivação memorizada; datas em meia-noite local; o relógio re-renderiza só
// ele, uma vez por minuto.
// ═══════════════════════════════════════════════════════════════════════════════

const { useTheme } = await dc.require(dc.fileLink("System/Scripts/Core/dc-themeProvider.jsx"));
const { gate } = await dc.require(dc.fileLink("System/Scripts/Core/dc-visibleGate.jsx"));
const { GloButton, alpha } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloButton.jsx"));
const { GloBar } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloBar.jsx"));
const { GloCard } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloCard.jsx"));
const { GloBadge } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloBadge.jsx"));

const DASHBOARD_FILE = "System/Dashboards/Academic Dashboard.md";
const DAY = 86400000;

const ehTemplate = (p) => { const path = p?.$path || p?.file?.path || p?.path || ""; return path.startsWith("System/Templates/") || /Template/i.test(path.split("/").pop() || ""); };
const getValue = (p, key) => {
    if (typeof p.value === "function") { const v = p.value(key); if (v !== undefined && v !== null) return v; }
    if (p[key] !== undefined) return p[key];
    if (p.frontmatter && p.frontmatter[key] !== undefined) return p.frontmatter[key];
    return null;
};
const hasValue = (p, key, search) => {
    const val = getValue(p, key);
    if (!val) return false;
    const s = search.toLowerCase();
    return (Array.isArray(val) ? val : [val]).some(v => v && (typeof v === "object" && v.path ? v.path.toLowerCase().includes(s) : String(v).toLowerCase().includes(s)));
};
const fileOf = (p) => {
    const path = p.$path || p.file?.path || p.path || "";
    const name = p.file?.name || p.name || (path ? path.split("/").pop().replace(/\.md$/, "") : "Sem título");
    const ct = p.$ctime;
    const ctime = ct ? (typeof ct.toMillis === "function" ? ct.toMillis() : +new Date(ct)) : (p.file?.ctime || 0);
    return { path, name, ctime };
};
const toDate = (v) => {
    if (!v) return null;
    if (v instanceof Date) return isNaN(v) ? null : v;
    if (v.toJSDate) return v.toJSDate();
    const iso = String(v).slice(0, 10);
    const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T00:00:00`) : new Date(v);
    return isNaN(d) ? null : d;
};
const fmtDay = (d) => d ? `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}` : "";

function useAcademicData() {
    const pages = dc.useQuery('@page and path("System/Academico")');
    return dc.useMemo(() => {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const nextWeek = new Date(today.getTime() + 7 * DAY);
        const classes = pages.filter(p => !ehTemplate(p) && (hasValue(p, "categories", "Disciplinas") || hasValue(p, "tags", "class") || hasValue(p, "tags", "disciplina")))
            .map(c => {
                const file = fileOf(c);
                return {
                    file,
                    isActive: hasValue(c, "status", "active") || hasValue(c, "status", "open") || hasValue(c, "status", "in-progress"),
                    courseCode: getValue(c, "codigo") || file.name,
                    courseName: getValue(c, "disciplina") || "",
                    term: getValue(c, "semestre") || getValue(c, "term"),
                };
            });
        const terms = pages.filter(p => !ehTemplate(p) && (hasValue(p, "type", "semestre") || hasValue(p, "tags", "semestre") || hasValue(p, "tags", "term")))
            .map(t => {
                const startDate = toDate(getValue(t, "start")), endDate = toDate(getValue(t, "end"));
                return { file: fileOf(t), startDate, endDate, isActive: hasValue(t, "status", "active") || hasValue(t, "status", "open"), isCurrent: !!(startDate && endDate && today >= startDate && today <= endDate) };
            });
        const termClassMap = {};
        for (const term of terms) {
            const tn = term.file.name.toLowerCase(), tp = term.file.path.toLowerCase().replace(/\.md$/, "");
            termClassMap[term.file.path] = classes.filter(c => {
                if (!c.term) return false;
                const s = typeof c.term === "object" && c.term.path ? c.term.path.toLowerCase() : String(c.term).toLowerCase();
                return s.includes(tn) || s.includes(tp);
            });
        }
        const coursework = pages.filter(p => !ehTemplate(p) && hasValue(p, "categories", "Trabalhos Curso")).map(w => {
            const dueDate = toDate(getValue(w, "due_date") || getValue(w, "due"));
            const grade = getValue(w, "nota");
            const isCompleted = hasValue(w, "status", "done");
            // quando foi feita: completedDate, gravado pelo TaskNotes e pelo checkbox daqui
            const completedAt = toDate(getValue(w, "completedDate"));
            const raw = getValue(w, "class");
            const cls = raw ? (typeof raw === "object" && raw.path ? raw.path : String(raw)) : "";
            return {
                file: fileOf(w), type: getValue(w, "type") || "Assignment", dueDate, isCompleted, completedAt,
                isGraded: !!grade && String(grade).trim().length > 0, grade,
                isOverdue: !isCompleted && dueDate && dueDate < today,
                isDueSoon: !isCompleted && dueDate && dueDate >= today && dueDate <= nextWeek,
                classLinkStr: cls.toLowerCase(),
            };
        });
        const activeClasses = classes.filter(c => c.isActive);
        const overdueItems = coursework.filter(w => w.isOverdue).sort((a, b) => a.dueDate - b.dueDate);
        const upcomingItems = coursework.filter(w => w.isDueSoon).sort((a, b) => a.dueDate - b.dueDate).slice(0, 10);
        const graded = coursework.filter(w => w.isGraded);
        const recentGrades = [...graded].sort((a, b) => (b.file.ctime || 0) - (a.file.ctime || 0)).slice(0, 5);
        const nums = graded.map(w => parseFloat(String(w.grade).replace(",", "."))).filter(Number.isFinite);
        const classProgress = activeClasses.map(c => {
            const code = String(c.courseCode || "").toLowerCase(), path = (c.file.path || "").toLowerCase(), name = (c.file.name || "").toLowerCase();
            const work = coursework.filter(w => w.classLinkStr && (w.classLinkStr.includes(code) || w.classLinkStr.includes(name) || (path && w.classLinkStr.includes(path.replace(/\.md$/, "")))));
            const completed = work.filter(w => w.isCompleted).length;
            return { ...c, total: work.length, completed, overdue: work.filter(w => w.isOverdue).length, percent: work.length ? Math.round((completed / work.length) * 100) : 0 };
        });
        return {
            classes, activeClasses, coursework, overdueItems, upcomingItems, recentGrades, classProgress, terms, termClassMap,
            activeTerms: terms.filter(t => t.isActive || t.isCurrent),
            average: nums.length ? nums.reduce((s, x) => s + x, 0) / nums.length : null, gradedCount: nums.length, today,
        };
    }, [pages]);
}

// Alterna o embed logo abaixo do bloco do dashboard (mesma regra de sempre).
async function toggleEmbed(embedLink, dashboardFile = DASHBOARD_FILE) {
    if (!embedLink || embedLink.includes("![[]]")) { new Notice("Caminho de arquivo inválido."); return; }
    const file = app.vault.getAbstractFileByPath(dashboardFile);
    if (!file) { new Notice(`Dashboard não encontrado em: ${dashboardFile}`); return; }
    try {
        await app.vault.process(file, (content) => {
            const lines = content.split("\n");
            let end = -1, inside = false;
            for (let i = 0; i < lines.length; i++) if (lines[i].trim().startsWith("```")) { if (inside) { end = i; break; } inside = true; }
            if (end === -1) end = lines.length - 1;
            let at = -1;
            for (let i = end + 1; i < lines.length; i++) { const l = lines[i].trim(); if (l.startsWith("![[") && l.endsWith("]]")) { at = i; break; } }
            if (at !== -1) { if (lines[at].trim() === embedLink) lines.splice(at, 1); else lines[at] = embedLink; }
            else if (lines[end + 1] !== "") lines.splice(end + 1, 0, "", embedLink);
            else lines.splice(end + 1, 0, embedLink);
            return lines.join("\n");
        });
    } catch (e) { console.error(e); new Notice("Erro ao atualizar o embed do dashboard."); }
}

async function createNote(template, name) {
    const templater = app.plugins.plugins["templater-obsidian"];
    if (!templater) { new Notice("Plugin Templater não encontrado."); return; }
    try {
        const f = app.vault.getAbstractFileByPath(template);
        if (f) await templater.templater.create_new_note_from_template(f, app.vault.getRoot(), name.replace("{{DATE}}", window.moment().format("YYYY-MM-DD-HHmmss")), true);
    } catch (e) { console.error(e); }
}

async function markDone(path) {
    const file = app.vault.getAbstractFileByPath(path);
    if (!file) return;
    try { await app.fileManager.processFrontMatter(file, fm => { fm.status = "done"; if (!fm.completedDate) fm.completedDate = window.moment().format("YYYY-MM-DD"); }); new Notice("Tarefa marcada como concluída"); }
    catch (e) { console.error(e); new Notice("Falha ao atualizar o status"); }
}

function Clock({ theme }) {
    const [time, setTime] = dc.useState(new Date());
    dc.useEffect(() => {
        let t;
        const tick = () => { t = setTimeout(() => { setTime(new Date()); tick(); }, 60000 - (Date.now() % 60000)); };
        tick();
        return () => clearTimeout(t);
    }, []);
    return (
        <GloCard variant="glass" glow={true} style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                    <div style={{ fontSize: 11, color: theme?.["color-text-muted"] || "var(--text-muted)", textTransform: "uppercase" }}>Painel Acadêmico HQ</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: theme?.["color-text"] || "var(--text-normal)" }}>{time.getHours() < 12 ? "Bom Dia" : "Bem-vindo(a) de Volta"}</div>
                </div>
                <div style={{ fontSize: 28, fontFamily: "var(--font-monospace)", fontWeight: 700, color: theme?.["color-primary"], fontVariantNumeric: "tabular-nums" }}>
                    {`${String(time.getHours()).padStart(2, "0")}:${String(time.getMinutes()).padStart(2, "0")}`}
                </div>
            </div>
        </GloCard>
    );
}

function DeadlineItem({ item, today, theme, overdue }) {
    const days = item.dueDate ? Math.round((item.dueDate - today) / DAY) : null;
    const red = theme?.["color-red"] || "#ef4444", green = theme?.["color-success"] || "#10b981";
    const when = overdue ? (days === -1 ? "atrasado 1 dia" : `atrasado ${-days} dias`) : days === 0 ? "hoje" : days === 1 ? "amanhã" : `em ${days} dias`;
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <input type="checkbox" style={{ transform: "scale(1.2)", cursor: "pointer", flexShrink: 0 }} onChange={() => markDone(item.file.path)} />
            <GloCard variant={overdue ? "outlined" : "ghost"} size="small" borderColor={overdue ? alpha(red, 0.4) : undefined} clickable={true} onClick={() => toggleEmbed(`![[${item.file.path}]]`)}
                style={{ flex: 1, minWidth: 0, ...(overdue ? {} : { background: "var(--background-secondary, rgba(255,255,255,0.02))" }) }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <div style={{ fontWeight: 600, color: theme?.["color-text"] || "var(--text-normal)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.file.name}</div>
                    <div style={{ color: overdue ? red : green, fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>{when}</div>
                </div>
                <div style={{ fontSize: 12, color: theme?.["color-text-muted"] || "var(--text-muted)" }}>{String(item.type)} • {item.dueDate ? item.dueDate.toLocaleDateString() : ""}</div>
            </GloCard>
        </div>
    );
}

function AcademicDashboardReal() {
    const { theme } = useTheme();
    const data = useAcademicData();
    const primary = theme?.["color-primary"] || "#7c3aed";
    const muted = theme?.["color-text-muted"] || "var(--text-muted)";
    const btn = { size: "small", variant: "liquid-glass", glow: false };

    const orange = theme?.["color-orange"] || theme?.["color-warning"] || "#f59e0b", red = theme?.["color-red"] || "#ef4444", green = theme?.["color-success"] || "#10b981";
    const h3 = (top) => ({ borderBottom: `2px solid ${alpha(primary, 0.27)}`, paddingBottom: 10, marginBottom: 15, marginTop: top ? 30 : undefined });
    const Stat = ({ title, value, color }) => (
        <GloCard variant="elevated" title={<div style={{ textAlign: "center", width: "100%" }}>{title}</div>} size="small">
            <div style={{ fontSize: 32, fontWeight: 800, color, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>{value}</div>
        </GloCard>
    );

    return (
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: 10 }}>
            <Clock theme={theme} />

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 16, marginBottom: 30 }}>
                <Stat title="Disciplinas Ativas" value={data.activeClasses.length} color={primary} />
                <Stat title="Para Esta Semana" value={data.upcomingItems.length} color={orange} />
                <Stat title="Atrasados" value={data.overdueItems.length} color={red} />
                <Stat title="Média Geral" value={data.average === null ? "—" : data.average.toFixed(1)} color={green} />
            </div>

            <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
                <GloButton {...btn} label="Nova disciplina" onClick={() => createNote("System/Templates/Disciplina Template.md", "Disciplina-{{DATE}}")} />
                <GloButton {...btn} label="Novo semestre" onClick={() => createNote("System/Templates/Semestre Template.md", "Semestre-{{DATE}}")} />
                <GloButton {...btn} label="Nota de aula" onClick={() => createNote("System/Templates/Notas de Aula Template.md", "Aula-{{DATE}}")} />
                <GloButton {...btn} label="Novo trabalho" onClick={() => createNote("System/Templates/Trabalho Template.md", "Trabalho-{{DATE}}")} />
                <GloButton {...btn} label="Novo projeto" onClick={() => createNote("System/Templates/Trabalho Template.md", "Projeto-{{DATE}}")} />
                <GloButton {...btn} label="Nova nota" onClick={() => createNote("System/Templates/Nota Generica Template.md", "NotaGlobal")} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 30 }}>
                <div>
                    <h3 style={h3()}>Prazos</h3>
                    {data.overdueItems.map(it => <DeadlineItem key={it.file.path} item={it} today={data.today} theme={theme} overdue />)}
                    {data.upcomingItems.map(it => <DeadlineItem key={it.file.path} item={it} today={data.today} theme={theme} />)}
                    {!data.overdueItems.length && !data.upcomingItems.length && <GloCard variant="ghost" size="small" style={{ textAlign: "center", fontStyle: "italic", opacity: 0.7 }}>Sem prazos esta semana.</GloCard>}
                </div>

                <div>
                    <h3 style={h3()}>Progresso do Semestre</h3>
                    {data.classProgress.length ? data.classProgress.map((c, i) => (
                        <div key={i} style={{ marginBottom: 16, cursor: "pointer" }} onClick={() => toggleEmbed(`![[${c.file.path}]]`)}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4, fontSize: 13, gap: 10 }}>
                                <span style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{String(c.courseCode)}</span>
                                {c.courseName && <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12, color: muted }} title={String(c.courseName)}>{String(c.courseName)}</span>}
                                {c.overdue > 0 && <GloBadge size="small" variant="soft" status="error">{c.overdue} atrasado{c.overdue > 1 ? "s" : ""}</GloBadge>}
                                <span style={{ whiteSpace: "nowrap", color: muted, fontVariantNumeric: "tabular-nums" }}>{c.completed}/{c.total} · {c.percent}%</span>
                            </div>
                            <GloBar value={c.percent} max={100} height="8px" fillGradient={`linear-gradient(90deg, ${primary}, ${primary}88)`} showSprite={false} showValue={false} borderRadius="4px" />
                        </div>
                    )) : <div style={{ color: muted, fontSize: 13, fontStyle: "italic" }}>Nenhuma disciplina ativa.</div>}

                    <h3 style={h3(true)}>Notas Recentes</h3>
                    {data.recentGrades.length ? data.recentGrades.map(g => (
                        <GloCard key={g.file.path} variant="ghost" size="small" clickable={true} onClick={() => toggleEmbed(`![[${g.file.path}]]`)} style={{ marginBottom: 8, background: "var(--background-secondary, rgba(255,255,255,0.02))" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span>{g.file.name}</span>
                                <span style={{ fontWeight: 700, color: green }}>{String(g.grade)}</span>
                            </div>
                        </GloCard>
                    )) : <div style={{ color: muted, fontSize: 13 }}>Sem notas ainda.</div>}

                    <h3 style={h3(true)}>Semestres Ativos</h3>
                    {data.activeTerms.length ? data.activeTerms.map((term, i) => {
                        const linked = data.termClassMap[term.file.path] || [];
                        return (
                            <GloCard key={i} variant="ghost" size="small" clickable={true} onClick={() => toggleEmbed(`![[${term.file.path}]]`)} style={{ marginBottom: 12, background: "var(--background-secondary, rgba(255,255,255,0.02))" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                                    <div style={{ fontWeight: 600, fontSize: 14 }}>{term.file.name}</div>
                                    {term.isCurrent && <span style={{ background: green, color: "var(--text-on-accent)", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10 }}>ATUAL</span>}
                                </div>
                                <div style={{ fontSize: 12, color: muted, marginBottom: 8 }}>{fmtDay(term.startDate)} — {fmtDay(term.endDate)}</div>
                                {linked.length > 0 && (
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                        {linked.map((c, j) => <span key={j} className="dcg-chip" onClick={(e) => { e.stopPropagation(); toggleEmbed(`![[${c.file.path}]]`); }} style={{ background: alpha(primary, 0.13), color: primary, fontSize: 11, padding: "3px 8px", borderRadius: 8, cursor: "pointer" }}>{String(c.courseCode || c.file.name)}</span>)}
                                    </div>
                                )}
                            </GloCard>
                        );
                    }) : <div style={{ color: muted, fontSize: 13, fontStyle: "italic" }}>Nenhum semestre ativo. Clique em "Novo semestre" para criar um.</div>}
                </div>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 30, paddingTop: 20, borderTop: `1px solid ${alpha(primary, 0.2)}` }}>
                <GloButton {...btn} label="Calendário" onClick={() => toggleEmbed("![[calendar-default.base#Disciplinas]]")} />
                <GloButton {...btn} label="Todas as disciplinas" onClick={() => toggleEmbed("![[Disciplinas.base]]")} />
                <GloButton {...btn} label="Kanban" onClick={() => toggleEmbed("![[System/TaskNotes/Views/kanban-academico.base#Kanban Acadêmico]]")} />
                <span style={{ width: 1, background: alpha(primary, 0.2), margin: "0 10px" }} />
                {data.activeClasses.length ? data.activeClasses.map((c, i) => (
                    <GloButton key={i} {...btn} label={String(c.courseCode || c.file.name)} onClick={() => toggleEmbed(`![[${c.file.path}]]`)} />
                )) : <span style={{ color: muted, fontStyle: "italic", alignSelf: "center", fontSize: 13 }}>Nenhuma disciplina ativa.</span>}
            </div>
        </div>
    );
}

const AcademicDashboard = gate(AcademicDashboardReal);
// Peças reaproveitadas pelo painel integrado (dc-academicoIntegrado.jsx); o AcademicDashboard segue igual.
return { AcademicDashboard, useAcademicData, toggleEmbed, createNote, markDone, Clock };
