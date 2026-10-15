// ═══════════════════════════════════════════════════════════════════════════════
// SLEEP TRACKER v3 (check-in matinal) - versão única (antes: dc-sleepTracker e
// dc-sleepTrackerV5)
// Horários de dormir e acordar em mostradores, horas dormidas contra a meta do
// Settings, qualidade do sono, humor e energia (1 a 5).
//
// Grava na nota do dia: sleep-bedtime / sleep-wakeup (com sleep-hours),
// sleep-quality, mood, energy. Mesmas chaves e formatos de antes.
// Mecanismos: useDayFrontmatter (reativo, otimista, gravação agrupada: duas
// avaliações seguidas não se perdem); avaliações em GloRating (sem emojis).
// Campo não registrado aparece vazio, não com um valor padrão.
// ═══════════════════════════════════════════════════════════════════════════════

const { useTheme } = await dc.require(dc.fileLink("System/Scripts/Core/dc-themeProvider.jsx"));
const { resolveDateStr, useDayFrontmatter, getActivities } = await dc.require(dc.fileLink("System/Scripts/Core/dc-dateContext.jsx"));
const { GloBadge } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloBadge.jsx"));
const { GloDial } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloDial.jsx"));
const { GloRating } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloRating.jsx"));
const { alpha } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloButton.jsx"));

const toH = (t) => { if (!t || typeof t !== "string") return null; const [h, m] = t.split(":").map(Number); return Number.isFinite(h) ? h + (m || 0) / 60 : null; };
/** Horas entre dormir e acordar (atravessa a meia-noite), com 1 casa. */
function sleepHours(bed, wake) {
    const s = toH(bed), e = toH(wake);
    if (s === null || e === null) return null;
    return Number(((e < s ? e + 24 : e) - s).toFixed(1));
}

function SleepTracker({ targetDate }) {
    const { theme } = useTheme();
    const dateStr = resolveDateStr(targetDate);
    const { fm, save } = useDayFrontmatter(dateStr);
    const acts = getActivities();
    const primary = theme["color-primary"] || "#7c3aed";
    const accent = theme["color-accent"] || "#f59e0b";
    const success = theme["color-success"] || "#10b981";
    const muted = theme["color-text-muted"] || "var(--text-muted)";
    const conf = (id, fallback) => { const a = acts.find(x => x.id === id); return { color: a?.color || primary, label: a?.name || fallback }; };
    const goal = acts.find(a => a.id === "sleep")?.goal || 8;

    const bed = fm["sleep-bedtime"] || null, wake = fm["sleep-wakeup"] || null;
    const hours = sleepHours(bed || "23:00", wake || "07:00");
    const recorded = !!(bed || wake);
    const goalMet = recorded && hours >= goal;

    const setBed = (v) => save({ "sleep-bedtime": v, "sleep-hours": sleepHours(v, wake || "07:00") });
    const setWake = (v) => save({ "sleep-wakeup": v, "sleep-hours": sleepHours(bed || "23:00", v) });
    const rate = (key) => (v) => save({ [key]: v });
    const q = conf("sleep-quality", "Qualidade do sono"), m = conf("mood", "Humor"), e = conf("energy", "Energia");

    return (
        <div style={{ width: "100%", boxSizing: "border-box" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: primary }}>Check-in matinal</h4>
                <GloBadge color={goalMet ? success : null} status={goalMet ? null : "neutral"} size="small" variant={goalMet ? "filled" : "soft"}>
                    {goalMet ? "Meta atingida" : recorded ? `${hours}/${goal}h` : `meta ${goal}h`}
                </GloBadge>
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: 10, alignItems: "center", marginBottom: 10 }}>
                <GloDial label="Dormir" value={bed || "23:00"} onChange={setBed} color={primary} mode="time" snapMinutes={15} size={100} />
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "6px 10px", borderRadius: 10, background: goalMet ? alpha(success, 0.15) : alpha(primary, 0.08) }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: goalMet ? success : primary, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{recorded ? hours : "—"}</div>
                    <div style={{ fontSize: 11, color: goalMet ? success : muted, marginTop: 2 }}>horas</div>
                </div>
                <GloDial label="Acordar" value={wake || "07:00"} onChange={setWake} color={accent} mode="time" snapMinutes={15} size={100} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <GloRating label={q.label} color={q.color} shape="star" value={fm["sleep-quality"] || 0} onChange={rate("sleep-quality")} />
                <GloRating label={m.label} color={m.color} shape="face" value={fm["mood"] || 0} onChange={rate("mood")} />
                <GloRating label={e.label} color={e.color} shape="bolt" value={fm["energy"] || 0} onChange={rate("energy")} />
            </div>
        </div>
    );
}

return { Func: SleepTracker, SleepTracker, sleepHours };
