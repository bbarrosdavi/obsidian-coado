// ═══════════════════════════════════════════════════════════════════════════════
// DC-GLO-BADGE v3 - etiqueta/chip da família Glo*
// Cores de status vêm do tema (color-success/warning/error, azul, texto
// apagado); transparências por color-mix, que aceita qualquer formato de cor.
// ═══════════════════════════════════════════════════════════════════════════════

const { useTheme, getFlashyMode } = await dc.require(dc.fileLink("System/Scripts/Core/dc-themeProvider.jsx"));
const { alpha, useComponentCSS } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloButton.jsx"));

/** Cor de cada status no tema atual. "primary" usa a cor primária. */
function statusColor(theme, status) {
    switch (status) {
        case "success": return theme["color-success"] || theme["color-green"] || "#10b981";
        case "warning": return theme["color-warning"] || theme["color-orange"] || "#f59e0b";
        case "error": return theme["color-error"] || theme["color-red"] || "#ef4444";
        case "info": return theme["color-blue"] || theme["color-cyan"] || "#3b82f6";
        case "neutral": return theme["color-text-muted"] || "#888888";
        case "primary": return theme["color-primary"] || "#ff69b4";
        default: return null;
    }
}

const SIZES = {
    small: { pad: "2px 8px", padT: "8px 12px", fs: "10px", gap: "4px", dot: "6px", minT: "32px" },
    medium: { pad: "4px 12px", padT: "10px 14px", fs: "12px", gap: "6px", dot: "8px", minT: "36px" },
    large: { pad: "6px 16px", padT: "12px 18px", fs: "14px", gap: "8px", dot: "10px", minT: "44px" },
};

function GloBadge({
    children, label = null, icon = null, iconRight = null,
    variant = "filled", size = "medium", status = null, color = null,
    rounded = true, clickable = false, removable = false,
    onClick = null, onRemove = null, glow = false, pulse = false,
    style = {}, className = "", flashy = null,
}) {
    useComponentCSS();
    const { theme } = useTheme();
    const fx = flashy !== null ? flashy : getFlashyMode();
    const sz = SIZES[size] || SIZES.medium;
    const touch = clickable || removable;
    const primary = theme["color-primary"] || "#ff69b4";

    // cor base: custom > status > primária (fundo do chip do tema quando sem status)
    const base = color || statusColor(theme, status) || primary;
    const softBg = (color || status) ? alpha(base, 0.15) : (theme["chip-bg"] || alpha(primary, 0.1));
    const border = alpha(base, 0.3);

    let look;
    switch (variant) {
        case "outlined": look = { background: "transparent", border: `1px solid ${border}`, color: base }; break;
        case "soft": look = { background: softBg, border: "none", color: base }; break;
        case "dot": look = { background: "transparent", border: "none", color: theme["color-text"] || "var(--text-normal)" }; break;
        default: look = { background: base, border: "none", color: "var(--text-normal)" };
    }
    const padding = touch ? sz.padT : sz.pad;
    const content = children || label;
    const iconBox = { fontSize: sz.fs, display: "flex", alignItems: "center" };
    const xSize = Math.max(parseInt(sz.fs) + 8, 24);

    return (
        <span
            className={`dcg-badge dc-glo-badge dc-glo-badge-${variant}${pulse && fx ? " dc-pulse-anim" : ""}${className ? " " + className : ""}`}
            onClick={clickable && onClick ? onClick : undefined}
            style={{
                gap: sz.gap,
                padding: variant === "dot" ? `${padding.split(" ")[0]} 0` : padding,
                minHeight: touch ? sz.minT : "auto",
                fontSize: sz.fs,
                borderRadius: rounded ? (theme["chip-border-radius"] || "20px") : "6px",
                cursor: clickable ? "pointer" : "default",
                touchAction: clickable ? "manipulation" : "auto",
                ...look,
                boxShadow: fx && glow ? `0 0 12px ${alpha(base, 0.4)}` : "none",
                ...style,
            }}
        >
            {variant === "dot" && (
                <span style={{ width: sz.dot, height: sz.dot, borderRadius: "50%", background: base, flexShrink: 0, boxShadow: fx && glow ? `0 0 8px ${base}` : "none" }} />
            )}
            {icon && variant !== "dot" && <span style={iconBox}>{icon}</span>}
            {content && <span>{content}</span>}
            {iconRight && <span style={iconBox}>{iconRight}</span>}
            {removable && (
                <span className="dcg-badge-x" style={{ width: xSize + "px", height: xSize + "px" }}
                    onClick={(e) => { e.stopPropagation(); if (onRemove) onRemove(); }}>
                    <svg width={parseInt(sz.fs)} height={parseInt(sz.fs)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                </span>
            )}
        </span>
    );
}

function GloBadgeGroup({ children, gap = "8px", wrap = true, style = {}, className = "" }) {
    return (
        <div className={`dc-glo-badge-group ${className}`.trim()}
            style={{ display: "flex", flexWrap: wrap ? "wrap" : "nowrap", gap, alignItems: "center", ...style }}>
            {children}
        </div>
    );
}

const renderedView = (
    <GloBadgeGroup>
        <GloBadge label="primária" variant="soft" status="primary" />
        <GloBadge label="ok" variant="soft" status="success" />
        <GloBadge label="atenção" variant="outlined" status="warning" />
        <GloBadge label="erro" variant="dot" status="error" />
        <GloBadge label="info" status="info" />
        <GloBadge label="remover" variant="soft" removable onRemove={() => new Notice("removido")} />
    </GloBadgeGroup>
);

return { renderedView, GloBadge, GloBadgeGroup, statusColor };
