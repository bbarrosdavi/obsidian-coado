// ═══════════════════════════════════════════════════════════════════════════════
// ACTIVITIES v2 (Painel de análise de atividades)
// Escolhe uma métrica (diário, humor, energia, sono, água, calorias, exercício)
// e mostra: mapa de calor das últimas 26 semanas (clique abre a nota do dia),
// números do período e tendência por semana ou mês em área ou barras.
// Só leitura.
//
// Mudanças: estilo próprio (dependia de Styles/dc-activities.css, que não
// existe na vault: o painel aparecia sem forma); todas as métricas calculadas
// numa passada só, trocar de métrica não relê a vault; "hoje" em fuso local
// (antes, data UTC: depois das 21h contava o dia seguinte); números com o
// sentido do rótulo (σ mostrava o máximo e Mo o dia da semana de hoje); dica
// do mapa por DOM, sem re-render do SVG a cada célula; metas lidas também das
// atividades do Settings quando as chaves antigas não existem; cores do tema.
// ═══════════════════════════════════════════════════════════════════════════════

const { useTheme } = await dc.require(dc.fileLink("System/Scripts/Core/dc-themeProvider.jsx"));
const { gate } = await dc.require(dc.fileLink("System/Scripts/Core/dc-visibleGate.jsx"));
const { GloButton, alpha } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloButton.jsx"));
const { GloSelect } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloSelect.jsx"));

const CELL = 11, GAP = 3, CHART_W = 600, CHART_H = 60;
const WEEKDAYS = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];
const BASE = [
    ["journal", "Diário", "count", null, "color-blue", "#2089FF"],
    ["mood", "Humor", "value", "mood", "color-purple", "#A29BFE"],
    ["energy", "Energia", "value", "energy", "color-yellow", "#FDCB6E"],
    ["sleep", "Sono", "value", "sleep-hours", "color-green", "#00B894"],
    ["water", "Água", "value", "water-ml", "color-cyan", "#0984E3"],
    ["nutrition", "Calorias", "value", "consumed-calories", "color-red", "#FF7675"],
    ["exercise", "Exercício", "value", "exercise-minutes", "color-orange", "#E17055"],
];
const fmOf = (path) => { const f = app.metadataCache.getFirstLinkpathDest(path, ""); return (f && app.metadataCache.getFileCache(f)?.frontmatter) || {}; };
const numOf = (raw) => { if (raw === undefined || raw === null || raw === "") return 0; const n = Number(String(raw).replace(/[^\d.]/g, "")); return isNaN(n) ? 0 : n; };

function smooth(pts) {
    if (pts.length < 2) return "";
    let d = `M ${pts[0][0]},${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[i ? i - 1 : 0], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
        d += ` C ${p1[0] + (p2[0] - p0[0]) / 6},${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6},${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]},${p2[1]}`;
    }
    return d;
}

function AnalyticsBoardReal() {
    const { theme } = useTheme();
    const [view, setView] = dc.useState("journal");
    const [chartType, setChartType] = dc.useState("area");
    const [period, setPeriod] = dc.useState("week");
    const tipRef = dc.useRef(null), boxRef = dc.useRef(null);

    dc.useFile("System/Settings.md");
    const settings = fmOf("System/Settings.md"), mealPlan = fmOf("Meal Planner.md");
    const actGoal = (field) => (settings.activities || []).find(a => a.field === field)?.goal;
    const METRICS = Object.fromEntries(BASE.map(([k, label, type, field, tk, hex]) => [k, { label, type, field, color: theme[tk] || hex }]));
    METRICS.mood.max = 5; METRICS.energy.max = 5;
    METRICS.sleep.goal = Number(settings["sleep-goal-hours"]) || actGoal("sleep-hours") || 8;
    METRICS.water.goal = Number(settings["water-goal-ml"]) || actGoal("water-ml") || 3000;
    METRICS.nutrition.goal = Number(mealPlan["goal-calories"]) || actGoal("consumed-calories") || 2000;
    METRICS.exercise.goal = Number(settings["exercise-goal-minutes"]) || actGoal("exercise-minutes") || 30;
    const config = METRICS[view];

    const pages = dc.useQuery("@page");
    const dayKey = window.moment().format("YYYY-MM-DD");
    // Uma passada para todas as métricas; trocar de métrica não refaz a varredura.
    const data = dc.useMemo(() => {
        const today = dc.coerce.date(dayKey).startOf("day");
        const start = today.minus({ weeks: 26 }).startOf("week");
        const maps = Object.fromEntries(BASE.map(([k]) => [k, new Map()]));
        for (const p of pages) {
            const name = p.$name, path = p.$path;
            if (!path) continue;
            const f = app.vault.getFileByPath(path);
            const fm = (f && app.metadataCache.getFileCache(f)?.frontmatter) || {};
            let date = dc.coerce.date(name);
            if (!date || !date.isValid) {
                if (fm["creation date"]) date = dc.coerce.date(fm["creation date"]);
                else if (fm.date) date = dc.coerce.date(fm.date);
            }
            if (!date || !date.isValid) continue;
            date = date.startOf("day");
            if (date < start || date > today) continue;
            const iso = date.toISODate();
            for (const [k, , type, field] of BASE) {
                const val = type === "count" ? (/^\d{4}-\d{2}-\d{2}$/.test(name) ? 1 : 0) : numOf(fm[field]);
                if (val <= 0) continue;
                const m = maps[k], cur = m.get(iso);
                if (!cur || val > cur.val) m.set(iso, { val, file: path, date });
            }
        }
        const list = [];
        for (let c = start; c <= today.endOf("week"); c = c.plus({ days: 1 })) list.push(c);
        return { maps, list, start, today };
    }, [pages, dayKey]);

    const { list, start, today } = data, map = data.maps[view];
    const stats = dc.useMemo(() => {
        const vals = [...map.values()], n = vals.length;
        if (!n) return { avg: 0, sd: 0, max: 0, mode: "—", n: 0 };
        const avg = vals.reduce((s, x) => s + x.val, 0) / n;
        const sd = Math.sqrt(vals.reduce((s, x) => s + (x.val - avg) ** 2, 0) / n);
        const wd = Array(7).fill(0); for (const x of vals) wd[x.date.weekday - 1]++;
        return { avg, sd, max: Math.max(...vals.map(x => x.val)), mode: WEEKDAYS[wd.indexOf(Math.max(...wd))], n };
    }, [map]);

    const buckets = dc.useMemo(() => {
        const groups = new Map();
        for (let it = start; it <= today; it = it.plus({ days: 1 })) {
            const e = map.get(it.toISODate());
            const key = period === "week" ? it.startOf("week").toISODate() : it.toFormat("yyyy-MM");
            const g = groups.get(key) || { sum: 0, count: 0 };
            g.sum += e ? e.val : 0; if (e) g.count++;
            groups.set(key, g);
        }
        return [...groups.values()].map(g => config.type === "count" ? g.sum : (g.count ? g.sum / g.count : 0));
    }, [map, start, today, period, config.type]);

    const chartMax = Math.max(...buckets, 1), stepX = CHART_W / (buckets.length - 1 || 1);
    const pts = buckets.map((v, i) => [i * stepX, CHART_H - (v / chartMax) * CHART_H]);
    const curve = smooth(pts), area = `${curve} L ${CHART_W},${CHART_H} L 0,${CHART_H} Z`;
    const opacity = (v) => {
        if (config.type === "count") return 0.9;
        const pct = config.goal ? v / config.goal : config.max ? v / config.max : v / (stats.max || 1);
        return Math.max(0.4, Math.min(pct, 1));
    };

    const showTip = (e, text) => {
        const t = tipRef.current, b = boxRef.current; if (!t || !b) return;
        const r = b.getBoundingClientRect();
        t.firstChild.data = text;
        t.style.transform = `translate(${e.clientX - r.left}px, ${e.clientY - r.top - 30}px)`;
        t.style.opacity = "1";
    };
    const hideTip = () => { if (tipRef.current) tipRef.current.style.opacity = "0"; };

    const weeks = Math.ceil(list.length / 7), width = weeks * (CELL + GAP), height = 7 * (CELL + GAP) + 18;
    const muted = theme["color-text-muted"] || "var(--text-muted)";
    const fmt = (x) => Number.isInteger(x) ? String(x) : x.toFixed(1);
    const btn = (on) => ({ size: "small", variant: "liquid-glass", glow: false, active: on });
    const STATS = [["Média", fmt(stats.avg)], ["σ", fmt(stats.sd)], ["Máximo", fmt(stats.max)], ["Dia mais comum", stats.mode], ["Dias", stats.n], ...(config.goal ? [["Meta", config.goal]] : [])];

    return (
        <div ref={boxRef} style={{ position: "relative", padding: 14, borderRadius: 12, background: "var(--background-secondary)", border: `1px solid ${alpha(config.color, 0.25)}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: config.color }}>{config.label}</span>
                <GloSelect value={view} options={Object.entries(METRICS).map(([k, v]) => ({ value: k, label: v.label }))} onChange={setView} size="small" style={{ width: 160 }} />
            </div>
            <div style={{ overflowX: "auto", paddingBottom: 4 }}>
                <svg width={width} height={height} style={{ display: "block" }} onMouseLeave={hideTip}>
                    {list.map((date, i) => {
                        const iso = date.toISODate(), d = map.get(iso);
                        const x = Math.floor(i / 7) * (CELL + GAP), y = (date.weekday - 1) * (CELL + GAP) + 15;
                        return (
                            <g key={iso}>
                                {date.weekday === 1 && date.day <= 7 && <text x={x + CELL / 2} y={10} fontSize="9" fill={muted} textAnchor="middle">{date.setLocale("pt-BR").toFormat("MMM").replace(".", "").toUpperCase()}</text>}
                                <rect x={x} y={y} width={CELL} height={CELL} rx={2}
                                    fill={d ? config.color : "var(--background-modifier-border)"} fillOpacity={d ? opacity(d.val) : 0.6}
                                    style={{ cursor: d ? "pointer" : "default" }}
                                    onMouseEnter={(e) => showTip(e, `${date.setLocale("pt-BR").toFormat("dd LLL")}: ${d ? fmt(d.val) : 0}`)}
                                    onClick={() => d && app.workspace.openLinkText(d.file, "", false)} />
                            </g>
                        );
                    })}
                </svg>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(80px, 1fr))", gap: 6, margin: "10px 0" }}>
                {STATS.map(([k, v]) => (
                    <div key={k} style={{ padding: "6px 8px", borderRadius: 8, background: alpha(config.color, 0.08), display: "flex", flexDirection: "column", gap: 2 }}>
                        <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".05em", color: muted }}>{k}</span>
                        <span style={{ fontSize: 15, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: k === "Meta" ? config.color : "var(--text-normal)" }}>{v}</span>
                    </div>
                ))}
            </div>
            <svg viewBox={`0 -5 ${CHART_W} ${CHART_H + 5}`} preserveAspectRatio="none" style={{ width: "100%", height: 70, display: "block", overflow: "visible" }}>
                <defs>
                    <linearGradient id={`dcAtivGrad-${view}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={config.color} stopOpacity="0.5" />
                        <stop offset="100%" stopColor={config.color} stopOpacity="0" />
                    </linearGradient>
                </defs>
                {chartType === "area"
                    ? <g><path d={area} fill={`url(#dcAtivGrad-${view})`} /><path d={curve} stroke={config.color} strokeWidth="2" fill="none" vectorEffect="non-scaling-stroke" /></g>
                    : <g>{buckets.map((v, i) => { const bh = (v / chartMax) * CHART_H; return <rect key={i} x={i * stepX} y={CHART_H - bh} width={Math.max(2, stepX - 2)} height={bh} fill={config.color} />; })}</g>}
            </svg>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                <GloButton {...btn(period === "week")} label="Semana" onClick={() => setPeriod("week")} />
                <GloButton {...btn(period === "month")} label="Mês" onClick={() => setPeriod("month")} />
                <span style={{ width: 10 }} />
                <GloButton {...btn(chartType === "area")} label="Área" onClick={() => setChartType("area")} />
                <GloButton {...btn(chartType === "bar")} label="Barras" onClick={() => setChartType("bar")} />
            </div>
            <div ref={tipRef} style={{ position: "absolute", left: 0, top: 0, opacity: 0, pointerEvents: "none", transition: "opacity .12s", padding: "3px 8px", borderRadius: 6, fontSize: 11, whiteSpace: "nowrap", background: "var(--background-primary)", border: "1px solid var(--background-modifier-border)", boxShadow: "0 2px 8px rgba(0,0,0,.2)" }}>{" "}</div>
        </div>
    );
}

const AnalyticsBoard = gate(AnalyticsBoardReal);
return { Func: AnalyticsBoard, AnalyticsBoard };
