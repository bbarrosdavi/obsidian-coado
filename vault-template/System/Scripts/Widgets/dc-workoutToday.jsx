// ═══════════════════════════════════════════════════════════════════════════════
// WORKOUT TODAY v3 (Movimento)
// Treino do dia: o `exercise` da nota do dia ou o agendado no Planejador de
// Exercício para o dia da semana; aquecimento, exercícios (séries, repetições,
// carga), desaquecimento; marcar como feito.
//
// Grava na nota do dia numa escrita só: workout-completed, exercise-minutes
// (duração do plano ou 0) e exercise ("[[Plano]]" ou null). Mesmo formato.
// Correções: a chave do planejador usava o nome do dia no idioma do moment
// (pt-br: "schedule-sexta-feira"), mas o planejador usa inglês
// ("schedule-friday"), então o dia aparecia sempre como descanso; hooks depois
// de retornos antecipados.
// ═══════════════════════════════════════════════════════════════════════════════

const { useTheme } = await dc.require(dc.fileLink("System/Scripts/Core/dc-themeProvider.jsx"));
const { resolveDateStr, useDayFrontmatter } = await dc.require(dc.fileLink("System/Scripts/Core/dc-dateContext.jsx"));
const { GloButton, alpha } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloButton.jsx"));
const { GloBadge } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloBadge.jsx"));

const PLANNER_PATH = "System/Planejadores/Planejador de Exercicio.md";
const nameOf = (raw) => {
    if (!raw) return "Sem nome";
    let v = raw;
    if (typeof raw === "object") v = raw.link || (typeof raw.fileName === "function" ? raw.fileName() : raw.path) || raw;
    return String(v).replace(/\[\[(?:.*?\|)?(.*?)\]\]/g, "$1").replace(/[\[\]]/g, "");
};
const pathOf = (raw) => {
    if (!raw) return "";
    let v = raw;
    if (typeof raw === "object") v = raw.link || raw.path || raw.file?.path || raw;
    return String(v).replace(/\[\[(.*?)(?:\|.*)?\]\]/g, "$1").replace(/[\[\]]/g, "");
};
const open = (raw) => { const p = pathOf(raw); if (p && p !== "undefined") app.workspace.openLinkText(p, "", false); else new Notice("Nota não encontrada"); };

function Section({ title, color, items }) {
    if (!items?.length) return null;
    return (
        <div style={{ marginBottom: 10, padding: "8px 10px", borderRadius: 8, background: alpha(color, 0.07) }}>
            <div style={{ fontSize: 11, fontWeight: 700, color, marginBottom: 4, textTransform: "uppercase", letterSpacing: ".04em" }}>{title}</div>
            {items.map((it, i) => <div key={i} onClick={() => open(it)} className="dcg-link" style={{ fontSize: 12, padding: "1px 0 1px 4px", cursor: "pointer" }}>{nameOf(it)}</div>)}
        </div>
    );
}

function WorkoutWidget({ targetDate }) {
    const { theme, settings } = useTheme();
    const dateStr = resolveDateStr(targetDate);
    const { fm, save, exists } = useDayFrontmatter(dateStr, 0);
    const pages = dc.useQuery('@page and path("System/Planejadores")');
    const primary = theme["color-primary"] || "#7c3aed", accent = theme["color-accent"] || "#f59e0b", success = theme["color-success"] || "#10b981";
    const muted = theme["color-text-muted"] || "var(--text-muted)", error = theme["color-red"] || "#ef4444";
    const bg = settings?.widgetBackgrounds !== false;
    const planner = pages.find(p => p.$path.endsWith(PLANNER_PATH));
    const m = window.moment(dateStr);
    const dayKey = m.clone().locale("en").format("dddd").toLowerCase();
    const dayLabel = (() => { const s = m.format("dddd"); return s.charAt(0).toUpperCase() + s.slice(1); })();
    const link = fm["exercise"] || (planner ? planner.value(`schedule-${dayKey}`) : null);
    const wpath = link ? pathOf(link) : "";
    const workout = wpath ? pages.find(p => p.$path === wpath || p.$path.endsWith(wpath) || p.$name === wpath) : null;
    const done = !!fm["workout-completed"];
    const box = { padding: 14, borderRadius: 12, background: bg ? (theme["color-surface"] || "var(--background-secondary)") : "transparent" };

    if (!planner) return <div style={{ ...box, border: `1px solid ${error}`, color: error, textAlign: "center" }}>Planejador não encontrado: <code>{PLANNER_PATH}</code></div>;
    if (!link) return (
        <div style={{ ...box, textAlign: "center", border: bg ? "1px dashed var(--background-modifier-border)" : "none" }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: primary, marginBottom: 2 }}>Dia de descanso</div>
            <div style={{ fontSize: 12, color: muted }}>Nenhum treino agendado para {dayLabel.toLowerCase()}</div>
        </div>
    );
    if (!workout) return <div style={{ ...box, color: muted }}>Plano não encontrado: <strong>{wpath}</strong></div>;

    const v = (k, d) => workout.value(k) ?? d;
    const duration = v("duration", 0), exercises = v("exercises", []) || [], warmup = v("warmup", []) || [], cooldown = v("cooldown", []) || [];
    const toggle = () => {
        const next = !done;
        save({ "workout-completed": next, "exercise-minutes": next ? (Number(duration) || 0) : 0, "exercise": next ? `[[${workout.$name}]]` : null }, true);
        if (next) new Notice(`Registrado: ${workout.$name} (${duration} min)`);
    };

    return (
        <div style={{ ...box, border: bg ? `1px solid ${alpha(done ? success : primary, 0.2)}` : "none" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 12 }}>
                <div>
                    <h3 onClick={() => open(workout.$path)} style={{ margin: 0, fontSize: 15, fontWeight: 600, cursor: "pointer" }}>{workout.$name}</h3>
                    <div style={{ fontSize: 11, color: muted, textTransform: "uppercase", marginTop: 2, letterSpacing: ".04em" }}>{dayLabel} · {duration} min · foco {String(v("focus", "geral"))}</div>
                </div>
                {exists
                    ? <GloButton size="small" variant="liquid-glass" glow={false} active={done} label={done ? "Treino feito" : "Marcar feito"} onClick={toggle} />
                    : <span style={{ fontSize: 10, color: error }}>Crie a nota do dia</span>}
            </div>
            <Section title="Aquecimento" color={theme["color-warning"] || accent} items={warmup} />
            {exercises.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: primary, textTransform: "uppercase", letterSpacing: ".04em", display: "flex", gap: 6, alignItems: "center" }}>
                        Exercícios <GloBadge variant="soft" color={primary} size="small">{exercises.length}</GloBadge>
                    </div>
                    {exercises.map((ex, i) => (
                        <div key={i} style={{ padding: "6px 10px", borderRadius: 6, background: "var(--background-modifier-hover, rgba(0,0,0,0.04))" }}>
                            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                <span style={{ opacity: 0.45, fontSize: 11, width: 16, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{i + 1}.</span>
                                <span onClick={() => open(ex)} className="dcg-link" style={{ fontWeight: 600, fontSize: 13, cursor: "pointer" }}>{nameOf(ex)}</span>
                            </div>
                            {(ex?.sets || ex?.reps || ex?.weight) && (
                                <div style={{ display: "flex", gap: 12, fontSize: 11, color: muted, marginLeft: 24 }}>
                                    {ex?.sets && <span><strong style={{ color: accent }}>{ex.sets}</strong> séries</span>}
                                    {ex?.reps && <span><strong style={{ color: accent }}>{ex.reps}</strong> reps</span>}
                                    {ex?.weight && <span>carga {ex.weight}</span>}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
            <Section title="Desaquecimento" color={theme["color-blue"] || primary} items={cooldown} />
        </div>
    );
}

return { Func: WorkoutWidget, WorkoutWidget };
