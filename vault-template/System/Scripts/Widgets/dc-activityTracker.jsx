// ═══════════════════════════════════════════════════════════════════════════════
// ACTIVITY TRACKER v3 (Tendências) - versão única (antes: dc-activityTracker e
// dc-activityTrackerV5)
// Mapa de calor de 26 semanas com até 4 camadas (atividades do Settings),
// números da camada em foco (média, pico, sequência, dias, meta) e curvas por
// semana ou mês. Camadas ativas persistidas em Settings `active-tracker-layers`.
//
// Mecanismos: mapa de calor memorizado (dados, camadas, tamanho); tooltip
// escrito no DOM por um listener único no SVG (antes: setState por célula
// sobrevoada re-renderizava ~750 retângulos); query estreita em
// System/Periodicos; paleta de reserva do tema; dia selecionado destacado.
// ═══════════════════════════════════════════════════════════════════════════════

const { useTheme, deriveChartColors } = await dc.require(dc.fileLink("System/Scripts/Core/dc-themeProvider.jsx"));
const { getActivities } = await dc.require(dc.fileLink("System/Scripts/Core/dc-dateContext.jsx"));
const { GloBadge } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloBadge.jsx"));
const { alpha } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloButton.jsx"));

const SETTINGS_PATH = "System/Settings.md";
const CHART_W = 600, CHART_H = 80, GAP = 3;
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

function readLayers() {
    const f = app.vault.getAbstractFileByPath(SETTINGS_PATH);
    const fm = (f && app.metadataCache.getFileCache(f)?.frontmatter) || {};
    const saved = fm["active-tracker-layers"];
    return { layers: saved ? (Array.isArray(saved) ? saved : [saved]) : [], bg: fm["widget-backgrounds"] !== false };
}
async function saveLayers(ids) {
    const f = app.vault.getAbstractFileByPath(SETTINGS_PATH);
    if (f) await app.fileManager.processFrontMatter(f, fm => { fm["active-tracker-layers"] = ids; });
}

/** Valores por dia (26 semanas até o fim da semana atual) e estatísticas por camada. */
function useData(acts, ids, period) {
    const pages = dc.useQuery('@page and path("System/Periodicos")');
    return dc.useMemo(() => {
        if (!ids.length) return { grid: [], stats: {}, byIso: new Map() };
        const L = dc.luxon.DateTime;
        const today = L.now().startOf("day");
        const start = today.minus({ weeks: 26 }).startOf("week");
        const byIso = new Map();
        for (let c = start; c <= today.endOf("week"); c = c.plus({ days: 1 })) byIso.set(c.toISODate(), { date: c, values: {} });
        const wanted = ids.map(id => acts.find(a => a.id === id)).filter(Boolean);
        for (const p of pages) {
            const path = p.$path || p.path;
            if (!path) continue;
            const tf = app.vault.getAbstractFileByPath(path);
            const fm = (tf && app.metadataCache.getFileCache(tf)?.frontmatter) || {};
            let d = L.fromISO(p.$name || p.name || "");
            if (!d.isValid && fm["creation date"]) d = L.fromISO(fm["creation date"]);
            else if (!d.isValid && fm.date) d = L.fromISO(fm.date);
            if (!d.isValid) continue;
            const entry = byIso.get(d.startOf("day").toISODate());
            if (!entry) continue;
            for (const a of wanted) {
                const raw = fm[a.field];
                let val = 0;
                if (raw !== undefined && raw !== null && raw !== "") {
                    if (a.type === "boolean") val = raw ? 1 : 0;
                    else { const n = Number(String(raw).replace(/[^\d.]/g, "")); if (!isNaN(n)) val = n; }
                }
                if (val > 0) { entry.values[a.id] = Math.max(entry.values[a.id] || 0, val); entry.file = path; }
            }
        }
        const grid = [...byIso.values()].sort((a, b) => a.date - b.date);
        const stats = {};
        for (const a of wanted) {
            const vals = grid.map(d => d.values[a.id] || 0), nz = vals.filter(v => v > 0);
            let streak = 0;
            for (let c = today; byIso.get(c.toISODate())?.values[a.id] > 0; c = c.minus({ days: 1 })) streak++;
            const groups = new Map();
            for (const d of grid) {
                const k = period === "week" ? d.date.startOf("week").toISODate() : d.date.toFormat("yyyy-MM");
                const g = groups.get(k) || { sum: 0, count: 0 };
                const v = d.values[a.id] || 0;
                g.sum += v; if (v > 0) g.count++;
                groups.set(k, g);
            }
            const buckets = [...groups.values()].map(g => ({ val: (a.type === "count" || a.type === "boolean") ? g.sum : (g.count ? g.sum / g.count : 0) }));
            stats[a.id] = { max: Math.max(...vals, 1), total: nz.length, avg: nz.length ? (nz.reduce((s, x) => s + x, 0) / nz.length).toFixed(1) : 0, streak, buckets, goal: a.goal };
        }
        return { grid, stats, byIso };
    }, [pages, acts, ids.join("|"), period]);
}

function splinePath(buckets, maxVal) {
    if (!buckets || buckets.length < 2) return "";
    const sx = CHART_W / (buckets.length - 1), y = (v) => CHART_H - ((v / (maxVal || 1)) * (CHART_H - 10));
    const P = buckets.map((b, i) => [i * sx, y(b.val)]);
    let d = `M ${P[0][0]},${P[0][1]}`;
    for (let i = 0; i < P.length - 1; i++) {
        const p0 = P[i ? i - 1 : 0], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2] || p2;
        d += ` C ${p1[0] + (p2[0] - p0[0]) / 6},${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6},${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]},${p2[1]}`;
    }
    return d;
}

function ActivityTracker({ targetDate = null }) {
    const { theme } = useTheme();
    const palette = dc.useMemo(() => { const t = deriveChartColors({ ...theme }); return [1, 2, 3, 4, 5, 6].map(i => t[`chart-color-${i}`]); }, [theme]);
    const acts = dc.useMemo(() => getActivities().map((a, i) => ({ ...a, color: a.color || palette[i % palette.length] })), [palette]);
    const init = dc.useMemo(readLayers, []);
    const [ids, setIds] = dc.useState(init.layers.length ? init.layers : (acts[0] ? [acts[0].id] : []));
    const [focus, setFocus] = dc.useState(ids[0] || null);
    const [menu, setMenu] = dc.useState(false);
    const [period, setPeriod] = dc.useState("week");
    const scrollRef = dc.useRef(null), tipRef = dc.useRef(null), wrapRef = dc.useRef(null);
    const { grid, stats, byIso } = useData(acts, ids, period);
    const cell = ids.length <= 1 ? 13 : ids.length === 2 ? 16 : 20;
    const primary = theme["color-primary"] || "#7c3aed", text = theme["color-text"] || "var(--text-normal)", muted = theme["color-text-muted"] || "var(--text-muted)";

    dc.useEffect(() => { const el = scrollRef.current; if (el) requestAnimationFrame(() => { el.scrollLeft = el.scrollWidth; }); }, [grid.length, cell]);

    const toggle = (id) => {
        let next;
        if (ids.includes(id)) { if (ids.length <= 1) return; next = ids.filter(x => x !== id); if (focus === id) setFocus(next[0]); }
        else { if (ids.length >= 4) { new Notice("Máximo de 4 camadas ao mesmo tempo."); return; } next = [...ids, id]; setFocus(id); }
        setIds(next); saveLayers(next);
    };

    // Mapa de calor: só recalcula com dados, camadas, tamanho ou dia selecionado.
    const sel = typeof targetDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(targetDate) ? targetDate : null;
    const heat = dc.useMemo(() => {
        const out = [], labels = [];
        grid.forEach((day, i) => {
            const x = Math.floor(i / 7) * (cell + GAP), y = (day.date.weekday - 1) * (cell + GAP) + 15;
            if (day.date.weekday === 1 && day.date.day <= 7) labels.push(<text key={`m${i}`} x={x + cell / 2} y={10} fontSize={9} textAnchor="middle" fill={muted}>{MESES[day.date.month - 1]}</text>);
            ids.forEach((id, k) => {
                const a = acts.find(z => z.id === id); if (!a) return;
                const v = day.values[id] || 0, st = stats[id] || { max: 1 };
                const op = v > 0 ? Math.max(0.4, Math.min(v / (a.goal || st.max || 1), 1)) : 0.1;
                const half = ids.length > 1, quad = ids.length > 2;
                const rw = half ? cell / 2 - 0.5 : cell, rh = quad ? cell / 2 - 0.5 : cell;   // nunca chamar de h: é a fábrica do JSX
                const rx = x + ((k === 1 || k === 3) && half ? cell / 2 + 0.5 : 0), ry = y + (k >= 2 && quad ? cell / 2 + 0.5 : 0);
                out.push(<rect key={`${i}-${id}`} data-i={i} x={rx} y={ry} width={rw} height={rh} rx={2} fill={v > 0 ? a.color : muted} fillOpacity={op} />);
            });
            if (sel && day.date.toISODate() === sel) out.push(<rect key="sel" x={x - 1.5} y={y - 1.5} width={cell + 3} height={cell + 3} rx={3} fill="none" stroke={text} strokeWidth={1.2} pointerEvents="none" />);
        });
        return { cells: out, labels };
    }, [grid, ids.join("|"), cell, stats, acts, sel, muted, text]);

    // Tooltip e clique: um listener no SVG, conteúdo escrito direto no nó.
    const onMove = (e) => {
        const tip = tipRef.current, i = e.target?.dataset?.i;
        if (!tip) return;
        if (i === undefined) { tip.style.display = "none"; return; }
        const day = grid[+i];
        const lines = ids.map(id => { const a = acts.find(z => z.id === id); const v = day.values[id] || 0; return `<div style="display:flex;justify-content:space-between;gap:12px"><span style="color:${esc(a?.color)}">${esc(a?.name || id)}</span><span>${v > 0 ? `${esc(v)} ${esc(a?.unit || "")}` : "-"}</span></div>`; }).join("");
        tip.innerHTML = `<div style="font-weight:700;border-bottom:1px solid var(--background-modifier-border);padding-bottom:3px;margin-bottom:3px">${DIAS[day.date.weekday % 7]}, ${String(day.date.day).padStart(2, "0")}/${String(day.date.month).padStart(2, "0")}</div>${lines}`;
        const box = wrapRef.current.getBoundingClientRect();
        tip.style.display = "block";
        tip.style.left = `${Math.min(Math.max(e.clientX - box.left, 70), box.width - 70)}px`;
        tip.style.top = `${e.clientY - box.top - 14 - ids.length * 18 - 20}px`;
        e.currentTarget.style.cursor = day.file ? "pointer" : "default";
    };
    const onClick = (e) => { const i = e.target?.dataset?.i; if (i !== undefined && grid[+i]?.file) app.workspace.openLinkText(grid[+i].file, "", false); };

    const fs = stats[focus] || { avg: 0, max: 0, streak: 0, total: 0 };
    const fa = acts.find(a => a.id === focus);
    const weeks = Math.ceil(grid.length / 7), W = weeks * (cell + GAP), H = 7 * (cell + GAP) + 20;
    const stat = (label, val, color) => (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <span style={{ fontSize: 9, letterSpacing: ".08em", color: muted }}>{label}</span>
            <span style={{ fontSize: 17, fontWeight: 700, color: color || text, fontVariantNumeric: "tabular-nums" }}>{val}</span>
        </div>
    );

    return (
        <div ref={wrapRef} style={{ position: "relative", padding: "14px 18px", borderRadius: 16, fontFamily: "var(--font-monospace)", boxSizing: "border-box", width: "fit-content", maxWidth: "100%", margin: "0 auto",
            background: init.bg ? "var(--background-secondary, transparent)" : "transparent", border: init.bg ? `1px solid ${alpha(primary, 0.13)}` : "none" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, width: W, maxWidth: "100%", margin: "0 auto 14px", minHeight: 32 }}>
                <div style={{ position: "relative" }}>
                    <button onClick={() => setMenu(!menu)} style={{ background: menu ? primary : "var(--background-modifier-hover, transparent)", color: menu ? "var(--text-on-accent)" : text, border: `1px solid ${alpha(primary, 0.27)}`, borderRadius: 8, padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, boxShadow: "none" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
                        <span style={{ fontSize: 11, fontWeight: 600 }}>CAMADAS ({ids.length})</span>
                    </button>
                    {menu && (
                        <div style={{ position: "absolute", top: "110%", left: 0, zIndex: 1000, minWidth: 190, maxHeight: 250, overflowY: "auto", padding: 4, borderRadius: 8, background: "var(--background-secondary)", border: `1px solid ${alpha(primary, 0.27)}`, boxShadow: "0 4px 20px rgba(0,0,0,0.5)" }}>
                            <div style={{ fontSize: 10, color: muted, margin: "2px 4px 6px" }}>VISIBILIDADE</div>
                            {acts.map(a => {
                                const on = ids.includes(a.id);
                                return (
                                    <div key={a.id} onClick={() => toggle(a.id)} className="dcg-chip" style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 6px", borderRadius: 6, cursor: "pointer", background: on ? alpha(a.color, 0.13) : "transparent" }}>
                                        <span style={{ width: 12, height: 12, borderRadius: 3, border: `1px solid ${on ? a.color : muted}`, background: on ? a.color : "transparent", flexShrink: 0 }} />
                                        <span style={{ fontSize: 12, color: on ? text : muted }}>{a.name}</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
                <div style={{ display: "flex", gap: 6, overflowX: "auto", scrollbarWidth: "none", maxWidth: "55%", alignItems: "center" }}>
                    {ids.map(id => { const a = acts.find(z => z.id === id); if (!a) return null; const f = focus === id; return (
                        <span key={id} onClick={() => setFocus(id)} style={{ cursor: "pointer", opacity: f ? 1 : 0.55, flexShrink: 0 }}>
                            <GloBadge variant={f ? "filled" : "outlined"} color={a.color} size="small">{a.name}</GloBadge>
                        </span>
                    ); })}
                </div>
                <div style={{ display: "flex", gap: 6, fontSize: 10, fontWeight: 700, color: muted, cursor: "pointer", userSelect: "none" }}>
                    <span onClick={() => setPeriod("week")} style={{ opacity: period === "week" ? 1 : 0.4 }}>SEM</span>
                    <span style={{ opacity: 0.2 }}>/</span>
                    <span onClick={() => setPeriod("month")} style={{ opacity: period === "month" ? 1 : 0.4 }}>MÊS</span>
                </div>
            </div>

            <div ref={scrollRef} style={{ width: W, maxWidth: "100%", margin: "0 auto 14px", overflowX: "auto", scrollbarWidth: "none" }}>
                <svg width={W} height={H} style={{ minWidth: W, overflow: "visible" }} onMouseMove={onMove} onMouseLeave={() => { if (tipRef.current) tipRef.current.style.display = "none"; }} onClick={onClick}>
                    {heat.labels}{heat.cells}
                </svg>
            </div>

            <div style={{ display: "flex", justifyContent: "space-around", width: W, maxWidth: "100%", margin: "0 auto 16px", padding: "10px 0", borderTop: "1px solid var(--background-modifier-border)", borderBottom: "1px solid var(--background-modifier-border)" }}>
                {stat("MÉDIA", fs.avg)}{stat("PICO", fs.max)}{stat("SEQUÊNCIA", fs.streak, fa?.color)}{stat("DIAS", fs.total)}{fs.goal ? stat("META", fs.goal, fa?.color) : null}
            </div>

            <div style={{ width: W, maxWidth: "100%", margin: "0 auto" }}>
                <svg viewBox={`0 -5 ${CHART_W} ${CHART_H + 5}`} preserveAspectRatio="none" style={{ width: "100%", height: CHART_H, display: "block", overflow: "visible" }}>
                    {ids.map(id => { const a = acts.find(z => z.id === id); const st = stats[id]; if (!a || !st) return null; const f = focus === id; return (
                        <path key={id} d={splinePath(st.buckets, st.max)} fill="none" stroke={a.color} strokeWidth={f ? 2.5 : 1.5} strokeOpacity={f ? 1 : 0.15} vectorEffect="non-scaling-stroke" />
                    ); })}
                </svg>
            </div>

            <div ref={tipRef} style={{ display: "none", position: "absolute", transform: "translateX(-50%)", pointerEvents: "none", zIndex: 20, padding: "6px 8px", borderRadius: 6, fontSize: 11, minWidth: 120, background: "var(--background-secondary-alt)", border: `1px solid ${alpha(primary, 0.27)}`, boxShadow: "0 4px 12px rgba(0,0,0,0.35)" }} />
        </div>
    );
}

return { Func: ActivityTracker, ActivityTracker };
