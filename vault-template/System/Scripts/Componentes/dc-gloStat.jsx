// ═══════════════════════════════════════════════════════════════════════════════
// DC-GLO-STAT v3 - métrica (número grande + rótulo) sobre GloCard glass.
// Cor do valor: custom > status (cores do tema) > accent.
// ═══════════════════════════════════════════════════════════════════════════════

const { useTheme } = await dc.require(dc.fileLink("System/Scripts/Core/dc-themeProvider.jsx"));
const { GloCard } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloCard.jsx"));
const { statusColor } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloBadge.jsx"));

const VALUE_SIZE = { small: "1.3em", medium: "1.8em", large: "2.4em" };

function GloStat({ value, label = null, sub = null, icon = null, status = null, color = null, size = "medium", onClick = null, pulse = false, style = {} }) {
    const { theme } = useTheme();
    const accent = color || (status && statusColor(theme, status)) || theme["color-accent"] || "var(--interactive-accent)";
    return (
        <GloCard
            variant="glass" size="small"
            clickable={!!onClick} onClick={onClick || undefined}
            glow={!!onClick} glowColor={accent}
            style={{ minWidth: 0, ...style }}
            bodyStyle={{ padding: "8px 12px" }}
        >
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
                <span className={pulse ? "dc-pulse-anim" : ""} style={{ fontSize: VALUE_SIZE[size] || VALUE_SIZE.medium, fontWeight: 700, color: accent, lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }}>
                    {value}{icon && <span style={{ fontSize: "0.55em", opacity: 0.8, marginLeft: "4px" }}>{icon}</span>}
                </span>
                {label && <div style={{ fontSize: "0.72em", textTransform: "uppercase", letterSpacing: "0.06em", opacity: 0.6, marginTop: "2px" }}>{label}</div>}
                {sub && <div style={{ fontSize: "0.75em", opacity: 0.5, marginTop: "2px" }}>{sub}</div>}
            </div>
        </GloCard>
    );
}

function GloStatGroup({ children, min = "110px", gap = "8px", style = {} }) {
    return <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(${min}, 1fr))`, gap, ...style }}>{children}</div>;
}

function renderedView() {
    return (
        <GloStatGroup>
            <GloStat value={42} label="Ativas" />
            <GloStat value={7} label="Pendentes" status="warning" />
            <GloStat value="99%" label="Saúde" status="success" pulse />
            <GloStat value={3} label="Erros" status="error" onClick={() => new Notice("clicado")} />
        </GloStatGroup>
    );
}

return { GloStat, GloStatGroup, renderedView };
