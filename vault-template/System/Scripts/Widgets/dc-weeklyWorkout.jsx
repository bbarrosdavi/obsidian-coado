// ═══════════════════════════════════════════════════════════════════════════════
// WEEKLY WORKOUT v3 (Agenda semanal de treino)
// Um plano de treino por dia da semana, progresso contra a meta de dias e metas
// de dias/semana e minutos/dia.
//
// Grava (mesmo formato): Planejador de Exercicio `schedule-<day>` = "[[Plano]]"
// (chave removida em dia de descanso; dias em inglês, como lê o workoutToday);
// Settings `activities[id=workout-days|exercise].goal`.
// Mecanismos: lista de planos por consulta Datacore memorizada (antes varria
// todos os arquivos da vault a cada render); seletor GloSelect com hover em CSS;
// metas gravadas ao sair do campo (antes, a cada tecla) e sempre visíveis;
// meta de minutos agora atualiza na tela (o estado local usava outro id).
// ═══════════════════════════════════════════════════════════════════════════════

const { useTheme } = await dc.require(dc.fileLink("System/Scripts/Core/dc-themeProvider.jsx"));
const { gate } = await dc.require(dc.fileLink("System/Scripts/Core/dc-visibleGate.jsx"));
const { alpha } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloButton.jsx"));
const { GloSelect } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloSelect.jsx"));
const { GloBar } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloBar.jsx"));
const { GloBadge } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloBadge.jsx"));

const SETTINGS_PATH = "System/Settings.md";
const PLANNER_PATH = "System/Planejadores/Planejador de Exercicio.md";
const DAYS = [["monday", "Segunda"], ["tuesday", "Terça"], ["wednesday", "Quarta"], ["thursday", "Quinta"], ["friday", "Sexta"], ["saturday", "Sábado"], ["sunday", "Domingo"]];
const cleanPlan = (raw) => {
    if (!raw) return "";
    let s = typeof raw === "object" && raw.path ? raw.path : typeof raw === "string" ? raw : "";
    if (s.endsWith(".md")) s = s.slice(0, -3);
    return s.replace(/[\[\]"]/g, "").trim();
};
const isPlan = (fm) => {
    if (!fm) return false;
    const tag = fm.tags && (Array.isArray(fm.tags) ? fm.tags.includes("workout-plan") : fm.tags === "workout-plan");
    const cats = fm.categories ? JSON.stringify(fm.categories) : "";
    return tag || cats.includes("Workout Plan") || cats.includes("Plano de Treino");
};

function GoalInput({ label, value, onCommit, colors }) {
    const [draft, setDraft] = dc.useState(null);
    return (
        <label style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ fontSize: 10, color: colors.muted, textTransform: "uppercase", letterSpacing: ".04em" }}>{label}</span>
            <input type="number" min={1} value={draft ?? value} onFocus={() => setDraft(String(value))} onInput={e => setDraft(e.target.value)}
                onBlur={() => { if (draft !== null && Number(draft) !== Number(value)) onCommit(Number(draft) || 0); setDraft(null); }}
                onKeyDown={e => { if (e.key === "Enter") e.target.blur(); }}
                style={{ width: 70, padding: "4px 8px", fontSize: 12, borderRadius: 6, border: `1px solid ${alpha(colors.primary, 0.3)}`, background: alpha(colors.primary, 0.1), outline: "none", height: 28 }} />
        </label>
    );
}

function WeeklySchedulerReal() {
    const { theme, settings } = useTheme();
    const bg = settings?.widgetBackgrounds !== false;
    dc.useFile(PLANNER_PATH);
    dc.useFile(SETTINGS_PATH);
    const plannerFile = app.vault.getAbstractFileByPath(PLANNER_PATH);
    const fm = (plannerFile && app.metadataCache.getFileCache(plannerFile)?.frontmatter) || {};
    const [local, setLocal] = dc.useState({});   // escolha otimista até o índice refletir

    const candidates = dc.useQuery("@page and (#workout-plan or exists(categories))");
    const plans = dc.useMemo(() => {
        const out = [];
        for (const p of candidates) {
            const f = app.vault.getFileByPath(p.$path);
            if (f && isPlan(app.metadataCache.getFileCache(f)?.frontmatter)) out.push(f.basename);
        }
        return out.sort();
    }, [candidates]);

    const sFile = app.vault.getAbstractFileByPath(SETTINGS_PATH);
    const acts = (sFile && app.metadataCache.getFileCache(sFile)?.frontmatter?.activities) || [];
    const goals = { days: acts.find(a => a.id === "workout-days")?.goal || 4, minutes: acts.find(a => a.id === "exercise")?.goal || 45 };
    const [goalDraft, setGoalDraft] = dc.useState({});
    const shown = { days: goalDraft.days ?? goals.days, minutes: goalDraft.minutes ?? goals.minutes };

    const valueOf = (d) => local[d] !== undefined ? local[d] : cleanPlan(fm[`schedule-${d}`]);
    const scheduled = DAYS.filter(([d]) => valueOf(d)).length;
    const pct = Math.min((scheduled / (shown.days || 1)) * 100, 100);
    const goalMet = scheduled >= shown.days;

    const primary = theme["color-primary"] || "var(--interactive-accent)", accent = theme["color-accent"] || primary;
    const muted = theme["color-text-muted"] || "var(--text-muted)", success = theme["color-success"] || "#10b981", error = theme["color-red"] || "#ef4444";
    const colors = { primary, muted };

    const setDay = async (day, plan) => {
        setLocal(p => ({ ...p, [day]: plan }));
        await app.fileManager.processFrontMatter(plannerFile, (f) => {
            const k = `schedule-${day}`;
            if (!plan) delete f[k]; else f[k] = `[[${plan}]]`;
        });
    };
    const setGoal = async (id, key, v) => {
        setGoalDraft(p => ({ ...p, [key]: v }));
        try {
            const f = app.vault.getAbstractFileByPath(SETTINGS_PATH);
            if (!f) { new Notice("Settings.md não encontrado"); return; }
            await app.fileManager.processFrontMatter(f, (s) => { const a = s.activities || []; const i = a.findIndex(x => x.id === id); if (i !== -1) { a[i].goal = v; s.activities = a; } });
        } catch (e) { new Notice("Falha ao salvar a meta"); }
    };

    if (!plannerFile) return (
        <div style={{ padding: 16, border: `1px solid ${error}`, borderRadius: 8, background: alpha(error, 0.08), color: error, textAlign: "center" }}>
            <strong>Planejador não encontrado</strong>
            <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--text-normal)" }}>Crie: <code style={{ fontSize: 12 }}>{PLANNER_PATH}</code></p>
        </div>
    );

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: 14, borderRadius: 12, background: bg ? (theme["color-surface"] || "var(--background-secondary)") : "transparent", border: bg ? `1px solid ${alpha(primary, 0.2)}` : "none" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: primary }}>Agenda semanal</h3>
                <div style={{ display: "flex", gap: 12 }}>
                    <GoalInput label="dias/semana" value={shown.days} colors={colors} onCommit={(v) => setGoal("workout-days", "days", v)} />
                    <GoalInput label="min/dia" value={shown.minutes} colors={colors} onCommit={(v) => setGoal("exercise", "minutes", v)} />
                </div>
            </div>
            <div style={{ padding: 10, background: bg ? alpha(primary, 0.07) : "transparent", borderRadius: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, fontSize: 13 }}>
                    <span><strong style={{ color: primary }}>{scheduled}</strong><span style={{ color: muted }}> / {shown.days} dias agendados</span></span>
                    {goalMet ? <GloBadge variant="filled" color={success} size="small">Meta cumprida</GloBadge> : <span style={{ fontSize: 12, color: muted, fontVariantNumeric: "tabular-nums" }}>{Math.round(pct)}%</span>}
                </div>
                <GloBar value={scheduled} max={shown.days} draggable={false} showSprite={true} showValue={false} height="10px"
                    fillGradient={goalMet ? `linear-gradient(90deg, ${success}, ${alpha(success, 0.8)})` : `linear-gradient(90deg, ${primary}, ${accent})`} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {DAYS.map(([d, label]) => {
                    const v = valueOf(d);
                    const opts = [{ value: "", label: "Descanso" }, ...plans.map(p => ({ value: p, label: p }))];
                    if (v && !plans.includes(v)) opts.push({ value: v, label: v });
                    return (
                        <div key={d} style={{ display: "grid", gridTemplateColumns: "84px 1fr", alignItems: "center", gap: 10 }}>
                            <span style={{ textAlign: "right", fontSize: 13, fontWeight: 600, color: v ? primary : alpha(muted, 0.6), transition: "color .2s" }}>{label}</span>
                            <GloSelect value={v} options={opts} onChange={(x) => setDay(d, x)} size="small" searchable={plans.length > 8} style={{ width: "100%" }} />
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

const WeeklyScheduler = gate(WeeklySchedulerReal);
return { Func: WeeklyScheduler, WeeklyScheduler };
