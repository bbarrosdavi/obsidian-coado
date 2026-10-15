// ═══════════════════════════════════════════════════════════════════════════════
// DAILY WRAPPER v6 - Home do LifeOS (V5 e, com variant="v4", a Home V4)
//
// Barra sticky (escopo + data + calendário), aviso de nota ausente com criação
// pelo Templater, faixa de dia passado, números do dia, painel de três colunas
// (abas configuradas no Settings | tendências | atividades), plano de hoje e
// de amanhã (+ semanal ao lado, persistido), diário do período e navegação
// por embeds e comandos.
//
// Mecanismos (medidos em 2026-10-12):
//   - Portão de visibilidade: a cópia do bloco no editor oculto não monta.
//   - Módulos importados no carregamento, não por WidgetLoader (que mostrava
//     "Loading widget..." e custava um render extra por módulo). Nomes vindos
//     do Settings que não estão no mapa continuam carregando sob demanda.
//   - Módulos reativos à nota do dia (useDayFrontmatter): sem lastUpdate.
//   - Varredura de dashboards/categorias/planejadores depois do primeiro
//     desenho, cacheada na janela por 5 minutos.
//
// Variante V4 (prop variant="v4", usada por dc-dailyWrapperV4.jsx): layout da
// Home V4 original. Módulos instalados em abas de largura total (sem o painel
// de três colunas), primeira aba = primeiro módulo; Manhã só com o check-in,
// Refeições com cardápio e água, Noite com a reflexão; sem barra fixa no topo;
// diário semanal novo sem o bloco de cartões dos journals diários.
// ═══════════════════════════════════════════════════════════════════════════════

const { useTheme } = await dc.require(dc.fileLink("System/Scripts/Core/dc-themeProvider.jsx"));
const { gate } = await dc.require(dc.fileLink("System/Scripts/Core/dc-visibleGate.jsx"));
const D = await dc.require(dc.fileLink("System/Scripts/Core/dc-dateContext.jsx"));
const { GloButton, alpha } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloButton.jsx"));
const { CalendarPopup } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-calendarPicker.jsx"));
const W = (name) => dc.require(dc.fileLink(`System/Scripts/Widgets/${name}.jsx`));
// Sequencial: o ScriptCache do Datacore trata dois carregamentos simultâneos da
// mesma dependência como dependência circular (Promise.all quebrava a Home).
const mods = [];
for (const n of ["dc-sleepTracker", "dc-eveningReflection", "dc-activityLogger", "dc-activityTracker", "dc-todayMenu", "dc-waterTracker", "dc-workoutToday", "dc-weeklyJournalCards", "dc-studySessions"]) mods.push(await W(n));
const [mSleep, mEvening, mLogger, mTracker, mMenu, mWater, mWorkout, mWeekly, mStudy] = mods;
const { sleepHours } = mSleep;

// Nome de widget (Settings ou legado) -> componente já carregado.
const KNOWN = {
    "dc-sleepTracker": mSleep.Func, "dc-sleepTrackerV5": mSleep.Func,
    "dc-eveningReflection": mEvening.Func, "dc-eveningReflectionV5": mEvening.Func,
    "dc-activityLogger": mLogger.Func, "dc-activityLoggerV5": mLogger.Func,
    "dc-activityTracker": mTracker.Func, "dc-activityTrackerV5": mTracker.Func,
    "dc-todayMenu": mMenu.Func, "dc-waterTracker": mWater.Func, "dc-workoutToday": mWorkout.Func,
    "dc-weeklyJournalCards": mWeekly.Func,
    "dc-studySessions": mStudy.Func,
};

const SETTINGS_PATH = "System/Settings.md";
const TASK_QUERY = "@page and #tipo/task";
const WEEKLY_CARDS = "dc-weeklyJournalCards";
const WEEKLY_CARDS_BLOCK = ["```datacorejsx", `const { WeeklyJournalCards } = await dc.require(dc.fileLink("System/Scripts/Widgets/${WEEKLY_CARDS}.jsx"));`, "return <WeeklyJournalCards />;", "```"].join("\n");
const SHOW_WEEKLY_KEY = "show-weekly-plan";
const PRIO_COLOR = { high: "#ef4444", normal: "#f59e0b", low: "#10b981" };

const SCOPES = {
    day: { planFolder: "System/Planos", journalFolder: "System/Periodicos/Journals/Diarios", periodicFolder: "System/Periodicos", template: "System/Templates/Nota Diaria Template.md", label: "Hoje", nextLabel: "Amanhã", note: "Nota diária" },
    week: { planFolder: "System/Planos/Semanais", journalFolder: "System/Periodicos/Journals/Semanais", periodicFolder: "System/Periodicos/Semanais", template: "System/Templates/Template Semanal.md", label: "a Semana", nextLabel: "Próxima Semana", note: "Nota semanal" },
    month: { planFolder: "System/Planos/Mensais", journalFolder: "System/Periodicos/Journals/Mensais", periodicFolder: "System/Periodicos/Mensais", template: "System/Templates/Template Mensal.md", label: "o Mês", nextLabel: "Próximo Mês", note: "Nota mensal" },
    semester: { planFolder: "System/Planos/Semestrais", journalFolder: "System/Periodicos/Journals/Semestrais", periodicFolder: "System/Periodicos/Semestrais", template: "System/Templates/Template Semestral.md", label: "o Semestre", nextLabel: "Próximo Semestre", note: "Nota semestral" },
    year: { planFolder: "System/Planos/Anuais", journalFolder: "System/Periodicos/Journals/Anuais", periodicFolder: "System/Periodicos/Anuais", template: "System/Templates/Template Anual.md", label: "o Ano", nextLabel: "Próximo Ano", note: "Nota anual" },
    quinquennium: { planFolder: "System/Planos/Quinquenais", journalFolder: "System/Periodicos/Journals/Quinquenais", periodicFolder: "System/Periodicos/Quinquenais", template: "System/Templates/Template Quinquenal.md", label: "o Quinquênio", nextLabel: "Próx Quinquênio", note: "Nota quinquenal" },
};
const scopeCfg = (s) => SCOPES[s] || SCOPES.day;
const OFFSET = { day: D.getOffsetDateStr, week: D.getOffsetWeekStr, month: D.getOffsetMonthStr, semester: D.getOffsetSemesterStr, year: D.getOffsetYearStr, quinquennium: D.getOffsetQuinquenniumStr };
const CURRENT = { day: D.getTodayDateStr, week: D.getTodayWeekStr, month: D.getTodayMonthStr, semester: D.getTodaySemesterStr, year: D.getTodayYearStr, quinquennium: D.getTodayQuinquenniumStr };
const offset = (s, d, n) => (OFFSET[s] || D.getOffsetDateStr)(d, n);
const weekOf = (dateStr) => window.moment(dateStr, "YYYY-MM-DD").format("YYYY-[W]WW");

// Estilos da Home (uma vez por janela)
(() => {
    const id = "dc-home-css", css = `
.home-v5-container{width:100%!important;max-width:100%!important}
.home-v5-hero-deck{display:grid;grid-template-columns:minmax(200px,1fr) minmax(598px,auto) minmax(180px,1fr);gap:14px;margin:10px 0 20px;align-items:start;width:100%}
.home-v5-sticky-nav{position:sticky;top:0;z-index:50}
.home-v5-col{min-width:0;display:flex;flex-direction:column;box-sizing:border-box}
@media (max-width:768px){.home-v5-hero-deck{grid-template-columns:1fr}}
.dcg-row:not(#dcg){transition:background-color .15s ease}
.dcg-row:not(#dcg):hover{background-color:var(--background-modifier-hover)!important}`;
    let el = document.getElementById(id);
    if (!el) { el = document.createElement("style"); el.id = id; document.head.appendChild(el); }
    if (el.textContent !== css) el.textContent = css;
})();

// ─────────────────────────────────────────────────────────────────────────────
// SETTINGS
// ─────────────────────────────────────────────────────────────────────────────

const settingsFm = () => { const f = app.vault.getAbstractFileByPath(SETTINGS_PATH); return (f && app.metadataCache.getFileCache(f)?.frontmatter) || {}; };

function usePersistedFlag(key, def) {
    const stored = settingsFm()[key];
    const [local, setLocal] = dc.useState(null);
    const value = local !== null ? local : (typeof stored === "boolean" ? stored : def);
    const update = async (next) => {
        setLocal(next);
        const f = app.vault.getAbstractFileByPath(SETTINGS_PATH);
        if (!f) { console.warn(`[dailyWrapper] ${SETTINGS_PATH} não encontrado; ${key} não foi salvo.`); return; }
        try { await app.fileManager.processFrontMatter(f, fm => { fm[key] = next; }); } catch (e) { console.error(`[dailyWrapper] falha ao salvar ${key}:`, e); }
    };
    return [value, update];
}

const DEFAULT_TABS = [
    { id: "morning", label: "Manhã", widget: "dc-sleepTracker" }, { id: "activities", label: "Atividades", widget: "dc-activityLogger" },
    { id: "meals", label: "Refeições", widget: "dc-todayMenu" }, { id: "movement", label: "Movimento", widget: "dc-workoutToday" },
    { id: "journal", label: "Diário", widget: null }, { id: "evening", label: "Noite", widget: "dc-eveningReflection" },
    { id: "tracker", label: "Tendências", widget: "dc-activityTracker" },
];
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F1E6}-\u{1F1FF}\u{200D}\u{20E3}]/gu;
function installedModules() {
    const list = settingsFm()["installed-modules"];
    if (!Array.isArray(list) || !list.length) return DEFAULT_TABS;
    const ok = list.filter(m => m && m.id).map(m => ({ id: m.id, label: String(m.label || m.id).replace(EMOJI, "").trim(), widget: m.widget || null }));
    return ok.length ? ok : DEFAULT_TABS;
}

// ─────────────────────────────────────────────────────────────────────────────
// CARREGAMENTO SOB DEMANDA (só para widgets fora do mapa)
// ─────────────────────────────────────────────────────────────────────────────

function ErrorBox({ msg }) {
    return <div style={{ padding: 12, fontSize: 12, textAlign: "center", color: "var(--text-muted)", border: "1px solid color-mix(in srgb, var(--text-error) 30%, transparent)", borderRadius: 8 }}>Falha no widget: {msg}</div>;
}
let Boundary = ({ children }) => children;
try {
    const RC = dc.preact?.Component || dc.React?.Component;
    if (RC) Boundary = class extends RC {
        constructor(p) { super(p); this.state = { err: null }; }
        static getDerivedStateFromError(e) { return { err: e }; }
        componentDidCatch(e) { console.error("[dailyWrapper] widget", e); }
        render() { return this.state.err ? <ErrorBox msg={this.state.err?.message || "erro desconhecido"} /> : this.props.children; }
    };
} catch (e) { /* sem componentes de classe */ }

function Widget({ name, ...props }) {
    const Known = KNOWN[name];
    const [Loaded, setLoaded] = dc.useState(null);
    const [err, setErr] = dc.useState(null);
    dc.useEffect(() => {
        if (Known || !name) return;
        W(name).then(r => setLoaded(() => r.Func || r.default || r)).catch(e => setErr(e?.message || String(e)));
    }, [name]);
    const C = Known || Loaded;
    if (err) return <ErrorBox msg={`${name}: ${err}`} />;
    if (!C) return <div style={{ padding: 16, textAlign: "center", color: "var(--text-muted)" }}>Carregando…</div>;
    return <Boundary><C {...props} /></Boundary>;
}

// ─────────────────────────────────────────────────────────────────────────────
// EDITOR DE ARQUIVO (plano e diário)
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_CYCLE = { " ": "/", "/": "x", "x": ">", "X": ">", ">": "<", "<": "-", "-": " " };

function useFileEditor(filePath, initialText) {
    const [content, setContent] = dc.useState("");
    const [exists, setExists] = dc.useState(false);
    const [loading, setLoading] = dc.useState(true);
    const [savedAt, setSavedAt] = dc.useState(null);
    const fmRef = dc.useRef(""), textRef = dc.useRef(""), timer = dc.useRef(null);
    const load = async () => {
        setLoading(true);
        const f = app.vault.getAbstractFileByPath(filePath);
        if (f) {
            const raw = await app.vault.cachedRead(f);
            const m = raw.match(/^---[\s\S]+?---\r?\n/);
            fmRef.current = m ? m[0] : "";
            textRef.current = m ? raw.slice(m[0].length) : raw;
            setContent(textRef.current); setExists(true);
        } else { textRef.current = ""; setContent(""); setExists(false); }
        setLoading(false);
    };
    dc.useEffect(() => { load(); }, [filePath]);
    dc.useEffect(() => () => {
        if (!timer.current) return;
        clearTimeout(timer.current); timer.current = null;
        const f = app.vault.getAbstractFileByPath(filePath);
        if (f) app.vault.modify(f, fmRef.current + textRef.current);
    }, [filePath]);
    const saveSoon = (text) => {
        textRef.current = text;
        clearTimeout(timer.current);
        timer.current = setTimeout(async () => {
            timer.current = null;
            const f = app.vault.getAbstractFileByPath(filePath);
            if (f) { await app.vault.modify(f, fmRef.current + text); setSavedAt(new Date()); }
        }, 800);
    };
    const onInput = (e) => { setContent(e.target.value); saveSoon(e.target.value); };
    const create = async () => {
        const parts = filePath.split("/"), name = parts.pop();
        let cur = "";
        for (const p of parts) { cur = cur ? `${cur}/${p}` : p; if (!app.vault.getAbstractFileByPath(cur)) await app.vault.createFolder(cur); }
        try { await app.vault.create(filePath, typeof initialText === "function" ? initialText() : initialText); new Notice(`Criado ${name}`); await load(); return true; }
        catch (e) { console.error(e); return false; }
    };
    const toggleBox = (idx) => {
        let n = -1;
        const next = content.replace(/^(\s*- \[)(.)(\])/gm, (m, a, mark, b) => (++n === idx ? `${a}${STATUS_CYCLE[mark] || " "}${b}` : m));
        if (next !== content) { setContent(next); saveSoon(next); }
    };
    return { content, exists, loading, savedAt, onInput, create, toggleBox, open: () => app.workspace.openLinkText(filePath, "", true) };
}

// ─────────────────────────────────────────────────────────────────────────────
// TAREFAS (blocos ```tasks/```tasknotes e prazo de hoje)
// ─────────────────────────────────────────────────────────────────────────────

const field = (p, k) => { try { if (typeof p.value === "function") { const v = p.value(k); if (v !== undefined && v !== null) return v; } } catch (e) { /* ignora */ } return p[k] ?? p.frontmatter?.[k] ?? null; };
const hasTag = (p, t) => { const v = field(p, "tags") || []; return (Array.isArray(v) ? v : [v]).some(x => String(x) === t); };
const taskOf = (p) => {
    const path = String(p.$path || p.file?.path || ""), tags = field(p, "tags") || [];
    const proj = (Array.isArray(tags) ? tags : [tags]).find(t => typeof t === "string" && t.startsWith("projeto/"));
    return { path, name: String(field(p, "title") || path.split("/").pop().replace(".md", "")), priority: String(field(p, "priority") || "normal"), status: String(field(p, "status") || "open"), due: String(field(p, "due_date") || ""), project: proj ? proj.replace("projeto/", "") : null };
};
const STATUS_MARK = { open: "○", "in-progress": "◑", done: "✓" };

function TaskRow({ t, primary }) {
    return (
        <div className="dcg-row" onClick={() => app.workspace.openLinkText(t.path, "", true)} style={{
            display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", cursor: "pointer", borderRadius: 5,
            background: "var(--background-secondary-alt)", border: `1px solid ${alpha(primary, 0.13)}`,
        }}>
            <span title={`prioridade ${t.priority || "normal"}`} style={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0, background: PRIO_COLOR[t.priority] || primary }} />
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{STATUS_MARK[t.status] || "○"}</span>
            <span style={{ flex: 1, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</span>
            {t.project && <span style={{ fontSize: 10, color: "var(--text-muted)", background: alpha(primary, 0.13), padding: "1px 5px", borderRadius: 3 }}>{t.project}</span>}
        </div>
    );
}

function TasksBlock({ query, theme }) {
    const pages = dc.useQuery(TASK_QUERY);
    const tasks = dc.useMemo(() => {
        const L = query.trim().split("\n").map(l => l.trim());
        const notDone = L.some(l => /^not done$/i.test(l)), onlyDone = L.some(l => /^done$/i.test(l));
        const paths = L.filter(l => /^path includes /i.test(l)).map(l => l.replace(/^path includes /i, "").toLowerCase());
        const tags = L.filter(l => /^tags? includes? /i.test(l)).map(l => l.replace(/^tags? includes? /i, ""));
        const byPrio = L.some(l => /sort by priority/i.test(l)), byDue = L.some(l => /sort by due/i.test(l));
        const lim = L.find(l => /^limit \d+/i.test(l));
        let out = pages.filter(p => {
            if (!hasTag(p, "tipo/task")) return false;
            const st = String(field(p, "status") || "");
            if (notDone && (st === "done" || st === "cancelled")) return false;
            if (onlyDone && st !== "done") return false;
            const path = String(p.$path || p.file?.path || "").toLowerCase();
            if (paths.length && !paths.some(f => path.includes(f))) return false;
            return !tags.length || tags.every(t => hasTag(p, t));
        }).map(taskOf);
        if (byPrio) { const o = { high: 0, normal: 1, low: 2 }; out.sort((a, b) => (o[a.priority] ?? 1) - (o[b.priority] ?? 1)); }
        else if (byDue) out.sort((a, b) => a.due.localeCompare(b.due));
        return out.slice(0, lim ? parseInt(lim.match(/\d+/)[0]) : 50);
    }, [pages, query]);
    if (!tasks.length) return <div style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic", padding: "4px 0" }}>Nenhuma task encontrada.</div>;
    const primary = theme["color-primary"] || "#7c3aed";
    return <div style={{ display: "flex", flexDirection: "column", gap: 4, margin: "4px 0" }}>{tasks.map(t => <TaskRow key={t.path} t={t} primary={primary} />)}</div>;
}

function DueToday({ date, theme }) {
    const pages = dc.useQuery(TASK_QUERY);
    const tasks = dc.useMemo(() => pages.filter(p => {
        if (!hasTag(p, "tipo/task")) return false;
        const st = String(field(p, "status") || "");
        return st !== "done" && st !== "cancelled" && String(field(p, "due_date") || "").slice(0, 10) === date;
    }).map(taskOf).sort((a, b) => ({ high: 0, normal: 1, low: 2 }[a.priority] ?? 1) - ({ high: 0, normal: 1, low: 2 }[b.priority] ?? 1)), [pages, date]);
    if (!tasks.length) return null;
    const primary = theme["color-primary"] || "#7c3aed";
    return (
        <div style={{ marginTop: 14, paddingTop: 10, borderTop: `1px solid ${alpha(primary, 0.13)}` }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: primary, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 6 }}>Tasks com prazo hoje ({tasks.length})</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>{tasks.map(t => <TaskRow key={t.path} t={t} primary={primary} />)}</div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// VISUALIZAÇÃO DO MARKDOWN DO PLANO/DIÁRIO
// ─────────────────────────────────────────────────────────────────────────────

function inline(str, accent) {
    if (!str) return null;
    const re = /\*\*(.+?)\*\*|\*(.+?)\*|==(.+?)==|`(.+?)`/g, parts = [];
    let last = 0, m;
    while ((m = re.exec(str))) {
        if (m.index > last) parts.push(str.slice(last, m.index));
        if (m[1] != null) parts.push(<strong key={m.index}>{m[1]}</strong>);
        else if (m[2] != null) parts.push(<em key={m.index}>{m[2]}</em>);
        else if (m[3] != null) parts.push(<mark key={m.index} style={{ background: alpha(accent, 0.2), color: accent, borderRadius: 2, padding: "0 2px" }}>{m[3]}</mark>);
        else parts.push(<code key={m.index} style={{ fontFamily: "var(--font-monospace)", fontSize: "0.85em", background: "rgba(255,255,255,0.08)", padding: "1px 5px", borderRadius: 3 }}>{m[4]}</code>);
        last = m.index + m[0].length;
    }
    if (last < str.length) parts.push(str.slice(last));
    return parts.length <= 1 ? parts[0] ?? null : parts;
}
const MARKS = {
    " ": { style: {} }, "/": { label: "em progresso", style: { fontWeight: 600 } },
    "x": { style: { color: "var(--text-muted)", textDecoration: "line-through" } }, "X": { style: { color: "var(--text-muted)", textDecoration: "line-through" } },
    ">": { label: "adiada", badge: "→", style: { color: "var(--text-muted)", textDecoration: "line-through" } },
    "<": { label: "agendada", badge: "»", style: {} },
    "-": { label: "cancelada", badge: "✕", style: { color: "var(--text-muted)", textDecoration: "line-through" } },
};

function PlanView({ content, onToggle, theme, periodKey = null }) {
    const primary = theme["color-primary"] || "#7c3aed", accent = theme["color-accent"] || "#f59e0b";
    const segs = [], lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
        const f = lines[i].match(/^(`{3,})([\w]*)/);
        if (!f) { segs.push({ type: "line", content: lines[i] }); continue; }
        const code = [];
        for (i++; i < lines.length && !lines[i].startsWith(f[1]); i++) code.push(lines[i]);
        segs.push({ type: "code", lang: f[2] || "", content: code.join("\n") });
    }
    let box = 0;
    return (
        <div style={{ lineHeight: 1.6, padding: "2px 0" }}>
            {segs.map((s, si) => {
                const k = `${s.type}-${si}`;
                if (s.type === "code") {
                    if (s.lang === "tasks" || s.lang === "tasknotes") return <TasksBlock key={k} query={s.content} theme={theme} />;
                    if (s.lang === "datacorejsx" && s.content.includes(WEEKLY_CARDS)) return <Widget key={k} name={WEEKLY_CARDS} targetDate={periodKey} />;
                    return <pre key={k} style={{ background: "rgba(255,255,255,0.05)", borderRadius: 6, padding: "8px 12px", fontSize: 12, overflowX: "auto", color: "var(--text-muted)", margin: "6px 0", fontFamily: "var(--font-monospace)" }}>{s.lang && <span style={{ color: primary, fontSize: 10, display: "block", marginBottom: 4 }}>{s.lang}</span>}{s.content}</pre>;
                }
                const t = s.content.trimEnd();
                const hm = t.match(/^(#{1,6})\s+(.*)/);   // não usar h: é a fábrica do JSX
                if (hm) { const l = hm[1].length; return <div key={k} style={{ fontSize: ["1.5em", "1.3em", "1.15em", "1.05em", "1em", "0.95em"][l - 1], fontWeight: l <= 2 ? 700 : 600, margin: l === 1 ? "10px 0 6px" : "8px 0 4px" }}>{inline(hm[2], accent)}</div>; }
                const tk = t.match(/^(\s*)- \[(.)\]\s*(.*)/);
                if (tk) {
                    const idx = box++, mark = tk[2], cfg = MARKS[mark] || { label: mark, badge: mark, style: {} };
                    const square = (fill) => <span style={{ width: 14, height: 14, border: `1.8px solid ${primary}`, borderRadius: 3, background: fill, display: "inline-block", boxSizing: "border-box" }} />;
                    return (
                        <div key={k} style={{ display: "flex", alignItems: "flex-start", gap: 6, margin: "3px 0", paddingLeft: tk[1].length * 12 }}>
                            <span onClick={() => onToggle?.(idx)} style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 18, height: 18, marginTop: 2, flexShrink: 0, userSelect: "none" }}>
                                {mark === " " ? square("transparent") : mark === "/" ? square(`linear-gradient(90deg, ${primary} 50%, transparent 50%)`) : (mark === "x" || mark === "X") ? square(primary)
                                    : <span style={{ fontSize: 11, fontWeight: 700, color: primary, background: alpha(primary, 0.13), borderRadius: 3, padding: "0 4px", lineHeight: "16px" }}>{cfg.badge || mark}</span>}
                            </span>
                            <span style={{ fontSize: 14, flex: 1, ...cfg.style }}>
                                {inline(tk[3], accent)}
                                {cfg.label && <span style={{ fontSize: 10, marginLeft: 8, padding: "1px 5px", borderRadius: 3, background: "rgba(255,255,255,0.06)", color: "var(--text-muted)", fontWeight: 400, textDecoration: "none", display: "inline-block" }}>{cfg.label}</span>}
                            </span>
                        </div>
                    );
                }
                const li = t.match(/^(\s*)[-*]\s+(.*)/);
                if (li) return <div key={k} style={{ display: "flex", gap: 6, margin: "3px 0", paddingLeft: li[1].length * 12 }}><span style={{ color: "var(--text-muted)", flexShrink: 0 }}>•</span><span style={{ fontSize: 14 }}>{inline(li[2], accent)}</span></div>;
                if (/^---+$/.test(t)) return <hr key={k} style={{ border: "none", borderTop: `1px solid ${alpha(primary, 0.13)}`, margin: "8px 0" }} />;
                if (t === "") return <div key={k} style={{ height: 5 }} />;
                return <div key={k} style={{ fontSize: 14, margin: "3px 0" }}>{inline(t, accent)}</div>;
            })}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// PLANO E DIÁRIO
// ─────────────────────────────────────────────────────────────────────────────

// Botões do cabeçalho dos cartões: mesmo estilo do original (botão do Obsidian com estes ajustes).
const editBtn = (primary, muted, on) => ({ background: on ? alpha(primary, 0.2) : "transparent", border: `1px solid ${alpha(primary, 0.27)}`, borderRadius: 4, color: on ? primary : muted, cursor: "pointer", fontSize: 9, padding: "1px 6px", opacity: 0.6 });
const openBtn = (muted) => ({ background: "transparent", border: `1px solid ${alpha(muted, 0.27)}`, borderRadius: 4, color: muted, cursor: "pointer", fontSize: 9, padding: "1px 4px", opacity: 0.6 });

function EmptyFile({ text, button, onCreate, primary }) {
    return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 30, borderRadius: 12, background: alpha(primary, 0.05), border: `1px dashed ${alpha(primary, 0.27)}` }}>
            <span style={{ color: "var(--text-muted)", fontSize: 13 }}>{text}</span>
            {/* botão do tema (fundo animado), como no original; só sem o emoji */}
            <GloButton label={button} variant="primary" onClick={onCreate} />
        </div>
    );
}

function FileCard({ title, ed, editing, setEditing, primary, bg, muted = "var(--text-muted)", marks = false, children }) {
    return (
        <div style={{ background: bg || "var(--background-primary)", borderRadius: 12, border: `1px solid ${alpha(primary, 0.2)}`, padding: "16px 20px", marginTop: 16, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${alpha(primary, 0.13)}`, paddingBottom: 8, marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: primary, textTransform: "uppercase", letterSpacing: ".04em" }}>{title}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {ed.savedAt && <span style={{ fontSize: 10, color: "var(--text-muted)", opacity: 0.7 }}>salvo às {ed.savedAt.toLocaleTimeString()}</span>}
                    {setEditing && <button onClick={() => setEditing(!editing)} style={editBtn(primary, muted, editing)}>{marks ? (editing ? "\u2713 Ok" : "\u270E Editar") : (editing ? "Ok" : "Editar")}</button>}
                    <button onClick={ed.open} style={openBtn(muted)} title="Abrir a nota">{marks ? "\u2197 Abrir" : "Abrir"}</button>
                </div>
            </div>
            {children}
        </div>
    );
}

function PlanEditor({ date, scope = "day", theme, tomorrow = false }) {
    const cfg = scopeCfg(scope), name = `${date} Plano.md`, path = `${cfg.planFolder}/${name}`;
    const ed = useFileEditor(path, () => `---\ncreated: ${D.getTodayDateStr()}\ntags:\n  - note\n  - plano\n  - ${scope}\n---\n## Plano para ${date}\n\n- [ ] \n`);
    const [editing, setEditing] = dc.useState(false);
    const primary = theme["color-primary"] || "#7c3aed";
    if (ed.loading) return <div style={{ color: "var(--text-muted)", padding: 12 }}>Carregando…</div>;
    if (!ed.exists) return <EmptyFile primary={primary} text={`Nenhum plano encontrado para ${(tomorrow ? cfg.nextLabel : cfg.label).toLowerCase()} (${date}).`} button={`Criar Plano para ${tomorrow ? cfg.nextLabel : cfg.label}`} onCreate={async () => { if (await ed.create()) setEditing(true); }} />;
    return (
        <FileCard title={tomorrow ? `Editando: ${name}` : `Plano para ${cfg.label}`} ed={ed} editing={editing} setEditing={setEditing} primary={primary} bg={theme["color-background"]} muted={theme["color-text-muted"]}>
            {editing || tomorrow
                ? <textarea value={ed.content} onInput={ed.onInput} spellCheck={false} autoFocus={editing && !tomorrow} placeholder={`Escreva o plano de ${tomorrow ? "amanhã" : "hoje"}...`}
                    style={{ width: "100%", minHeight: tomorrow ? 375 : 150, padding: 0, background: "transparent", border: "none", fontSize: 14, lineHeight: 1.5, fontFamily: "var(--font-monospace)", resize: "vertical", outline: "none", boxShadow: "none" }} />
                : <PlanView content={ed.content} onToggle={ed.toggleBox} theme={theme} />}
            {!tomorrow && scope === "day" && <DueToday date={date} theme={theme} />}
        </FileCard>
    );
}

function PlanTabs({ date, theme, scope = "day" }) {
    const [tab, setTab] = dc.useState("plan");
    const cfg = scopeCfg(scope), primary = theme["color-primary"] || "#7c3aed";
    return (
        <div style={{ marginBottom: 28 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, padding: 4, borderRadius: 12, marginBottom: 12, background: "var(--background-secondary-alt)", border: `1px solid ${alpha(primary, 0.13)}` }}>
                <GloButton label={`Plano para ${cfg.label}`} variant="liquid-glass" active={tab === "plan"} glow={false} lift={false} onClick={() => setTab("plan")} />
                <GloButton label={`Plano para ${cfg.nextLabel}`} variant="liquid-glass" active={tab === "tomorrow"} glow={false} lift={false} onClick={() => setTab("tomorrow")} />
            </div>
            {tab === "plan" ? <PlanEditor date={date} theme={theme} scope={scope} /> : <PlanEditor date={offset(scope, date, 1)} theme={theme} scope={scope} tomorrow />}
        </div>
    );
}

function Journal({ date, theme, scope = "day", weeklyCards = true }) {
    const cfg = scopeCfg(scope), path = `${cfg.journalFolder}/${date} Diario.md`;
    const ed = useFileEditor(path, () => {
        const plan = scope === "day" || scope === "week" ? `plano: "[[${cfg.planFolder}/${date} Plano|${date} Plano]]"\n` : "";
        return `---\ncreated: ${D.getTodayDateStr()}\ntags:\n  - journal\n  - ${scope}\n${plan}---\n## Diário de ${date}\n\n${scope === "week" && weeklyCards ? `${WEEKLY_CARDS_BLOCK}\n\n` : ""}`;
    });
    const [editing, setEditing] = dc.useState(false);
    const primary = theme["color-primary"] || "#7c3aed";
    if (ed.loading) return <div style={{ color: "var(--text-muted)", padding: 12 }}>Carregando…</div>;
    if (!ed.exists) return <EmptyFile primary={primary} text={`Nenhuma entrada no diário para ${date}.`} button="Criar Entrada no Diário" onCreate={async () => { if (await ed.create()) setEditing(true); }} />;
    return (
        <FileCard title="Diário" ed={ed} editing={editing} setEditing={setEditing} primary={primary} bg={theme["color-background"]} muted={theme["color-text-muted"]} marks>
            {editing
                ? <textarea value={ed.content} onInput={ed.onInput} spellCheck={false} autoFocus placeholder="Apenas escreva..." style={{ width: "100%", minHeight: 400, padding: 0, background: "transparent", border: "none", fontSize: 15, lineHeight: 1.6, resize: "vertical", outline: "none", boxShadow: "none" }} />
                : <PlanView content={ed.content} onToggle={ed.toggleBox} theme={theme} periodKey={date} />}
        </FileCard>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// CABEÇALHO
// ─────────────────────────────────────────────────────────────────────────────

async function createPeriodicNote(dateStr, scope) {
    const cfg = scopeCfg(scope);
    const tpl = app.vault.getAbstractFileByPath(cfg.template);
    if (!tpl) {
        new Notice(`Modelo ${cfg.template} não encontrado; usando nota em branco.`);
        if (app.vault.getAbstractFileByPath(cfg.periodicFolder)) { await app.vault.create(`${cfg.periodicFolder}/${dateStr}.md`, ""); return true; }
        return false;
    }
    const templater = app.plugins.plugins["templater-obsidian"];
    if (!templater) { new Notice("Plugin Templater não está ativado."); return false; }
    let folder = app.vault.getAbstractFileByPath(cfg.periodicFolder);
    if (!folder) {
        try { await app.vault.createFolder(cfg.periodicFolder); folder = app.vault.getAbstractFileByPath(cfg.periodicFolder); }
        catch (e) { new Notice(`Não foi possível criar a pasta: ${cfg.periodicFolder}`); return false; }
    }
    try { await templater.templater.create_new_note_from_template(tpl, folder, dateStr, false); new Notice(`Criado ${dateStr} em ${cfg.periodicFolder}`); return true; }
    catch (e) { console.error("Falha ao criar nota:", e); new Notice("Erro ao criar a nota."); return false; }
}

function Banner({ tone, children, action }) {
    return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "8px 14px", borderRadius: 8, marginBottom: 10, background: alpha(tone, 0.12), border: `1px solid ${alpha(tone, 0.3)}` }}>
            <span style={{ fontSize: 13, color: tone, fontWeight: 600 }}>{children}</span>
            {action}
        </div>
    );
}

function DateNav({ scope, date, onDate, onCalendar, theme }) {
    const prev = offset(scope, date, -1), next = offset(scope, date, 1);
    const primary = theme["color-primary"] || "#7c3aed";
    return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, paddingBottom: 8, position: "relative" }}>
            <GloButton icon="←" label={D.formatPeriodShort(prev, scope)} variant="liquid-glass" glow={false} lift={false} onClick={() => onDate(prev)} />
            <div onClick={scope === "day" ? onCalendar : undefined} style={{ padding: "8px 16px", borderRadius: 10, background: alpha(primary, 0.15), border: `1px solid ${primary}`, cursor: scope === "day" ? "pointer" : "default", userSelect: "none" }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{D.formatPeriodDisplay(date, scope)}</span>
            </div>
            <GloButton iconRight="→" label={D.formatPeriodShort(next, scope)} variant="liquid-glass" glow={false} lift={false} onClick={() => onDate(next)} />
            <button title="Abrir a nota do período" onClick={() => app.workspace.openLinkText(date, "", true)} style={{ position: "absolute", right: 0, background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 14, boxShadow: "none" }}>↗</button>
        </div>
    );
}

function QuickStats({ date, theme, bg }) {
    const { fm, save } = D.useDayFrontmatter(date, 0);
    const primary = theme["color-primary"] || "#7c3aed", success = theme["color-success"] || "#10b981";
    const hours = Number(fm["sleep-hours"]) || ((fm["sleep-bedtime"] || fm["sleep-wakeup"]) ? sleepHours(fm["sleep-bedtime"] || "23:00", fm["sleep-wakeup"] || "07:00") : 0);
    const items = [["Sono", `${hours}h`], ["Humor", `${fm.mood || 0}/5`], ["Energia", `${fm.energy || 0}/5`], ["Pontos", String(fm["health-score"] || "—").replace(EMOJI, "").trim()]];
    const water = Number(fm["water-ml"]) || 0;
    return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "6px 12px", flexWrap: "wrap", background: bg ? alpha(primary, 0.06) : "transparent", borderRadius: 10 }}>
            {items.map(([l, v]) => (
                <div key={l} style={{ display: "flex", alignItems: "baseline", gap: 5, padding: "3px 8px", fontSize: 12 }}>
                    <span style={{ color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: ".04em" }}>{l}</span>
                    <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{v}</span>
                </div>
            ))}
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 8px", background: alpha(success, 0.13), borderRadius: 6, marginLeft: 6 }}>
                <span style={{ color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: ".04em" }}>Água</span>
                <span style={{ fontSize: 12, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{water}ml</span>
                {D.isToday(date) && <button onClick={() => save({ "water-ml": water + 250 }, true)} style={{ background: alpha(success, 0.3), border: "none", borderRadius: 4, padding: "2px 6px", fontSize: 10, fontWeight: 700, color: success, cursor: "pointer", height: "auto", boxShadow: "none" }}>+250</button>}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// NAVEGAÇÃO POR EMBEDS E COMANDOS
// ─────────────────────────────────────────────────────────────────────────────

const DIRECTORIES = [
    { id: "tasks", label: "Tarefas", items: [
        { label: "Inbox", type: "embed", value: "![[System/Inbox/Triagem_Subtarefas]]" },
        { label: "Agenda", type: "embed", value: "![[System/TaskNotes/Views/agenda-default.base]]" },
        { label: "Calendário", type: "embed", value: "![[System/TaskNotes/Views/calendar-default.base]]" },
        { label: "Quadro Kanban", type: "embed", value: "![[TaskNotes/Views/kanban-default.base|kanban-default]]" },
        { label: "Ver todos", type: "embed", value: "![[System/TaskNotes/Views/tasks-default.base]]" },
        { label: "Estatísticas", type: "embed", value: "![[System/Dashboards/Estatisticas]]" },   // widget dc-taskStats (a tela do TaskNotes não embute)
        { label: "Secretária", type: "embed", value: "![[System/Dashboards/Secretaria]]" },   // dc-secretaria: semana, E1, rituais, capturas e conversa da secretária
    ] },
    { id: "notes", label: "Conhecimento", items: [
        { label: "Caixa de entrada", type: "embed", value: "![[System/Templates/Bases/Inbox.base]]" },
        { label: "Wiki", type: "embed", value: "![[System/Wiki]]" },
        { label: "Grafo", type: "command", value: "graph:open" },
    ] },
    { id: "admin", label: "Sistema", items: [
        { label: "Configurações", type: "command", value: "app:open-settings" },
        { label: "Rice AF Settings", type: "embed", value: "![[System/Settings]]" },
        { label: "Recarregar app", type: "command", value: "app:reload" },
    ] },
];
const CUSTOM_DASHBOARDS = [
    { label: "LAMIA", type: "embed", value: "![[LAMIA/DASHBOARD_LAMIA.md]]" },
    { label: "Faculdade", type: "embed", value: "![[Faculdade/DASHBOARD_Faculdade.md]]" },
    { label: "Projetos", type: "embed", value: "![[Projetos/MOC_Projetos_Pessoais.md]]" },
];

/** Notas com tags dashboards/categorias/planner/tipo/moc (frontmatter ou inline). Cache de 5 min na janela. */
function scanViews() {
    const C = (window.__dcHomeViews = window.__dcHomeViews || {});
    if (C.at && Date.now() - C.at < 300000) return C.data;
    const img = (raw, src) => {
        if (!raw) return null;
        let p = typeof raw === "object" && raw.path ? raw.path : raw;
        if (typeof p !== "string") return null;
        if (/^(http|data:|app:)/.test(p)) return p;
        p = p.replace(/^\[\[|\]\]$/g, "").split("|")[0];
        const f = app.metadataCache.getFirstLinkpathDest(p, src);
        return f ? app.vault.adapter.getResourcePath(f.path) : null;
    };
    const item = (f, fm) => {
        const bg = img(fm.cover || fm.image, f.path);
        const sp = img(fm.icon || fm.sprite, f.path);
        return { label: f.basename, type: "embed", value: `![[${f.path}]]`, bg: bg ? `url("${bg}")` : null, sprite: sp && /^(http|data:|app:)/.test(sp) ? sp : null };
    };
    const d = { dashboards: [], categories: [], planners: [], mocs: [] };
    for (const f of app.vault.getMarkdownFiles()) {
        const c = app.metadataCache.getFileCache(f);
        if (!c) continue;
        const ft = c.frontmatter?.tags, tags = Array.isArray(ft) ? [...ft] : typeof ft === "string" ? [ft] : [];
        if (c.tags) tags.push(...c.tags.map(t => t.tag.replace(/^#/, "")));
        if (!tags.length) continue;
        const fm = c.frontmatter || {};
        if (tags.includes("dashboards")) d.dashboards.push(item(f, fm));
        if (tags.includes("categorias")) d.categories.push(item(f, fm));
        if (tags.includes("planner")) d.planners.push(item(f, fm));
        if (tags.includes("tipo/moc")) d.mocs.push(item(f, fm));
    }
    const by = (a, b) => a.label.localeCompare(b.label);
    Object.values(d).forEach(l => l.sort(by));
    C.at = Date.now(); C.data = d;
    return d;
}

function useViewDirectories() {
    const [d, setD] = dc.useState(() => window.__dcHomeViews?.data || null);
    dc.useEffect(() => {
        if (d && Date.now() - window.__dcHomeViews.at < 300000) return;
        const run = () => setD(scanViews());
        const id = window.requestIdleCallback ? requestIdleCallback(run, { timeout: 1500 }) : setTimeout(run, 200);
        return () => (window.cancelIdleCallback ? cancelIdleCallback(id) : clearTimeout(id));
    }, []);
    const v = d || { dashboards: [], categories: [], planners: [], mocs: [] };
    const dash = [...CUSTOM_DASHBOARDS, ...v.dashboards];
    return [
        ...DIRECTORIES.map(x => x.id === "notes" ? { ...x, items: [...x.items, ...v.mocs] } : x),
        { id: "dashboards", label: "Dashboards", hidden: !d, items: dash },
        { id: "categories", label: "Categorias", hidden: !v.categories.length, items: v.categories },
        { id: "planners", label: "Planejadores", hidden: !v.planners.length, items: v.planners },
    ];
}

/** Alterna um embed logo abaixo do bloco do wrapper na nota ativa (mesma regra de antes). */
async function toggleDashboardEmbed(link) {
    const file = app.workspace.getActiveFile();
    if (!file) { new Notice("Nenhuma nota ativa."); return null; }
    try {
        let result = null;
        await app.vault.process(file, (content) => {
            const lines = content.split("\n");
            let end = -1, inside = false, found = false;
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].trim().startsWith("```")) { if (inside) { end = i; if (found) break; inside = false; } else { inside = true; found = false; } }
                else if (inside && lines[i].includes("dc-dailyWrapper")) found = true;
            }
            if (!found || end === -1) {
                inside = false; end = -1;
                for (let i = 0; i < lines.length; i++) if (lines[i].trim().startsWith("```")) { if (inside) { end = i; break; } inside = true; }
            }
            if (end === -1) {
                const present = content.includes(link);
                let cleaned = content.replace(/!\[\[.*?\]\]/g, "").trim();
                if (!present) cleaned += "\n\n" + link;
                result = present ? "closed" : "opened";
                return cleaned;
            }
            const base = lines.slice(0, end + 1), after = lines.slice(end + 1);
            const active = after.some(l => l.trim() === link.trim());
            const rest = after.filter(l => !l.trim().startsWith("![["));
            while (rest.length && rest[0].trim() === "") rest.shift();
            result = active ? "closed" : "switched";
            return (active ? [...base, ...rest] : [...base, "", link, ...rest]).join("\n");
        });
        new Notice(result === "closed" ? "Visão fechada" : "Visão aberta");
        return result;
    } catch (e) { console.error(e); new Notice("Erro ao alternar a visão"); return null; }
}

// Fecha a vista aberta: tira os embeds ![[...]] logo abaixo do bloco do wrapper
// na nota da própria Home (regra: fechar a gaveta de navegação fecha o embed).
async function closeDashboardEmbed(path) {
    const file = path && app.vault.getFileByPath(path);
    if (!file) return;
    try {
        await app.vault.process(file, (content) => {
            const lines = content.split("\n");
            let end = -1, inside = false, found = false;
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].trim().startsWith("```")) { if (inside) { end = i; if (found) break; inside = false; } else { inside = true; found = false; } }
                else if (inside && lines[i].includes("dc-dailyWrapper")) found = true;
            }
            if (!found || end === -1) return content;
            const after = lines.slice(end + 1);
            if (!after.some(l => l.trim().startsWith("![["))) return content;
            const rest = after.filter(l => !l.trim().startsWith("![["));
            while (rest.length && rest[0].trim() === "") rest.shift();
            return [...lines.slice(0, end + 1), ...(rest.length ? ["", ...rest] : [])].join("\n");
        });
    } catch (e) { console.error("[dailyWrapper] fechar vista", e); }
}

function ViewNav({ dirs, active, onDir, onItem, compact = false, dirsOnly = false, navRef = null, theme }) {
    const primary = theme["color-primary"] || "#7c3aed";
    const visible = dirs.filter(d => !d.hidden), items = active && !dirsOnly ? visible.find(d => d.id === active)?.items || [] : [];
    return (
        <div ref={navRef} style={compact ? { display: "flex", flexDirection: "column", gap: 8 } : { display: "flex", flexDirection: "column", alignItems: "center", gap: 12, marginTop: 20, paddingTop: 16, borderTop: `1px solid ${alpha(primary, 0.13)}` }}>
            <div style={{ display: "flex", gap: compact ? 4 : 8, flexWrap: "wrap", justifyContent: compact ? "flex-start" : "center" }}>
                {visible.map(d => <GloButton key={d.id} label={d.label} variant="liquid-glass" size={compact ? "small" : undefined} active={active === d.id} glow={false} lift={false} onClick={() => onDir(active === d.id ? null : d.id)} style={compact ? { fontSize: 11, padding: "2px 8px" } : { minWidth: 100 }} />)}
            </div>
            {active && !dirsOnly && (
                <div style={{ display: "flex", gap: compact ? 4 : 8, flexWrap: "wrap", justifyContent: compact ? "flex-start" : "center", padding: compact ? 8 : 12, borderRadius: compact ? 8 : 12, background: alpha(primary, 0.05) }}>
                    {items.map(it => compact
                        ? <GloButton key={it.value || it.label} label={it.label} variant="liquid-glass" size="small" glow={false} onClick={() => onItem(it)} style={{ fontSize: 11 }} />
                        : <GloButton key={it.value || it.label} label={it.label} bg={it.bg} sprite={it.sprite} showSprite={!!it.sprite} variant={it.bg ? "primary" : "liquid-glass"} size="small" glow={false} onClick={() => onItem(it)} />)}
                </div>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// HOME
// ─────────────────────────────────────────────────────────────────────────────

function DailyWrapperReal({ variant = "v5" } = {}) {
    const v4 = variant === "v4";
    const { theme, settings } = useTheme();
    const bg = settings?.widgetBackgrounds !== false;
    const primary = theme["color-primary"] || "#7c3aed", surface = theme["color-surface"] || "var(--background-secondary)", muted = theme["color-text-muted"] || "var(--text-muted)";
    const [date, setDate] = dc.useState(() => D.resolveDateStr());
    const [scope, setScope] = dc.useState("day");
    const [showWeekly, setShowWeekly] = usePersistedFlag(SHOW_WEEKLY_KEY, true);
    const [tab, setTab] = dc.useState(v4 ? null : "study");
    const [calendar, setCalendar] = dc.useState(false);
    const [navDir, setNavDirState] = dc.useState(null);
    const homePath = dc.useCurrentPath();
    // Sair de uma gaveta aberta (fechar, ou abrir outra direto) também fecha a vista embutida.
    const setNavDir = (d) => { if (navDir !== null && d !== navDir) closeDashboardEmbed(homePath); setNavDirState(d); };
    const [, bump] = dc.useState(0);
    const barRef = dc.useRef(null), navRef = dc.useRef(null), firstScope = dc.useRef(true);
    const dirs = useViewDirectories();

    // Nota do período e Settings reativos (criar, apagar, renomear, editar).
    const fileName = `${date}.md`;
    dc.useEffect(() => {
        const watched = (p) => !!p && (p === SETTINGS_PATH || p.split("/").pop() === fileName);
        const on = (f) => { if (watched(f?.path)) bump(n => n + 1); };
        const onRen = (f, old) => { if (watched(f?.path) || watched(old)) bump(n => n + 1); };
        const subs = [[app.metadataCache, app.metadataCache.on("changed", on)], [app.metadataCache, app.metadataCache.on("deleted", on)], [app.vault, app.vault.on("rename", onRen)], [app.vault, app.vault.on("create", on)]];
        return () => subs.forEach(([s, r]) => s.offref(r));
    }, [fileName]);

    // Barra sticky colada no topo: compensa o padding do contêiner de rolagem.
    dc.useEffect(() => {
        const bar = barRef.current, sc = bar?.closest(".markdown-preview-view, .cm-scroller");
        if (sc) bar.style.top = `${-(parseFloat(getComputedStyle(sc).paddingTop) || 0)}px`;
    }, []);

    // Troca de escopo: volta ao período atual.
    dc.useEffect(() => {
        if (firstScope.current) { firstScope.current = false; return; }
        setDate((CURRENT[scope] || D.getTodayDateStr)());
    }, [scope]);

    const modules = installedModules();
    const tabs = dc.useMemo(() => {
        if (v4) return modules.filter(m => !["journal", "nav"].includes(m.id));
        const cand = modules.filter(m => !["journal", "activities", "tracker", "evening", "study"].includes(m.id));
        const morning = cand.find(m => m.id === "morning");
        return [
            { id: "study", label: "Estudo", widget: "dc-studySessions" },
            { ...(morning || {}), id: "morning", label: "Check-in", widget: "dc-sleepTracker" },
            ...cand.filter(m => m.id !== "morning")
        ];
    }, [JSON.stringify(modules), v4]);
    // V5: null = painel recolhido pelo usuário. V4: sempre há uma aba ativa.
    dc.useEffect(() => { if (tabs.length && (v4 || tab !== null) && !tabs.find(t => t.id === tab)) setTab(tabs[0].id); }, [tabs, tab]);

    const scrollToNav = () => setTimeout(() => { const t = navRef.current; if (!t) return; t.style.scrollMarginTop = `${barRef.current?.offsetHeight || 0}px`; t.scrollIntoView({ behavior: "smooth", block: "start" }); }, 120);
    const onNavItem = async (it, fromTab = false) => {
        if (it.type === "command") { app.commands.executeCommandById(it.value); return; }
        if (it.type !== "embed") return;
        const r = await toggleDashboardEmbed(it.value);
        if (!fromTab || (r !== "opened" && r !== "switched")) return;
        setTimeout(() => { const t = navRef.current; if (!t) return; t.style.scrollMarginTop = `${barRef.current?.offsetHeight || 0}px`; t.scrollIntoView({ behavior: "smooth", block: "start" }); }, 150);
    };

    const tabBody = () => {
        const cfg = tabs.find(t => t.id === tab);
        if (!cfg) return null;
        if (tab === "study") return <Widget name="dc-studySessions" targetDate={date} />;
        if (v4 && tab === "morning") return <Widget name="dc-sleepTracker" targetDate={date} />;
        if (tab === "morning") return (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <Widget name="dc-sleepTracker" targetDate={date} />
                <div style={{ height: 1, background: alpha(muted, 0.13), margin: "2px 0" }} />
                <Widget name="dc-eveningReflection" targetDate={date} flat />
            </div>
        );
        if (tab === "meals") return <div style={{ display: "flex", flexDirection: "column", gap: 12 }}><Widget name="dc-todayMenu" targetDate={date} /><Widget name="dc-waterTracker" targetDate={date} /></div>;
        if (tab === "evening") return <Widget name="dc-eveningReflection" targetDate={date} />;
        // Aba "Navegação": só as categorias; escolher uma abre a gaveta na barra do fim e rola até ela.
        if (tab === "nav") return <ViewNav compact dirsOnly theme={theme} dirs={dirs} active={navDir} onDir={(d) => { setNavDir(d); if (d) scrollToNav(); }} />;
        if (cfg.widget) return <Widget name={cfg.widget} targetDate={date} />;
        return <div style={{ color: muted }}>Nenhum widget configurado para este módulo.</div>;
    };

    const exists = D.dateNoteExists(date);
    const cfg = scopeCfg(scope);
    const error = theme["color-red"] || "#ef4444", warning = theme["color-warning"] || "#f59e0b";

    return (
        <div className={v4 ? "home-v4-container" : "home-v5-container"} style={{ background: bg ? surface : "transparent", border: bg ? `1px solid ${alpha(primary, 0.2)}` : "none", borderRadius: 16, padding: 16, position: "relative", boxSizing: "border-box" }}>
            <div ref={barRef} className={v4 ? undefined : "home-v5-sticky-nav"}>
                <div style={{ display: "flex", gap: 4, justifyContent: "center", marginBottom: 8, flexWrap: "wrap" }}>
                    {[["day", "Diário"], ["week", "Semanal"], ["month", "Mensal"], ["semester", "Semestral"], ["year", "Anual"], ["quinquennium", "5 Anos"]].map(([id, l]) =>
                        <GloButton key={id} label={l} variant="liquid-glass" active={scope === id} glow={false} lift={false} onClick={() => setScope(id)} style={{ borderRadius: 16 }} />)}
                </div>
                <DateNav scope={scope} date={date} theme={theme} onDate={(d) => { setDate(d); setCalendar(false); }} onCalendar={() => setCalendar(!calendar)} />
                <CalendarPopup isOpen={calendar} selectedDate={date} onSelectDate={(d) => { setDate(d); setCalendar(false); }} onClose={() => setCalendar(false)} style={{ top: 84, left: "50%", transform: "translateX(-50%)" }} />
            </div>

            {!exists && <Banner tone={error} action={<GloButton label="Criar nota" size="small" variant="liquid-glass" glow={false} onClick={async () => { if (await createPeriodicNote(date, scope)) bump(n => n + 1); }} />}>{cfg.note} ausente</Banner>}
            {scope === "day" && exists && date !== D.getTodayDateStr() && (
                <Banner tone={D.isPastDate(date) ? warning : primary} action={<GloButton label="Voltar para hoje" size="small" variant="liquid-glass" glow={false} onClick={() => setDate(D.getTodayDateStr())} />}>
                    Vendo {D.getRelativeDateLabel(date).toLowerCase()} ({D.formatDateShort(date)})
                </Banner>
            )}

            {exists ? (
                <div>
                    {scope === "day" && <QuickStats date={date} theme={theme} bg={bg} />}
                    {scope === "day" && v4 && (
                        <>
                            <div style={{ display: "flex", gap: 4, padding: 4, justifyContent: "center", background: bg ? alpha(primary, 0.08) : "transparent", borderRadius: 12, margin: "4px 0 16px", overflowX: "auto", flexWrap: "nowrap" }}>
                                {tabs.map(t => <GloButton key={t.id} label={t.label} variant="liquid-glass" active={tab === t.id} glow={false} lift={false} onClick={() => setTab(t.id)} style={{ whiteSpace: "nowrap" }} />)}
                            </div>
                            <div style={{ minHeight: 150, marginBottom: 16 }}>{tabBody()}</div>
                        </>
                    )}
                    {scope === "day" && !v4 && (
                        <div className="home-v5-hero-deck">
                            <div className="home-v5-col" style={{ background: bg ? surface : "transparent", border: bg ? `1px solid ${alpha(primary, 0.2)}` : "none", borderRadius: 16, padding: "10px 12px" }}>
                                <div style={{ display: "flex", gap: 3, padding: 2, marginBottom: 6, flexWrap: "wrap", borderRadius: 10, background: bg ? alpha(primary, 0.06) : "transparent" }}>
                                    {tabs.map(t => <GloButton key={t.id} label={t.label} variant="liquid-glass" size="small" active={tab === t.id} glow={false} lift={false} onClick={() => setTab(tab === t.id ? null : t.id)} style={{ whiteSpace: "nowrap", fontSize: 11, padding: "2px 8px" }} />)}
                                </div>
                                <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>{tabBody()}</div>
                            </div>
                            <div className="home-v5-col" style={{ alignItems: "center" }}><div style={{ width: "100%" }}><Widget name="dc-activityTracker" targetDate={date} /></div></div>
                            <div className="home-v5-col"><Widget name="dc-activityLogger" targetDate={date} compact /></div>
                        </div>
                    )}
                    <div style={{ marginTop: scope === "day" ? 0 : 28 }}>
                        {scope === "day" ? (
                            <div>
                                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
                                    <GloButton label="Mostrar semanal" variant="liquid-glass" active={showWeekly} glow={false} lift={false} size="small" onClick={() => setShowWeekly(!showWeekly)} style={{ borderRadius: 16 }} />
                                </div>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>
                                    <div style={{ flex: "1 1 340px", minWidth: 0 }}><PlanTabs date={date} theme={theme} scope="day" /></div>
                                    {showWeekly && <div style={{ flex: "1 1 340px", minWidth: 0 }}><PlanTabs date={weekOf(date)} theme={theme} scope="week" /></div>}
                                </div>
                            </div>
                        ) : <PlanTabs date={date} theme={theme} scope={scope} />}
                    </div>
                    <div style={{ marginBottom: 28 }}><Journal date={date} theme={theme} scope={scope} weeklyCards={!v4} /></div>
                </div>
            ) : (
                <div style={{ padding: 36, textAlign: "center", color: muted, fontStyle: "italic" }}>Crie a nota para começar a monitorar.</div>
            )}

            <ViewNav theme={theme} dirs={dirs} active={navDir} onDir={setNavDir} onItem={(it) => onNavItem(it)} navRef={navRef} />
        </div>
    );
}

const DailyWrapper = gate(DailyWrapperReal);
return { DailyWrapper, Func: DailyWrapper };
