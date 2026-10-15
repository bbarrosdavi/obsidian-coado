// ═══════════════════════════════════════════════════════════════════════════════
// WATER TRACKER v3 (Hidratação)
// Água do dia contra a meta (atividade `water` do Settings): barra arrastável e
// botões +250, +500 e +garrafa (increment).
//
// Grava na nota do dia: water-ml (inteiro). Mesmo formato.
// Correções: durante uma gravação as chamadas seguintes eram descartadas (num
// arrasto só o primeiro valor era salvo); o valor não acompanhava a troca de
// dia. Agora: useDayFrontmatter (agrupa e grava o último valor ao soltar).
// ═══════════════════════════════════════════════════════════════════════════════

const { useTheme } = await dc.require(dc.fileLink("System/Scripts/Core/dc-themeProvider.jsx"));
const { resolveDateStr, useDayFrontmatter, getActivities } = await dc.require(dc.fileLink("System/Scripts/Core/dc-dateContext.jsx"));
const { GloButton, alpha } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloButton.jsx"));
const { GloBar } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloBar.jsx"));
const { GloBadge } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloBadge.jsx"));

function WaterTracker({ targetDate }) {
    const { theme, settings } = useTheme();
    const dateStr = resolveDateStr(targetDate);
    const { fm, save, flush } = useDayFrontmatter(dateStr, 400);
    const w = getActivities().find(a => a.id === "water") || {};
    const goal = w.goal || 3000, bottle = w.increment || 500, unit = w.unit || "ml";
    const color = w.color || theme["color-blue"] || theme["color-primary"] || "#4facfe";
    const label = w.label || w.name || "Hidratação";
    const ml = Number(fm["water-ml"]) || 0;
    const met = ml >= goal;
    const set = (v, now = false) => save({ "water-ml": Math.max(0, Math.round(v)) }, now);
    const add = (n) => { set(ml + n, true); new Notice(`+${n}${unit}`); };
    const bg = settings?.widgetBackgrounds !== false;
    const primary = theme["color-primary"] || "#7c3aed";

    return (
        <div style={{ padding: 14, borderRadius: 12, background: bg ? (theme["color-surface"] || "var(--background-secondary)") : "transparent", border: bg ? `1px solid ${alpha(primary, 0.2)}` : "none" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color }}>{label}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "var(--font-monospace)", fontVariantNumeric: "tabular-nums" }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: met ? theme["color-success"] : color }}>{ml}</span>
                    <span style={{ color: "var(--text-muted)", fontSize: 13 }}>/ {goal} {unit}</span>
                    {met && <GloBadge status="success" size="small" variant="soft">meta</GloBadge>}
                </div>
            </div>
            <div style={{ marginBottom: 12 }}>
                <GloBar value={ml} max={goal} draggable showSprite showValue={false} height="22px"
                    fillGradient={`linear-gradient(90deg, ${alpha(color, 0.8)}, ${color})`}
                    onChange={(v) => set(v)} onDragEnd={() => flush()} />
            </div>
            <div style={{ display: "flex", gap: 6 }}>
                <GloButton size="small" variant="liquid-glass" glow={false} label={`+250${unit}`} onClick={() => add(250)} style={{ flex: 1 }} />
                <GloButton size="small" variant="liquid-glass" glow={false} label={`+500${unit}`} onClick={() => add(500)} style={{ flex: 1 }} />
                <GloButton size="small" variant="liquid-glass" glow={false} label={`+${bottle}${unit} garrafa`} onClick={() => add(bottle)} style={{ flex: 1.4 }} />
            </div>
        </div>
    );
}

return { Func: WaterTracker, WaterTracker };
