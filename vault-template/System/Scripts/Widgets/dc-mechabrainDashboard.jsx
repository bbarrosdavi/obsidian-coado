/* ==================================================================
   MECHABRAIN DASHBOARD v3 (widget mestre)
   Faixa de números sempre visível + duas abas que trocam a visão.
   Visualização: grafo de relações (3D/2D), leituras do corpus (escopo,
     confiança e frescor, autoria, ligações, crescimento), blackboard e
     navegador de memórias.
   Verificação: atividade do kernel, tendência aceitas × rejeitadas,
     última consolidação, inbox de propostas (decisão humana).

   Mecanismos (medidos em 2026-10-12):
   - Portão de visibilidade: a cópia do bloco no editor oculto não monta.
   - Arestas do grafo pelo metadataCache do Obsidian (links e embeds já
     indexados) em vez de ler o corpo de ~390 notas: 4 ms contra 172 ms, e
     sem os "links" dentro de código inline, que o Obsidian não trata como link.
   - actions.jsonl lido uma vez e compartilhado entre feed e tendência.
   - hot.md relido quando a nota muda (antes: só na abertura).
   - Uso:
       const s = await dc.require(dc.fileLink("System/Scripts/Widgets/dc-mechabrainDashboard.jsx"));
       return function View() { return s.Func(); }
   ================================================================== */

const { useTheme, deriveChartColors } = await dc.require(dc.fileLink("System/Scripts/Core/dc-themeProvider.jsx"));
const { gate } = await dc.require(dc.fileLink("System/Scripts/Core/dc-visibleGate.jsx"));
const { GloCard } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloCard.jsx"));
const { GloBadge, GloBadgeGroup } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloBadge.jsx"));
const { GloButton } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloButton.jsx"));
const { GloStat, GloStatGroup } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloStat.jsx"));
const { GloGraph } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloGraph.jsx"));
const { GloGraph3D } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloGraph3d.jsx"));
const { GloTabs } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloTabs.jsx"));
const { MemoryBrowserInline, MaintenancePanel, memoriesFrom, getValue, pathOf } = await dc.require(dc.fileLink("System/Scripts/Widgets/dc-memoryBrowser.jsx"));

const ROOT = "mecha-brain";
const HOT_PATH = `${ROOT}/hot.md`;
const LINKS_PATH = `${ROOT}/_meta/links.jsonl`;
const REPORT_PATH = `${ROOT}/_meta/index/consolidation-report.json`;
const ACTIONS_PATH = `${ROOT}/_meta/index/actions.jsonl`;
const INBOX_PATH = "System/Inbox";
const TYPES = [
    { id: "semantic", label: "Semânticas", chart: "chart-color-5" },
    { id: "episodic", label: "Episódicas", chart: "chart-color-2" },
    { id: "procedural", label: "Procedurais", chart: "chart-color-3" },
    { id: "research", label: "Research", chart: "chart-color-1" },
];
const CONF_WEIGHT = { high: 1, medium: 0.65, low: 0.35 };
const ACTION_META = {
    write_accepted: { status: "success", label: "escrita aceita" },
    write_rejected: { status: "error", label: "escrita rejeitada" },
    proposal: { status: "info", label: "proposta" },
    link: { status: "neutral", label: "link autorado" },
    decayed: { status: "warning", label: "arquivada (decay)" },
    deprecated: { status: "warning", label: "deprecada" },
};

const openNote = (ref) => app.workspace.openLinkText(String(ref), "", false);
const dim = { opacity: 0.55 };
const pad2 = (n) => String(n).padStart(2, "0");
const localDay = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
// "YYYY-MM-DD[ HH:MM]" como data LOCAL (Date.parse de data pura seria UTC).
const localTime = (s) => {
    const m = String(s || "").match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
    return m ? new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0)).getTime() : NaN;
};
// Frescor [0..1] à la Hina: decaimento exponencial pelo último acesso (ou criação), meia-vida ~14 dias.
const freshnessOf = (lastAccessed, created) => {
    const ref = localTime(lastAccessed || created);
    if (Number.isNaN(ref)) return 0;
    return Math.exp(-Math.max(0, (Date.now() - ref) / 86400000) / 14);
};
const fmtTs = (ts) => {
    const d = new Date(ts);
    return isNaN(d) ? String(ts).slice(0, 16) : `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

function palette(theme) {
    const t = deriveChartColors({ ...(theme || {}) });
    const type = {};
    for (const m of TYPES) type[m.id] = t[m.chart];
    const chart = [];
    for (let i = 1; i <= 6; i++) if (t[`chart-color-${i}`]) chart.push(t[`chart-color-${i}`]);
    if (t["color-accent"]) chart.push(t["color-accent"]);
    return {
        type, chart: chart.length ? chart : ["var(--interactive-accent)"],
        accent: t["color-accent"] || "var(--interactive-accent)",
        supersedes: t["chart-color-4"], memoryLink: t["chart-color-6"],
        faint: t["color-text-faint"] || "var(--text-faint)",
    };
}

// ── leituras de arquivo do kernel (fora do índice) ─────────────────────────
async function readText(path) {
    try { return (await app.vault.adapter.exists(path)) ? await app.vault.adapter.read(path) : null; } catch (e) { return null; }
}
const jsonLines = (text) => (text || "").split("\n").filter(l => l.trim()).map(l => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean);

/** actions.jsonl + relatório de consolidação, lidos uma vez por abertura. */
function useKernelLog() {
    const [log, setLog] = dc.useState(null);
    dc.useEffect(() => {
        let alive = true;
        (async () => {
            const actions = jsonLines(await readText(ACTIONS_PATH));
            let report = null;
            try { const t = await readText(REPORT_PATH); report = t ? JSON.parse(t) : null; } catch (e) { /* relatório inválido */ }
            if (alive) setLog({ actions, report });
        })();
        return () => { alive = false; };
    }, []);
    return log;
}

// ═══════════════════════════════════════════════════════════════════════════
// Peças de visualização
// ═══════════════════════════════════════════════════════════════════════════

function ScrollBox({ maxHeight, children }) {
    return <div style={{ maxHeight, overflowY: "auto", overflowX: "hidden", paddingRight: "2px", margin: "0 -2px" }}>{children}</div>;
}

function DistBars({ rows, emptyText = "sem dados", labelWidth = "92px" }) {
    if (!rows || !rows.length) return <p style={{ ...dim, fontSize: "0.85em" }}>{emptyText}</p>;
    const max = Math.max(1, ...rows.map(r => r.value));
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {rows.map((r, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.82em" }} title={r.title || ""}>
                    <span style={{ flex: `0 0 ${labelWidth}`, textAlign: "right", opacity: 0.75, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.label}</span>
                    <div style={{ flex: 1, height: "10px", background: "var(--background-modifier-border)", borderRadius: "5px", overflow: "hidden" }}>
                        <div style={{ width: `${(r.value / max) * 100}%`, height: "100%", background: r.color, borderRadius: "5px", transition: "width .35s ease" }} />
                    </div>
                    <span style={{ flex: "0 0 auto", opacity: 0.6, minWidth: "22px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{r.value}</span>
                </div>
            ))}
        </div>
    );
}

const Sub = ({ children }) => <div style={{ fontSize: "0.72em", opacity: 0.55, marginBottom: "5px", textTransform: "uppercase", letterSpacing: ".05em" }}>{children}</div>;
const countRows = (items, keyOf, colors) => {
    const acc = {};
    for (const m of items) { const k = keyOf(m); acc[k] = (acc[k] || 0) + 1; }
    return Object.entries(acc).sort((a, b) => b[1] - a[1]).map(([label, value], i) => ({ label, value, color: colors[i % colors.length] }));
};

function ConfidenceFreshness({ active }) {
    const c = { high: 0, medium: 0, low: 0 };
    let f = 0, a = 0, s = 0;
    for (const m of active) {
        if (c[m.confidence] !== undefined) c[m.confidence]++; else c.medium++;
        const v = freshnessOf(m.lastAccessed, m.created);
        if (v > 0.6) f++; else if (v > 0.2) a++; else s++;
    }
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div><Sub>Confiança</Sub><DistBars labelWidth="72px" rows={[
                { label: "alta", value: c.high, color: "var(--color-green)" },
                { label: "média", value: c.medium, color: "var(--color-blue)" },
                { label: "baixa", value: c.low, color: "var(--text-faint)" },
            ]} /></div>
            <div><Sub>Frescor de acesso</Sub><DistBars rows={[
                { label: "fresca", value: f, color: "var(--color-green)" },
                { label: "envelhecendo", value: a, color: "var(--color-orange)" },
                { label: "estagnada", value: s, color: "var(--color-red)" },
            ]} /></div>
        </div>
    );
}

/** Ligações do grafo autorado: isoladas, densidade, mais conectadas. */
function LinkHealth({ active, degree, realEdges, colors }) {
    const isolated = active.filter(m => !degree.get(m.id));
    const top = [...active].sort((a, b) => (degree.get(b.id) || 0) - (degree.get(a.id) || 0)).slice(0, 5).filter(m => degree.get(m.id));
    const density = active.length ? (realEdges / active.length).toFixed(2) : "0";
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <GloBadgeGroup gap="4px">
                <GloBadge variant="soft" status={isolated.length ? "warning" : "success"}>{isolated.length} isoladas</GloBadge>
                <GloBadge variant="soft" status="neutral">{realEdges} ligações</GloBadge>
                <GloBadge variant="soft" status="neutral">{density} por memória</GloBadge>
            </GloBadgeGroup>
            <div><Sub>Mais conectadas</Sub>
                <DistBars labelWidth="120px" emptyText="Nenhuma ligação autorada ainda." rows={top.map((m, i) => ({ label: m.title, title: m.id, value: degree.get(m.id), color: colors[i % colors.length] }))} />
            </div>
            {isolated.length > 0 && (
                <div style={{ fontSize: "0.8em", opacity: 0.7 }}>
                    Sem ligação: {isolated.slice(0, 6).map((m, i) => <span key={m.id}>{i ? " · " : ""}<a style={{ cursor: "pointer" }} onClick={() => openNote(m.path)}>{m.title.length > 28 ? m.title.slice(0, 27) + "…" : m.title}</a></span>)}
                    {isolated.length > 6 && <span style={dim}> e mais {isolated.length - 6}</span>}
                </div>
            )}
        </div>
    );
}

/** Memórias criadas por semana (12 semanas, incluindo a atual). */
function Growth({ memories, color }) {
    const weeks = dc.useMemo(() => {
        const now = new Date(); now.setHours(0, 0, 0, 0);
        const monday = new Date(now); monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
        const out = Array.from({ length: 12 }, (_, i) => { const d = new Date(monday); d.setDate(monday.getDate() - (11 - i) * 7); return { start: d.getTime(), label: `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`, n: 0 }; });
        for (const m of memories) {
            const t = localTime(m.created);
            if (Number.isNaN(t)) continue;
            for (let i = out.length - 1; i >= 0; i--) if (t >= out[i].start) { if (i < out.length - 1 || t < out[i].start + 7 * 86400000) out[i].n++; break; }
        }
        return out;
    }, [memories]);
    const max = Math.max(1, ...weeks.map(w => w.n));
    const total = weeks.reduce((s, w) => s + w.n, 0);
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <GloBadgeGroup gap="4px">
                <GloBadge variant="soft" status="neutral">{total} em 12 semanas</GloBadge>
                <GloBadge variant="soft" status="primary">{weeks[11].n} nesta semana</GloBadge>
            </GloBadgeGroup>
            <div style={{ display: "flex", alignItems: "flex-end", gap: "3px", height: "72px" }}>
                {weeks.map((w, i) => (
                    <div key={i} title={`semana de ${w.label}: ${w.n}`} style={{ flex: 1, height: `${Math.max(2, (w.n / max) * 100)}%`, background: color, opacity: w.n ? (i === 11 ? 1 : 0.7) : 0.15, borderRadius: "2px 2px 0 0" }} />
                ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7em", ...dim }}><span>{weeks[0].label}</span><span>esta semana</span></div>
        </div>
    );
}

function ActivityFeed({ log }) {
    if (log === null) return <p style={dim}>Lendo o log de ações…</p>;
    const events = [...log.actions];
    for (const d of log.report?.decayed || []) events.push({ ts: log.report.generated, action: "decayed", id: String(d.note || "").replace(/^\[\[|\]\]$/g, "") });
    for (const d of log.report?.deprecated || []) events.push({ ts: log.report.generated, action: "deprecated", id: String(d.note || "").replace(/^\[\[|\]\]$/g, "") });
    events.sort((a, b) => String(b.ts).localeCompare(String(a.ts)));
    const accepted = log.actions.filter(e => e.action === "write_accepted").length;
    const rejected = log.actions.filter(e => e.action === "write_rejected").length;
    if (!events.length) return <p style={dim}>Nenhuma ação registrada ainda — o log (<code>actions.jsonl</code>) começa a preencher na próxima escrita/proposta/link via MCP.</p>;
    const L = (id) => <a style={{ cursor: "pointer" }} onClick={() => openNote(id)}>{id}</a>;
    const describe = (e) => {
        switch (e.action) {
            case "write_accepted": {
                const promo = e.type === "semantic" ? "promovida a Semantic/" : e.type ? `gravada em ${e.type}` : "gravada";
                const sup = (e.superseded || []).length ? ` · substituiu ${e.superseded.length}` : "";
                return <span>{L(e.id)}<span style={{ opacity: 0.6 }}> — {promo}{sup}</span></span>;
            }
            case "write_rejected": return <span><strong>{e.title || "(sem título)"}</strong><span style={{ opacity: 0.6 }}> — {e.reason || "rejeitada pelo gate"}</span></span>;
            case "proposal": return <span>proposta {L(e.id)}<span style={{ opacity: 0.6 }}> → alvo {e.target}</span></span>;
            case "link": return <span>{L(e.a)}<span style={{ opacity: 0.6 }}> ⟷ </span>{L(e.b)}<span style={{ opacity: 0.6 }}> ({e.relation || "related"})</span></span>;
            case "decayed": case "deprecated": return <span>{L(e.id)}<span style={{ opacity: 0.6 }}> — pelo consolidador</span></span>;
            default: return <span>{e.action}</span>;
        }
    };
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <GloBadgeGroup>
                <GloBadge variant="soft" status="success">{accepted} aceitas</GloBadge>
                <GloBadge variant="soft" status={rejected ? "error" : "neutral"}>{rejected} rejeitadas</GloBadge>
            </GloBadgeGroup>
            <div>
                {events.slice(0, 25).map((e, i) => {
                    const meta = ACTION_META[e.action] || { status: "neutral", label: e.action };
                    return (
                        <div key={i} style={{ display: "flex", alignItems: "baseline", gap: "8px", padding: "4px 0", borderBottom: "1px solid var(--background-modifier-border)", fontSize: "0.85em" }}>
                            <GloBadge size="small" variant="soft" status={meta.status}>{meta.label}</GloBadge>
                            <span style={{ flex: 1, minWidth: 0 }}>{describe(e)}</span>
                            {e.agent && <GloBadge size="small" variant="outlined" status="neutral">{e.agent}</GloBadge>}
                            <span style={{ fontSize: "0.85em", opacity: 0.45, whiteSpace: "nowrap" }}>{fmtTs(e.ts)}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function AcceptRejectTrend({ log }) {
    if (log === null) return <p style={dim}>Lendo o log…</p>;
    const buckets = new Map();
    for (const e of log.actions) {
        if (e.action !== "write_accepted" && e.action !== "write_rejected") continue;
        const day = String(e.ts || "").slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
        const b = buckets.get(day) || { a: 0, r: 0 };
        if (e.action === "write_accepted") b.a++; else b.r++;
        buckets.set(day, b);
    }
    const days = [...buckets.entries()].sort((x, y) => x[0].localeCompare(y[0])).slice(-14).map(([day, b]) => ({ day, ...b }));
    if (!days.length) return <p style={{ ...dim, fontSize: "0.85em" }}>Sem escritas registradas ainda — a série começa a preencher na primeira escrita/rejeição pelo gate (<code>actions.jsonl</code>).</p>;
    const max = Math.max(1, ...days.map(d => d.a + d.r));
    const totalA = days.reduce((s, d) => s + d.a, 0), totalR = days.reduce((s, d) => s + d.r, 0);
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <GloBadgeGroup>
                <GloBadge variant="soft" status="success">{totalA} aceitas</GloBadge>
                <GloBadge variant="soft" status={totalR ? "error" : "neutral"}>{totalR} rejeitadas</GloBadge>
                <GloBadge variant="soft" status="neutral">{days.length} {days.length === 1 ? "dia" : "dias"}</GloBadge>
            </GloBadgeGroup>
            <div style={{ display: "flex", alignItems: "flex-end", gap: "3px", height: "88px" }}>
                {days.map((d, i) => (
                    <div key={i} title={`${d.day}: ${d.a} aceitas, ${d.r} rejeitadas`} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%", minWidth: 0 }}>
                        <div style={{ height: `${(d.r / max) * 100}%`, background: "var(--color-red)", borderRadius: "2px 2px 0 0", opacity: 0.85 }} />
                        <div style={{ height: `${(d.a / max) * 100}%`, background: "var(--color-green)", borderRadius: d.r ? "0" : "2px 2px 0 0" }} />
                    </div>
                ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7em", ...dim }}><span>{days[0].day.slice(5)}</span><span>hoje</span></div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// Grafo: núcleo → hubs por tipo → memórias + arestas autoradas
// ═══════════════════════════════════════════════════════════════════════════

/** Links do corpo pelo metadataCache (mesmo critério da regex antiga: só [[...]], sem #subcaminho). */
function bodyLinks(path) {
    const f = app.vault.getAbstractFileByPath(path);
    const fc = f && app.metadataCache.getFileCache(f);
    if (!fc) return [];
    const out = [];
    for (const l of [...(fc.links || []), ...(fc.embeds || [])]) {
        if (!/^!?\[\[/.test(l.original || "")) continue;
        const t = String(l.link || "").split("#")[0].trim();
        if (t) out.push(t);
    }
    return out;
}

function buildGraph(memories, linksJsonl, pal) {
    const known = new Map(memories.map(m => [m.id, m]));
    const edges = [], seen = new Set(), ghostRefs = new Map();
    const ghost = (id) => { if (!known.has(id)) ghostRefs.set(id, (ghostRefs.get(id) || 0) + 1); };
    const add = (from, to, style, opts = {}) => { const k = `${from}→${to}#${style}`; if (from === to || seen.has(k)) return; seen.add(k); edges.push({ from, to, style, ...opts }); };
    for (const m of memories) {
        for (const t of bodyLinks(m.path)) { ghost(t); add(m.id, t, "solid"); }
        for (const t of m.supersedes) { ghost(t); add(m.id, t, "dashed", { directed: true, label: "supersedes", color: pal.supersedes }); }
    }
    for (const e of linksJsonl) {
        const a = String(e.a || e.source || ""), b = String(e.b || e.target || "");
        if (!a || !b) continue;
        ghost(a); ghost(b);
        add(a, b, "dotted", { label: e.relation || "related", color: pal.memoryLink });
    }
    const CORE = "__core__", hubs = [], structural = [];
    for (const t of TYPES) {
        const members = memories.filter(m => m.type.id === t.id);
        if (!members.length) continue;
        const hubId = `__hub_${t.id}__`;
        hubs.push({ id: hubId, label: `${t.label} (${members.length})`, color: pal.type[t.id], size: 10.5, pin: "hub" });
        structural.push({ from: CORE, to: hubId, rest: 60 });
        for (const m of members) structural.push({ from: hubId, to: m.id, rest: 55 });
    }
    const ghosts = [...ghostRefs.entries()].sort((a, b) => b[1] - a[1]).slice(0, Math.max(0, 70 - memories.length))
        .map(([gid]) => ({ id: gid, label: gid, ghost: true, size: 5 }));
    const nodes = [
        { id: CORE, label: "mecha-brain", color: pal.accent, size: 15, pin: "core" },
        ...hubs,
        ...memories.map(m => {
            const c = CONF_WEIGHT[m.confidence] ?? 0.65;
            return { id: m.id, label: m.title, color: pal.type[m.type.id], size: 5.5 + c * 3.5, opacity: (0.35 + c * 0.6) * (m.status === "ativo" ? 1 : 0.45), ring: freshnessOf(m.lastAccessed, m.created) };
        }),
        ...ghosts,
    ];
    const nodeSet = new Set(nodes.map(n => n.id));
    const real = edges.filter(e => nodeSet.has(e.from) && nodeSet.has(e.to));
    // grau por memória (só arestas autoradas, sem as estruturais)
    const degree = new Map();
    for (const e of real) { degree.set(e.from, (degree.get(e.from) || 0) + 1); degree.set(e.to, (degree.get(e.to) || 0) + 1); }
    return { nodes, edges: [...structural, ...real], degree, realEdges: real.length };
}

// ═══════════════════════════════════════════════════════════════════════════
// Dashboard
// ═══════════════════════════════════════════════════════════════════════════

function MechabrainDashboardReal() {
    const pages = dc.useQuery('@page and path("mecha-brain")');
    const inboxPages = dc.useQuery('@page and path("System/Inbox")');
    const { theme } = useTheme();
    const pal = dc.useMemo(() => palette(theme), [theme]);
    const memories = dc.useMemo(() => memoriesFrom(pages), [pages]);
    const active = dc.useMemo(() => memories.filter(m => m.status === "ativo"), [memories]);
    const memKey = memories.map(m => m.id).join("|");
    const log = useKernelLog();

    // memory_link (links.jsonl), relido quando o conjunto de memórias muda
    const [linksJsonl, setLinksJsonl] = dc.useState([]);
    dc.useEffect(() => {
        let alive = true;
        readText(LINKS_PATH).then(t => { if (alive) setLinksJsonl(jsonLines(t)); });
        return () => { alive = false; };
    }, [memKey]);

    // Grafo: recalcula com as páginas (links e frontmatter) e o links.jsonl.
    // O layout é cacheado pela assinatura do conjunto no GloGraph3D.
    const graph = dc.useMemo(() => buildGraph(memories, linksJsonl, pal), [pages, linksJsonl, pal]);

    // Blackboard (hot.md): relido quando a nota muda
    const hotPage = pages.find(p => pathOf(p) === HOT_PATH);
    const hotStamp = hotPage ? (hotPage.$mtime?.toMillis?.() ?? hotPage.$revision ?? 1) : 0;
    const [hot, setHot] = dc.useState(null);
    dc.useEffect(() => {
        let alive = true;
        readText(HOT_PATH).then(text => {
            if (!alive) return;
            const sections = []; let cur = null;
            for (const line of (text || "").split("\n")) {
                const h = line.match(/^##\s+(.+)$/);
                if (h) { cur = { scope: h[1].trim(), items: [] }; sections.push(cur); continue; }
                const it = line.match(/^-\s+\[\[([^\]|#]+)\]\]\s*—?\s*(.*)$/);
                if (it && cur) cur.items.push({ id: it[1].trim(), rest: it[2] });
                else if (/^-\s+_…/.test(line) && cur) cur.items.push({ id: null, rest: line.replace(/^-\s+/, "") });
            }
            setHot(sections.filter(s => s.items.length));
        });
        return () => { alive = false; };
    }, [hotStamp]);

    // Propostas no inbox
    const proposals = dc.useMemo(() => {
        const out = [];
        for (const p of inboxPages) {
            const path = pathOf(p);
            if (!path.startsWith(INBOX_PATH + "/")) continue;
            const target = getValue(p, "target");
            if (!target) continue;
            out.push({
                path, id: path.split("/").pop().replace(/\.md$/, ""),
                title: String(getValue(p, "title") || path.split("/").pop()),
                target: String(target), agent: String(getValue(p, "agent") || ""),
                status: String(getValue(p, "status") || "ativo").trim(),
                created: String(getValue(p, "created") || "").slice(0, 10),
            });
        }
        return out.sort((a, b) => b.created.localeCompare(a.created));
    }, [inboxPages]);
    const pending = proposals.filter(p => p.status === "ativo");
    const decided = proposals.length - pending.length;

    const decide = async (p, verdict) => {
        const file = app.vault.getAbstractFileByPath(p.path);
        if (!file) { new Notice("Proposta não encontrada no disco."); return; }
        if (verdict === "aceita") {
            try {
                const change = (await app.vault.read(file)).split(/^## Mudança proposta\s*$/m)[1];
                if (change && navigator.clipboard) await navigator.clipboard.writeText(change.trim());
            } catch (e) { /* clipboard é conveniência */ }
        }
        await app.fileManager.processFrontMatter(file, fm => { fm.status = verdict; fm.decidida = localDay(new Date()); });
        if (verdict === "aceita") { new Notice("Proposta aceita — mudança copiada p/ o clipboard. Aplique na nota alvo."); openNote(p.target); }
        else new Notice("Proposta rejeitada.");
    };

    const reportAge = log?.report?.generated ? Math.floor((Date.now() - new Date(log.report.generated).getTime()) / 86400000) : null;
    const [graphMode, setGraphMode] = dc.useState("3d");
    const [tab, setTab] = dc.useState("view");
    const graphH = Math.round(Math.min(440, Math.max(300, (window.innerHeight || 900) * 0.4)));

    // Ctrl+hover no grafo → preview nativo da nota
    const HOVER_SRC = "mechabrain-graph";
    const hoverParent = dc.useRef({ hoverPopover: null });
    const lastPreview = dc.useRef(null);
    dc.useEffect(() => {
        try { app.workspace.registerHoverLinkSource?.(HOVER_SRC, { display: "Mecha-Brain — grafo", defaultMod: true }); } catch (e) { /* API ausente */ }
        return () => { try { app.workspace.unregisterHoverLinkSource?.(HOVER_SRC); } catch (e) { /* idem */ } };
    }, []);
    const byId = dc.useMemo(() => new Map(memories.map(m => [m.id, m])), [memories]);
    const onNodeHover = (id, ev) => {
        if (id == null || !(ev.ctrlKey || ev.metaKey)) { lastPreview.current = null; return; }
        if (lastPreview.current === id) return;
        let linktext = byId.get(id)?.path || null;
        if (!linktext) {
            if (id.startsWith("__")) return;
            const dest = app.metadataCache?.getFirstLinkpathDest?.(id, "");
            if (!dest) return;
            linktext = dest.path;
        }
        lastPreview.current = id;
        app.workspace.trigger("hover-link", { event: ev.nativeEvent || ev, source: HOVER_SRC, hoverParent: hoverParent.current, targetEl: ev.currentTarget, linktext, sourcePath: "" });
    };

    const count = (id) => active.filter(m => m.type.id === id).length;
    const cardHead = { padding: "8px 14px 2px" };
    const graphProps = {
        nodes: graph.nodes, edges: graph.edges, height: graphH, onNodeHover,
        onNodeClick: (id) => openNote(byId.get(id)?.path || id),
        legend: [
            ...TYPES.map(t => ({ color: pal.type[t.id], label: t.label })),
            { color: pal.faint, label: "fora do mecha-brain" },
            { style: "solid", color: pal.accent, label: "wikilink" },
            { style: "dashed", color: pal.supersedes, label: "supersedes" },
            { style: "dotted", color: pal.memoryLink, label: "memory_link" },
        ],
        emptyText: "Sem memórias para grafar ainda.",
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <GloStatGroup min="120px">
                <GloStat value={active.length} label="Memórias ativas" />
                {TYPES.map(t => <GloStat key={t.id} value={count(t.id)} label={t.label} color={pal.type[t.id]} />)}
                <GloStat value={pending.length} label="Propostas pendentes" status={pending.length ? "warning" : "success"} sub={decided ? `${decided} decididas` : null} />
                <GloStat value={reportAge === null ? "—" : reportAge === 0 ? "hoje" : `${reportAge}d`} label="Última consolidação"
                    status={reportAge === null ? "neutral" : reportAge > 2 ? "warning" : "success"} />
            </GloStatGroup>

            <GloTabs variant="pills" activeTab={tab} onChange={setTab} renderContent={false}
                tabs={[{ id: "view", label: "Visualização" }, { id: "check", label: pending.length ? `Verificação (${pending.length})` : "Verificação" }]} />

            {/* Aba Visualização: sempre montada (display:none fora dela) para não refazer leituras */}
            <div style={{ display: tab === "view" ? "flex" : "none", flexDirection: "column", gap: "14px" }}>
                <GloCard variant="glass" size="small" headerStyle={cardHead}
                    title="Grafo de relações" subtitle="wikilinks · supersedes · memory_link · Ctrl+hover = preview da nota"
                    actions={
                        <div style={{ display: "flex", gap: "4px" }}>
                            <GloButton size="small" variant="liquid-glass" active={graphMode === "3d"} glow={false} lift={false} press label="3D" onClick={() => setGraphMode("3d")} />
                            <GloButton size="small" variant="liquid-glass" active={graphMode === "2d"} glow={false} lift={false} press label="2D" onClick={() => setGraphMode("2d")} />
                        </div>
                    }>
                    {graphMode === "3d" ? <GloGraph3D {...graphProps} /> : <GloGraph {...graphProps} />}
                </GloCard>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "14px", alignItems: "start" }}>
                    <GloCard variant="glass" size="small" headerStyle={cardHead} title="Distribuição por escopo" subtitle="memórias ativas por projeto">
                        <DistBars rows={countRows(active, m => m.scope, pal.chart)} emptyText="Nenhuma memória ativa para distribuir." />
                    </GloCard>
                    <GloCard variant="glass" size="small" headerStyle={cardHead} title="Confiança & frescor" subtitle="qualidade e esquecimento do corpus">
                        <ConfidenceFreshness active={active} />
                    </GloCard>
                    <GloCard variant="glass" size="small" headerStyle={cardHead} title="Contribuição por agente" subtitle="autoria multi-agente">
                        <DistBars rows={countRows(active, m => m.agent || "sem autor", pal.chart)} emptyText="Sem autoria registrada ainda." />
                    </GloCard>
                    <GloCard variant="glass" size="small" headerStyle={cardHead} title="Ligações" subtitle="grafo autorado: o que a busca expande">
                        <LinkHealth active={active} degree={graph.degree} realEdges={graph.realEdges} colors={pal.chart} />
                    </GloCard>
                    <GloCard variant="glass" size="small" headerStyle={cardHead} title="Crescimento" subtitle="memórias criadas por semana">
                        <Growth memories={memories} color={pal.accent} />
                    </GloCard>
                    <GloCard variant="glass" size="small" headerStyle={cardHead} title="Blackboard (hot.md)" subtitle="foco atual por escopo — escrito pelo consolidador">
                        <ScrollBox maxHeight="300px">
                            {hot === null ? <p style={dim}>Lendo…</p>
                                : hot.length === 0 ? <p style={dim}>Nenhum escopo ativo ainda — a primeira consolidação depois da primeira escrita preenche o blackboard.</p>
                                : hot.map(sec => (
                                    <div key={sec.scope} style={{ marginBottom: "10px" }}>
                                        <GloBadge variant="soft" status="primary" size="small">{sec.scope}</GloBadge>
                                        <div style={{ marginTop: "4px" }}>
                                            {sec.items.map((it, i) => it.id ? (
                                                <div key={i} style={{ fontSize: "0.85em", padding: "2px 0" }}>
                                                    <a style={{ cursor: "pointer" }} onClick={() => openNote(it.id)}>{it.id}</a>
                                                    {it.rest && <span style={dim}> — {it.rest}</span>}
                                                </div>
                                            ) : <div key={i} style={{ fontSize: "0.8em", opacity: 0.5 }}>{it.rest}</div>)}
                                        </div>
                                    </div>
                                ))}
                        </ScrollBox>
                    </GloCard>
                </div>

                <MemoryBrowserInline showMaintenance={false} maxHeight="520px" memories={memories} />
            </div>

            {/* Aba Verificação */}
            <div style={{ display: tab === "check" ? "flex" : "none", flexDirection: "column", gap: "14px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "14px", alignItems: "start" }}>
                    <GloCard size="small" headerStyle={cardHead} variant="glass" title="Atividade do kernel" subtitle="aceitas · rejeitadas · promoções · propostas · links">
                        <ScrollBox maxHeight="380px"><ActivityFeed log={log} /></ScrollBox>
                    </GloCard>
                    <GloCard size="small" headerStyle={cardHead} variant="glass" title="Tendência aceitas × rejeitadas" subtitle="saúde do gate por dia (últimos 14)">
                        <AcceptRejectTrend log={log} />
                    </GloCard>
                    <GloCard size="small" headerStyle={cardHead} variant="glass" title="Última consolidação" subtitle="o que o kernel detectou e reportou para você decidir">
                        <ScrollBox maxHeight="380px"><MaintenancePanel /></ScrollBox>
                    </GloCard>
                    <GloCard size="small" headerStyle={cardHead} variant="glass" title="Inbox de propostas" subtitle="mudanças fora do sandbox — a decisão é sua">
                        <ScrollBox maxHeight="380px">
                            {pending.length === 0 ? <p style={dim}>Nada pendente{decided ? ` (${decided} já decididas)` : ""}.</p>
                                : pending.map(p => (
                                    <div key={p.path} style={{ borderBottom: "1px solid var(--background-modifier-border)", padding: "8px 0" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                                            <a style={{ cursor: "pointer", fontWeight: 500, flex: "1 1 auto" }} onClick={() => openNote(p.path)}>{p.title}</a>
                                            <GloBadgeGroup gap="4px">
                                                {p.agent && <GloBadge size="small" variant="outlined" status="neutral">{p.agent}</GloBadge>}
                                                <GloBadge size="small" variant="soft" status="info">{p.created}</GloBadge>
                                            </GloBadgeGroup>
                                        </div>
                                        <div style={{ fontSize: "0.8em", opacity: 0.6, margin: "3px 0 6px" }}>alvo: <a style={{ cursor: "pointer" }} onClick={() => openNote(p.target)}>{p.target}</a></div>
                                        <div style={{ display: "flex", gap: "8px" }}>
                                            <GloButton size="small" label="Aceitar" onClick={() => decide(p, "aceita")} />
                                            <GloButton size="small" variant="ghost" label="Rejeitar" onClick={() => decide(p, "rejeitada")} />
                                        </div>
                                    </div>
                                ))}
                        </ScrollBox>
                    </GloCard>
                </div>
            </div>
        </div>
    );
}

const MechabrainDashboard = gate(MechabrainDashboardReal);

return { Func: MechabrainDashboard, MechabrainDashboard };
