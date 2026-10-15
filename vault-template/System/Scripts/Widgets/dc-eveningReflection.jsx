// ═══════════════════════════════════════════════════════════════════════════════
// EVENING REFLECTION v3 - versão única (antes: dc-eveningReflection e
// dc-eveningReflectionV5)
// Humor noturno (1 a 5) e emoções do dia (chips + emoções próprias).
// `flat` = forma compacta da Home (sem campo de emoção própria, como antes).
//
// Grava na nota do dia: mood-evening (número) e emotions (lista de texto).
// Mecanismos: useDayFrontmatter; chips e marcadores com hover em CSS; cores das
// emoções derivadas do tema (antes: 12 cores fixas).
// ═══════════════════════════════════════════════════════════════════════════════

const { useTheme, deriveChartColors } = await dc.require(dc.fileLink("System/Scripts/Core/dc-themeProvider.jsx"));
const { resolveDateStr, useDayFrontmatter, getActivities } = await dc.require(dc.fileLink("System/Scripts/Core/dc-dateContext.jsx"));
const { GloBadge } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloBadge.jsx"));
const { GloButton, alpha } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloButton.jsx"));
const { GloRating } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloRating.jsx"));

const POSITIVAS = ["Animado", "Confiante", "Grato", "Calmo", "Satisfeito", "Aliviado"];
const NEGATIVAS = ["Estressado", "Frustrado", "Ansioso", "Cansado", "Triste", "Entediado"];

// Cores das emoções do original (fixas, não vêm do tema).
const EMOTION_COLORS = { Animado: "#FFD700", Confiante: "#FFA500", Grato: "#32CD32", Calmo: "#87CEEB", Satisfeito: "#40E0D0", Aliviado: "#98FB98", Estressado: "#FF6347", Frustrado: "#FF4500", Ansioso: "#FF69B4", Cansado: "#708090", Triste: "#6495ED", Entediado: "#A9A9A9" };

// Cápsula como no original: borda apagada quando inativa; ativa com a cor, fundo leve e brilho curto.
function Chip({ label, color, active, flat, onClick }) {
    const muted = "var(--text-muted)";
    return (
        <button onClick={onClick} className="dcg-chip" style={{
            display: "inline-flex", alignItems: "center", gap: flat ? 5 : 6, padding: flat ? "3px 8px" : "6px 12px",
            border: `1px solid ${active ? color : alpha(muted, 0.2)}`, borderRadius: flat ? 12 : 20,
            background: active ? alpha(color, 0.13) : "transparent", color: active ? "var(--text-normal)" : muted,
            fontSize: 12, fontWeight: 500, cursor: "pointer", lineHeight: 1.2, height: "auto",
            boxShadow: active ? `0 0 ${flat ? 6 : 10}px ${alpha(color, 0.4)}` : "none",
        }}>
            <span style={{ width: flat ? 6 : 8, height: flat ? 6 : 8, borderRadius: "50%", background: color, opacity: active ? 1 : 0.6 }} />
            {label}
        </button>
    );
}

function EveningReflection({ targetDate, flat = false }) {
    const { theme, settings } = useTheme();
    const dateStr = resolveDateStr(targetDate);
    const { fm, save } = useDayFrontmatter(dateStr, 200);
    const [custom, setCustom] = dc.useState("");
    const primary = theme["color-primary"] || "#7c3aed";
    const act = getActivities().find(a => a.id === "mood-evening");
    const moodColor = act?.color || "#A29BFE";
    const label = act?.name || "Humor noturno";
    const humor = fm["mood-evening"] || 0;
    const emotions = Array.isArray(fm["emotions"]) ? fm["emotions"] : (fm["emotions"] ? [String(fm["emotions"])] : []);
    // Mesmo par de chaves que o original gravava a cada mudança.
    const write = (h, list) => save({ "mood-evening": h, "emotions": list });
    const toggle = (e) => write(humor, emotions.includes(e) ? emotions.filter(x => x !== e) : [...emotions, e]);
    const addCustom = () => { const v = custom.trim(); if (v && !emotions.includes(v)) write(humor, [...emotions, v]); setCustom(""); };
    const own = emotions.filter(e => !POSITIVAS.includes(e) && !NEGATIVAS.includes(e));
    const bg = !flat && settings?.widgetBackgrounds !== false;

    return (
        <div style={{
            background: bg ? (theme["color-surface"] || "var(--background-secondary)") : "transparent",
            border: bg ? `1px solid ${alpha(primary, 0.2)}` : "none", borderRadius: 12, padding: flat ? "4px 0 0" : 16,
        }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: flat ? 4 : 14, gap: 6 }}>
                <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: primary }}>Reflexão noturna</h4>
                {emotions.length > 0 && <GloBadge color={theme["color-accent"]} size="small" variant="soft">{emotions.length} {emotions.length === 1 ? "emoção" : "emoções"}</GloBadge>}
            </div>
            <div style={{ marginBottom: flat ? 6 : 14 }}>
                <GloRating label={label} color={moodColor} shape="moon" value={humor} size={flat ? 15 : 22} onChange={(v) => write(v, emotions)} />
            </div>
            <div style={{ display: flat ? "flex" : "grid", flexWrap: "wrap", gridTemplateColumns: flat ? undefined : "repeat(auto-fill, minmax(100px, 1fr))", gap: flat ? "3px 4px" : 8, marginBottom: flat ? 2 : 14 }}>
                {[...POSITIVAS, ...NEGATIVAS].map(e => <Chip key={e} label={e} color={EMOTION_COLORS[e]} active={emotions.includes(e)} flat={flat} onClick={() => toggle(e)} />)}
            </div>
            {own.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                    {own.map(e => (
                        <span key={e} className="dcg-tag-x" onClick={() => toggle(e)} title="Remover" style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, cursor: "pointer", display: "inline-flex", gap: 4, alignItems: "center", background: alpha(theme["color-text-muted"] || "#888", 0.15) }}>
                            {e} <span style={{ opacity: 0.7 }}>×</span>
                        </span>
                    ))}
                </div>
            )}
            {!flat && (
                <div style={{ display: "flex", gap: 8, alignItems: "center", borderTop: "1px solid var(--background-modifier-border)", paddingTop: 12, marginTop: 10 }}>
                    <input type="text" placeholder="+ emoção própria" value={custom} onInput={e => setCustom(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }}
                        style={{ flex: 1, background: "transparent", border: "none", borderBottom: "1px dashed var(--background-modifier-border)", padding: "6px 0", fontSize: 13, outline: "none", boxShadow: "none" }} />
                    {custom.trim() && <GloButton label="Adicionar" size="small" variant="liquid-glass" onClick={addCustom} />}
                </div>
            )}
        </div>
    );
}

return { Func: EveningReflection, EveningReflection };
