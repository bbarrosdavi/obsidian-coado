// ═══════════════════════════════════════════════════════════════════════════════
// TASK STATS (Estatísticas das tarefas)
// O conteúdo da tela de estatísticas do TaskNotes num widget embutível (a tela
// do plugin é uma view própria e não abre como ![[...]]): visão geral (total,
// conclusão, tempo registrado e estimado, tempo médio por tarefa, projetos
// ativos), hoje, esta semana, este mês e todo o período, filtros (todas, ativas,
// concluídas, tempo mínimo), intervalo de datas e quebra por projeto.
// Só leitura. Campos do TaskNotes (data.json → fieldMapping): status, project,
// due_date, created, completedDate, timeEstimate (min), timeEntries.
// Tarefa = nota com a tag tipo/task, sem a tag de arquivo (archived).
// Botão "Abrir no TaskNotes" abre a tela original de estatísticas do plugin.
// ═══════════════════════════════════════════════════════════════════════════════

const { useTheme } = await dc.require(dc.fileLink("System/Scripts/Core/dc-themeProvider.jsx"));
const { gate } = await dc.require(dc.fileLink("System/Scripts/Core/dc-visibleGate.jsx"));
const { GloButton, alpha } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloButton.jsx"));
const { GloBar } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloBar.jsx"));

const TAG = "tipo/task";
const DONE = new Set(["done"]);
const DAY = 86400000;
const asList = (v) => Array.isArray(v) ? v : v ? [v] : [];
const linkName = (v) => String(v).replace(/^\[\[|\]\]$/g, "").split("|").pop().split("/").pop().replace(/\.md$/, "").trim();
const toMs = (v) => { if (!v) return null; const t = Date.parse(typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T00:00:00` : String(v)); return isNaN(t) ? null : t; };
const fmtMin = (m) => { m = Math.round(m || 0); if (!m) return "0 min"; const h = Math.floor(m / 60), r = m % 60; return h ? (r ? `${h} h ${r} min` : `${h} h`) : `${r} min`; };
const startOfDay = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
const startOfWeek = (t) => { const d = new Date(startOfDay(t)); const wd = (d.getDay() + 6) % 7; return d.getTime() - wd * DAY; };
const startOfMonth = (t) => { const d = new Date(t); return new Date(d.getFullYear(), d.getMonth(), 1).getTime(); };
// Minutos de um registro de tempo dentro de [a, b).
const overlap = (e, a, b) => Math.max(0, Math.min(e.end, b) - Math.max(e.start, a)) / 60000;

function useTasks() {
    const pages = dc.useQuery(`@page and #${TAG}`);
    return dc.useMemo(() => {
        const out = [];
        for (const p of pages) {
            const f = app.vault.getFileByPath(p.$path);
            const fm = (f && app.metadataCache.getFileCache(f)?.frontmatter) || {};
            const tags = asList(fm.tags).map(t => String(t).replace(/^#/, ""));
            if (!tags.includes(TAG) || tags.includes("archived")) continue;
            const entries = asList(fm.timeEntries).map(e => ({ start: toMs(e?.startTime), end: toMs(e?.endTime) })).filter(e => e.start && e.end && e.end > e.start);
            out.push({
                path: p.$path, name: f?.basename || p.$name,
                done: DONE.has(String(fm.status || "").toLowerCase()),
                projects: asList(fm.project).map(linkName).filter(Boolean),
                created: toMs(fm.created) || f?.stat?.ctime || null,
                completed: toMs(fm.completedDate),
                estimate: Number(fm.timeEstimate) || 0,
                entries,
                tracked: entries.reduce((s, e) => s + (e.end - e.start) / 60000, 0),
            });
        }
        return out;
    }, [pages]);
}

function TaskStatsReal() {
    const { theme } = useTheme();
    const tasks = useTasks();
    const [show, setShow] = dc.useState("all");      // all | active | done
    const [minTime, setMinTime] = dc.useState("");
    const [from, setFrom] = dc.useState("");
    const [to, setTo] = dc.useState("");
    const primary = theme["color-primary"] || "#7c3aed", muted = theme["color-text-muted"] || "var(--text-muted)";
    const green = theme["color-success"] || "#10b981";

    const rangeA = from ? toMs(from) : null, rangeB = to ? toMs(to) + DAY : null;
    const inRange = (t) => t !== null && (rangeA === null || t >= rangeA) && (rangeB === null || t < rangeB);
    const filtered = dc.useMemo(() => tasks.filter(t => {
        if (show === "active" && t.done) return false;
        if (show === "done" && !t.done) return false;
        if (minTime && t.tracked < Number(minTime)) return false;
        if (rangeA !== null || rangeB !== null) {
            const touched = inRange(t.created) || inRange(t.completed) || t.entries.some(e => overlap(e, rangeA ?? -Infinity, rangeB ?? Infinity) > 0);
            if (!touched) return false;
        }
        return true;
    }), [tasks, show, minTime, from, to]);

    const overview = dc.useMemo(() => {
        const total = filtered.length, done = filtered.filter(t => t.done).length;
        const tracked = filtered.reduce((s, t) => s + t.tracked, 0), estimated = filtered.reduce((s, t) => s + t.estimate, 0);
        const withTime = filtered.filter(t => t.tracked > 0).length;
        const active = new Set(filtered.filter(t => !t.done).flatMap(t => t.projects));
        return { total, done, rate: total ? Math.round(done / total * 100) : 0, tracked, estimated, avg: withTime ? tracked / withTime : 0, projects: active.size };
    }, [filtered]);

    const now = Date.now();
    const periods = dc.useMemo(() => {
        const rows = [["Hoje", startOfDay(now), startOfDay(now) + DAY], ["Esta semana", startOfWeek(now), startOfWeek(now) + 7 * DAY], ["Este mês", startOfMonth(now), new Date(new Date(now).getFullYear(), new Date(now).getMonth() + 1, 1).getTime()], ["Todo o período", -Infinity, Infinity]];
        if (rangeA !== null || rangeB !== null) rows.push([`Intervalo${from ? ` de ${from}` : ""}${to ? ` até ${to}` : ""}`, rangeA ?? -Infinity, rangeB ?? Infinity]);
        return rows.map(([label, a, b]) => {
            const inP = (t) => t !== null && t >= a && t < b;
            return {
                label,
                done: filtered.filter(t => t.done && inP(t.completed)).length,
                created: filtered.filter(t => inP(t.created)).length,
                tracked: filtered.reduce((s, t) => s + t.entries.reduce((x, e) => x + overlap(e, a, b), 0), 0),
            };
        });
    }, [filtered, from, to, Math.floor(now / 60000)]);

    const projects = dc.useMemo(() => {
        const m = new Map();
        for (const t of filtered) for (const p of (t.projects.length ? t.projects : ["Sem projeto"])) {
            const g = m.get(p) || { name: p, total: 0, done: 0, tracked: 0 };
            g.total++; if (t.done) g.done++; g.tracked += t.tracked;
            m.set(p, g);
        }
        return [...m.values()].sort((a, b) => b.tracked - a.tracked || b.total - a.total);
    }, [filtered]);

    const lbl = { fontSize: 11, textTransform: "uppercase", color: muted, fontWeight: 700 };
    const big = { fontSize: 24, fontWeight: 800, fontVariantNumeric: "tabular-nums" };
    const sep = { borderLeft: `1px solid ${alpha(primary, 0.2)}`, paddingLeft: 20 };
    const h3 = { borderBottom: `2px solid ${alpha(primary, 0.27)}`, paddingBottom: 10, marginBottom: 12, marginTop: 24 };
    const btn = { size: "small", variant: "liquid-glass", glow: false };
    const input = { background: "rgba(0,0,0,0.2)", border: `1px solid ${alpha(primary, 0.2)}`, borderRadius: 4, padding: "4px 8px", fontSize: 13, color: "var(--text-normal)", outline: "none", height: 30 };
    const cell = { padding: "6px 10px", fontVariantNumeric: "tabular-nums", textAlign: "right" };

    return (
        <div style={{ padding: 10 }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 10, marginBottom: 16 }}>
                <div style={{ display: "flex", gap: 6 }}>
                    {[["all", "Todas"], ["active", "Só ativas"], ["done", "Só concluídas"]].map(([id, l]) => <GloButton key={id} {...btn} label={l} active={show === id} onClick={() => setShow(id)} />)}
                </div>
                <label style={{ display: "flex", flexDirection: "column", gap: 3 }}><span style={lbl}>Tempo mínimo (min)</span><input type="number" min="0" value={minTime} onInput={e => setMinTime(e.target.value)} style={{ ...input, width: 110 }} /></label>
                <label style={{ display: "flex", flexDirection: "column", gap: 3 }}><span style={lbl}>De</span><input type="date" value={from} onInput={e => setFrom(e.target.value)} style={input} /></label>
                <label style={{ display: "flex", flexDirection: "column", gap: 3 }}><span style={lbl}>Até</span><input type="date" value={to} onInput={e => setTo(e.target.value)} style={input} /></label>
                {(show !== "all" || minTime || from || to) && <GloButton {...btn} label="Limpar filtros" onClick={() => { setShow("all"); setMinTime(""); setFrom(""); setTo(""); }} />}
                <div style={{ marginLeft: "auto" }}>
                    <GloButton {...btn} label="Abrir no TaskNotes" onClick={() => app.commands.executeCommandById("tasknotes:open-statistics")} />
                </div>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 20, padding: 15, background: alpha(primary, 0.1), borderRadius: 12, border: `1px solid ${alpha(primary, 0.2)}` }}>
                <div><div style={lbl}>Tarefas</div><div style={big}>{overview.total}</div></div>
                <div style={sep}><div style={lbl}>Conclusão</div><div style={big}>{overview.rate}%</div><div style={{ fontSize: 11, color: muted }}>{overview.done} de {overview.total}</div></div>
                <div style={sep}><div style={lbl}>Tempo registrado / estimado</div><div style={big}>{fmtMin(overview.tracked)}</div><div style={{ fontSize: 11, color: muted }}>estimado {fmtMin(overview.estimated)}</div></div>
                <div style={sep}><div style={lbl}>Tempo médio por tarefa</div><div style={big}>{fmtMin(overview.avg)}</div></div>
                <div style={sep}><div style={lbl}>Projetos ativos</div><div style={big}>{overview.projects}</div></div>
            </div>

            <h3 style={h3}>Períodos</h3>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead><tr style={{ color: muted, fontSize: 11, textTransform: "uppercase" }}>
                    <th style={{ ...cell, textAlign: "left" }}>Período</th><th style={cell}>Concluídas</th><th style={cell}>Criadas</th><th style={cell}>Tempo registrado</th>
                </tr></thead>
                <tbody>{periods.map(p => (
                    <tr key={p.label} style={{ borderTop: `1px solid ${alpha(primary, 0.1)}` }}>
                        <td style={{ ...cell, textAlign: "left", fontWeight: 600 }}>{p.label}</td>
                        <td style={{ ...cell, color: p.done ? green : undefined }}>{p.done}</td>
                        <td style={cell}>{p.created}</td>
                        <td style={cell}>{fmtMin(p.tracked)}</td>
                    </tr>
                ))}</tbody>
            </table>

            <h3 style={h3}>Projetos</h3>
            {projects.length ? projects.map(p => (
                <div key={p.name} style={{ marginBottom: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, fontSize: 13, marginBottom: 4 }}>
                        <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                        <span style={{ color: muted, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{p.done}/{p.total} · {fmtMin(p.tracked)}</span>
                    </div>
                    <GloBar value={p.total ? Math.round(p.done / p.total * 100) : 0} max={100} height="8px" fillGradient={`linear-gradient(90deg, ${primary}, ${primary}88)`} showSprite={false} showValue={false} borderRadius="4px" />
                </div>
            )) : <div style={{ color: muted, fontSize: 13, fontStyle: "italic" }}>Nenhuma tarefa com esses filtros.</div>}
        </div>
    );
}

const TaskStats = gate(TaskStatsReal);
return { Func: TaskStats, TaskStats };
