/* ==================================================================
   MEMORY BROWSER (Mecha-Brain) v3
   - Navega as memórias de `mecha-brain/` (Semantic/, Episodic/,
     Procedural/, Research/) com filtros por tipo, escopo, status e busca.
   - Cards com excerto do corpo (estilo Mnemosyne). Excertos lidos pelo
     cache do Obsidian (cachedRead), sob demanda, e guardados por caminho +
     data de modificação na janela: reabrir não relê nada.
   - Recebe `memories` pronto do dashboard (sem segunda query); sozinho,
     consulta por conta própria.
   - MaintenancePanel: relatório da última consolidação.
   - Uso:
       const s = await dc.require(dc.fileLink("System/Scripts/Widgets/dc-memoryBrowser.jsx"));
       return function View() { return s.Func(); }
   ================================================================== */

const { useTheme, deriveChartColors } = await dc.require(dc.fileLink("System/Scripts/Core/dc-themeProvider.jsx"));
const { gate } = await dc.require(dc.fileLink("System/Scripts/Core/dc-visibleGate.jsx"));
const { GloCard } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloCard.jsx"));
const { GloBadge, GloBadgeGroup } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloBadge.jsx"));
const { GloInput } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloInput.jsx"));
const { GloButton } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloButton.jsx"));

const ROOT = "mecha-brain";
const REPORT_PATH = `${ROOT}/_meta/index/consolidation-report.json`;
const PAGE_SIZE = 30;
const EXCERPT_CHARS = 220;
const TYPE_BY_FOLDER = {
    Semantic: { id: "semantic", label: "Semânticas", chart: "chart-color-5" },
    Episodic: { id: "episodic", label: "Episódicas", chart: "chart-color-2" },
    Procedural: { id: "procedural", label: "Procedurais", chart: "chart-color-3" },
    Research: { id: "research", label: "Research", chart: "chart-color-1" },
};
const CONFIDENCE_STATUS = { high: "success", medium: "info", low: "neutral" };
const NOTE_STATUS = { ativo: null, arquivado: { status: "warning", label: "arquivado" }, deprecado: { status: "error", label: "deprecado" } };

const typeColorsFrom = (theme) => {
    const t = deriveChartColors({ ...(theme || {}) });
    const out = {};
    for (const meta of Object.values(TYPE_BY_FOLDER)) out[meta.id] = t[meta.chart];
    return out;
};

const excerptOf = (raw) => {
    const text = raw.replace(/^---\n[\s\S]*?\n---\n?/, "")
        .replace(/```[\s\S]*?```/g, " ")
        .replace(/^#+\s+.*$/gm, " ")
        .replace(/^>\s?\[![^\]]*\][+-]?\s?/gm, "")
        .replace(/^>\s?/gm, "")
        .replace(/!\[\[[^\]]*\]\]/g, " ")
        .replace(/\[\[([^\]|#]+)(?:[^\]]*)?\]\]/g, "$1")
        .replace(/[*_`]/g, "")
        .replace(/\s+/g, " ")
        .trim();
    return text.length > EXCERPT_CHARS ? text.slice(0, EXCERPT_CHARS - 1).trimEnd() + "…" : text;
};
// Excertos na janela: caminho -> { mtime, text }. Vale para todas as aberturas da sessão.
const EXCERPTS = (window.__dcMemExcerpts = window.__dcMemExcerpts || new Map());

const getValue = (p, key) => {
    if (typeof p.value === "function") { const v = p.value(key); if (v !== undefined && v !== null) return v; }
    if (p[key] !== undefined) return p[key];
    if (p.$frontmatter && p.$frontmatter[key] !== undefined) { const f = p.$frontmatter[key]; return f && f.value !== undefined ? f.value : f; }
    if (p.frontmatter && p.frontmatter[key] !== undefined) return p.frontmatter[key];
    return null;
};
const pathOf = (p) => p.$path || p.file?.path || p.path || "";
const fmtStamp = (s) => {
    const m = String(s).match(/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}))?/);
    if (!m) return String(s).slice(0, 10);
    return m[2] && m[2] !== "00:00" ? `${m[1]} ${m[2]}` : m[1];
};
const toDateStr = (val) => {
    if (!val) return "";
    if (typeof val === "string") return fmtStamp(val);
    if (typeof val.toFormat === "function") return fmtStamp(val.toFormat("yyyy-MM-dd HH:mm"));
    if (typeof val.toISOString === "function") return fmtStamp(val.toISOString());
    return fmtStamp(String(val));
};
const memoryTypeOf = (path) => {
    const m = path.match(/^mecha-brain\/(Semantic|Episodic|Procedural|Research)\//);
    return m ? TYPE_BY_FOLDER[m[1]] : null;
};

/** Memórias normalizadas a partir das páginas do datacore (compartilhado com o dashboard). */
function memoriesFrom(pages) {
    const out = [];
    for (const p of pages || []) {
        const path = pathOf(p), type = memoryTypeOf(path);
        if (!type) continue;
        const conf = String(getValue(p, "confidence") || "").trim().toLowerCase();
        out.push({
            path,
            id: path.split("/").pop().replace(/\.md$/, ""),
            title: String(getValue(p, "title") || path.split("/").pop().replace(/\.md$/, "")),
            type,
            scope: String(getValue(p, "scope") || "global").trim(),
            agent: String(getValue(p, "agent") || "").trim(),
            confidence: conf,
            status: String(getValue(p, "status") || "ativo").trim(),
            created: toDateStr(getValue(p, "created")),
            lastAccessed: toDateStr(getValue(p, "last_accessed")),
            lastTested: toDateStr(getValue(p, "last_tested")),
            supersedes: idsFrom(getValue(p, "supersedes")),
        });
    }
    out.sort((a, b) => (b.created || "").localeCompare(a.created || "") || a.id.localeCompare(b.id));
    return out;
}
function idsFrom(raw) {
    const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
    return list.flatMap((v) => {
        const s = String(v);
        const m = [...s.matchAll(/\[\[([^\]|#]+)/g)].map((x) => x[1].trim());
        return m.length ? m : s.trim() ? [s.trim()] : [];
    });
}

const open = (path) => app.workspace.openLinkText(path, "", false);
const dimStyle = { fontSize: "0.78em", opacity: 0.55 };

function MaintenancePanel() {
    const [report, setReport] = dc.useState(undefined);
    dc.useEffect(() => {
        let alive = true;
        (async () => {
            try { const ok = await app.vault.adapter.exists(REPORT_PATH); const r = ok ? JSON.parse(await app.vault.adapter.read(REPORT_PATH)) : null; if (alive) setReport(r); }
            catch (e) { if (alive) setReport(null); }
        })();
        return () => { alive = false; };
    }, []);
    const wl = (raw) => String(raw || "").replace(/^\[\[|\]\]$/g, "");
    const noteLink = (raw) => <a style={{ cursor: "pointer" }} onClick={() => open(`${ROOT}/${wl(raw)}`)}>{wl(raw)}</a>;
    if (report === undefined) return <span style={dimStyle}>Lendo relatório…</span>;
    if (report === null) return <span style={dimStyle}>Sem relatório de consolidação nesta máquina — rode <code>mechabrain consolidate</code> (o timer diário também o gera).</span>;
    const section = (title, list, render) => list?.length ? (
        <div><strong style={{ fontSize: "0.85em" }}>{title}</strong>{list.map((x, i) => <div key={i} style={{ fontSize: "0.85em", marginLeft: "12px" }}>{render(x)}</div>)}</div>
    ) : null;
    const empty = !(report.merge_candidates || []).length && !(report.stale_procedurals || []).length && !(report.cross_scope_similar || []).length && !(report.docs_citing_dead || []).length;
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <GloBadgeGroup>
                <GloBadge variant="soft" status="info">{toDateStr(report.generated)}</GloBadge>
                <GloBadge variant="soft" status="neutral">{report.counts?.notes_scanned ?? 0} notas · {report.counts?.readonly_scanned ?? 0} read-only</GloBadge>
                <GloBadge variant="soft" status={report.counts?.decayed ? "warning" : "neutral"}>{report.counts?.decayed ?? 0} arquivadas</GloBadge>
                <GloBadge variant="soft" status={report.counts?.deprecated ? "warning" : "neutral"}>{report.counts?.deprecated ?? 0} deprecadas</GloBadge>
            </GloBadgeGroup>
            {section("Candidatas a fusão (mesmo escopo):", report.merge_candidates, c => <span>{noteLink(c.a)} ~ {noteLink(c.b)} <span style={dimStyle}>({c.similarity}, {c.scope_a})</span></span>)}
            {section("Procedurais sem reteste:", report.stale_procedurals, s => <span>{noteLink(s.note)} <span style={dimStyle}>({s.days_stale} dias, {s.scope})</span></span>)}
            {section("Similares cross-scope (nunca fundidas):", report.cross_scope_similar, c => <span>{noteLink(c.a)} ~ {noteLink(c.b)} <span style={dimStyle}>({c.scope_a} × {c.scope_b})</span></span>)}
            {section("Docs citando memórias mortas (propor edição):", report.docs_citing_dead, d => <span>{noteLink(d.doc)} cita {noteLink(d.cites)} <span style={dimStyle}>({d.status}{d.successor ? " → " : ""})</span>{d.successor ? noteLink(d.successor) : null}</span>)}
            {empty && <span style={dimStyle}>Nada pendente de decisão — sem duplicatas, sem PROC stale.</span>}
        </div>
    );
}

/** Excertos dos caminhos pedidos: lê só o que falta ou mudou (mtime). */
function useExcerpts(paths) {
    const [, bump] = dc.useState(0);
    const key = paths.join("|");
    dc.useEffect(() => {
        let alive = true;
        (async () => {
            let changed = false;
            for (const path of paths) {
                const f = app.vault.getAbstractFileByPath(path);
                if (!f) continue;
                const hit = EXCERPTS.get(path);
                if (hit && hit.mtime === f.stat.mtime) continue;
                try { EXCERPTS.set(path, { mtime: f.stat.mtime, text: excerptOf(await app.vault.cachedRead(f)) }); }
                catch (e) { EXCERPTS.set(path, { mtime: f.stat.mtime, text: "" }); }
                changed = true;
            }
            if (alive && changed) bump(v => v + 1);
        })();
        return () => { alive = false; };
    }, [key]);
    return (path) => EXCERPTS.get(path)?.text;
}

function MemoryBrowserReal({ showMaintenance = true, maxHeight = null, memories: given = null } = {}) {
    const pages = dc.useQuery('@page and path("mecha-brain")');   // incondicional (ordem dos hooks); barata
    const own = dc.useMemo(() => given ? null : memoriesFrom(pages), [pages, given]);
    const memories = given || own;
    const { theme } = useTheme();
    const typeColor = dc.useMemo(() => typeColorsFrom(theme), [theme]);
    const [typeFilter, setTypeFilter] = dc.useState("all");
    const [statusFilter, setStatusFilter] = dc.useState("ativo");
    const [scopeFilter, setScopeFilter] = dc.useState("all");
    const [search, setSearch] = dc.useState("");
    const [limit, setLimit] = dc.useState(PAGE_SIZE);

    const scopes = dc.useMemo(() => [...new Set(memories.map(m => m.scope))].sort(), [memories]);
    const activeByType = dc.useMemo(() => {
        const c = { all: 0 };
        for (const m of memories) if (m.status === "ativo") { c.all++; c[m.type.id] = (c[m.type.id] || 0) + 1; }
        return c;
    }, [memories]);
    const filtered = dc.useMemo(() => {
        const q = search.trim().toLowerCase();
        return memories.filter(m => {
            if (typeFilter !== "all" && m.type.id !== typeFilter) return false;
            if (statusFilter !== "todas" && m.status !== statusFilter) return false;
            if (scopeFilter !== "all" && m.scope !== scopeFilter) return false;
            if (q && !`${m.title} ${m.id} ${m.agent} ${m.scope}`.toLowerCase().includes(q)) return false;
            return true;
        });
    }, [memories, typeFilter, statusFilter, scopeFilter, search]);
    const visible = filtered.slice(0, limit);
    const excerpt = useExcerpts(visible.map(m => m.path));

    if (memories.length === 0) {
        return (
            <GloCard variant="glass" title="Memórias do Mecha-Brain">
                <p style={{ opacity: 0.6 }}>Nenhuma memória em <code>{ROOT}/</code> ainda. Os agentes escrevem via <code>memory_write</code>.</p>
            </GloCard>
        );
    }
    const pick = (setter) => (v) => { setter(v); setLimit(PAGE_SIZE); };

    return (
        <GloCard variant="glass" size="small" headerStyle={{ padding: "8px 14px 2px" }}
            title="Memórias do Mecha-Brain" subtitle={`${memories.length} notas · ${filtered.length} no filtro`}>
            <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                {[{ id: "all", label: `Todas (${activeByType.all})` }, ...Object.values(TYPE_BY_FOLDER).map(t => ({ id: t.id, label: `${t.label} (${activeByType[t.id] || 0})` }))].map(tab => (
                    <GloButton key={tab.id} size="small" variant="liquid-glass" active={typeFilter === tab.id} glow={false} lift={false} press label={tab.label} onClick={() => pick(setTypeFilter)(tab.id)} />
                ))}
            </div>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center", margin: "8px 0 12px" }}>
                <GloBadgeGroup>
                    <GloBadge variant={scopeFilter === "all" ? "filled" : "soft"} status="primary" clickable onClick={() => setScopeFilter("all")}>todos escopos</GloBadge>
                    {scopes.map(s => (
                        <GloBadge key={s} clickable status="primary" variant={scopeFilter === s ? "filled" : "soft"} onClick={() => setScopeFilter(scopeFilter === s ? "all" : s)}>{s}</GloBadge>
                    ))}
                </GloBadgeGroup>
                <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                    {[{ id: "ativo", label: "ativas" }, { id: "arquivado", label: "arquivadas" }, { id: "deprecado", label: "deprecadas" }, { id: "todas", label: "todas" }].map(tab => (
                        <GloButton key={tab.id} size="small" variant="liquid-glass" active={statusFilter === tab.id} glow={false} lift={false} press label={tab.label} onClick={() => pick(setStatusFilter)(tab.id)} />
                    ))}
                </div>
                <GloInput placeholder="Buscar título, id, agente…" clearable size="small" width="240px" debounce={200}
                    onChange={(v) => { setSearch(v ?? ""); setLimit(PAGE_SIZE); }} onClear={() => setSearch("")} />
            </div>
            <div style={maxHeight ? { maxHeight, overflowY: "auto", overflowX: "hidden", padding: "2px 6px 2px 2px", margin: "0 -4px" } : undefined}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: "8px" }}>
                    {visible.map(m => {
                        const st = NOTE_STATUS[m.status], ex = excerpt(m.path);
                        return (
                            <GloCard key={m.path} variant="glass" size="small" clickable glow onClick={() => open(m.path)} title={m.title}
                                style={{ opacity: m.status === "ativo" ? 1 : 0.65, minWidth: 0 }}
                                headerStyle={{ padding: "8px 12px 2px" }} bodyStyle={{ padding: "2px 12px 4px" }} footerStyle={{ padding: "4px 12px 8px" }}
                                footer={
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "4px", flexWrap: "wrap" }}>
                                        <GloBadgeGroup gap="3px">
                                            <GloBadge size="small" variant="soft" color={typeColor[m.type.id]}>{m.type.label}</GloBadge>
                                            <GloBadge size="small" variant="soft" status="primary">{m.scope}</GloBadge>
                                            {m.confidence && <GloBadge size="small" variant="soft" status={CONFIDENCE_STATUS[m.confidence] || "neutral"}>{m.confidence}</GloBadge>}
                                            {m.agent && <GloBadge size="small" variant="outlined" status="neutral">{m.agent}</GloBadge>}
                                            {st && <GloBadge size="small" variant="dot" status={st.status}>{st.label}</GloBadge>}
                                        </GloBadgeGroup>
                                        <span style={{ ...dimStyle, whiteSpace: "nowrap" }} title={m.lastAccessed ? `último acesso ${m.lastAccessed}` : ""}>{m.created}</span>
                                    </div>
                                }>
                                <div style={{ fontSize: "0.8em", opacity: 0.7, lineHeight: 1.4 }} title={m.id}>
                                    {ex === undefined ? "…" : ex || <em style={{ opacity: 0.6 }}>(sem corpo)</em>}
                                </div>
                            </GloCard>
                        );
                    })}
                </div>
            </div>
            {filtered.length === 0 && <p style={{ opacity: 0.5, padding: "8px" }}>Nada casa com o filtro.</p>}
            {filtered.length > limit && (
                <div style={{ textAlign: "center", marginTop: "10px" }}>
                    <GloButton size="small" variant="ghost" label={`mostrar mais (${filtered.length - limit})`} onClick={() => setLimit(limit + PAGE_SIZE)} />
                </div>
            )}
            {showMaintenance && (
                <div style={{ marginTop: "14px" }}>
                    <GloCard title="Última consolidação" size="small" variant="glass" headerStyle={{ padding: "8px 14px 2px" }}><MaintenancePanel /></GloCard>
                </div>
            )}
        </GloCard>
    );
}

// Uso direto numa nota: com portão de visibilidade. Embutido no dashboard: sem portão (o dashboard já tem).
const MemoryBrowser = gate(MemoryBrowserReal);

return { Func: MemoryBrowser, MemoryBrowser, MemoryBrowserInline: MemoryBrowserReal, MaintenancePanel, memoriesFrom, TYPE_BY_FOLDER, toDateStr, getValue, pathOf, idsFrom };
