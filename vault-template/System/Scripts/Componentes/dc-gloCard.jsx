// ═══════════════════════════════════════════════════════════════════════════════
// DC-GLO-CARD v3 - contêiner da família Glo*
// Hover (elevação, brilho, fundo do liquid-glass) é CSS via variáveis por
// estado: passar o mouse não re-renderiza o cartão nem os filhos.
// ═══════════════════════════════════════════════════════════════════════════════

const { useTheme, getFlashyMode } = await dc.require(dc.fileLink("System/Scripts/Core/dc-themeProvider.jsx"));
const { resolveBackground, hexToRgba, stateVars, useComponentCSS, asset } = await dc.require(
    dc.fileLink("System/Scripts/Componentes/dc-gloButton.jsx")
);

const isImg = (bg) => typeof bg === "string" && (bg.startsWith("url(") || /^\s*(repeating-)?(linear|radial|conic)-gradient\(/.test(bg));   // ancorado: não varre base64 enorme
const SIZES = {
    small: { padding: "12px", headerPad: "12px", fontSize: "13px", titleSize: "14px" },
    medium: { padding: null, headerPad: "16px", fontSize: "14px", titleSize: "16px" },
    large: { padding: "24px", headerPad: "20px", fontSize: "15px", titleSize: "18px" },
};
const DIVIDER = "1px solid var(--background-secondary-alt, rgba(0,0,0,0.05))";

function bgLayer(bg, size, repeat, position) {
    const img = isImg(bg);
    return { backgroundImage: img ? asset(bg) : "none", backgroundColor: img ? "transparent" : bg, backgroundSize: size, backgroundRepeat: repeat, backgroundPosition: position };
}

function GloCard({
    children, title = null, subtitle = null, icon = null, footer = null,
    actions = null, variant = "default", size = "medium",
    bg = null, headerBg = null, footerBg = null, borderColor = null,
    width = "100%", minHeight = null, maxHeight = null,
    glow = false, glowColor = null, hover = true, clickable = false,
    collapsible = false, defaultCollapsed = false,
    image = null, imageHeight = "150px", imagePosition = "top",
    onClick = null, onCollapse = null,
    style = {}, className = "", headerStyle = {}, bodyStyle = {}, footerStyle = {}, flashy = null,
    bgSize = null, bgRepeat = null, bgPosition = null,
    hoverBgSize = null, hoverBgRepeat = null, hoverBgPosition = null,
    headerBgSize = null, headerBgRepeat = null, headerBgPosition = null,
    footerBgSize = null, footerBgRepeat = null, footerBgPosition = null,
    transitionDirection = null,
    themeOverride = null,
}) {
    useComponentCSS();
    const { theme: loaded } = useTheme();
    const theme = themeOverride || loaded;
    const fx = flashy !== null ? flashy : getFlashyMode();
    const [collapsed, setCollapsed] = dc.useState(defaultCollapsed);

    const t = (k, d) => theme[k] || d;
    const sizing = SIZES[size] || SIZES.medium;
    const pad = sizing.padding || t("card-padding", "16px");
    const primary = t("color-primary", "#ff69b4");
    const text = t("color-text", "var(--text-normal)");
    const muted = t("color-text-muted", "#888");
    const themeBorder = t("card-border", "1px solid var(--background-modifier-border, rgba(0,0,0,0.1))");
    const themeShadow = t("card-shadow", "0 4px 15px rgba(0,0,0,0.1)");
    const glowShadow = `0 0 20px 5px ${glowColor || hexToRgba(primary, 0.4)}`;

    // Fundo (tamanho/repetição/posição podem mudar no hover)
    const s = bgSize || t("card-bg-size", "auto"), r = bgRepeat || t("card-bg-repeat", "repeat"), p = bgPosition || t("card-bg-position", "center");
    const idle = { s, r, p };
    const hov = { s: hoverBgSize || t("card-hover-bg-size", s), r: hoverBgRepeat || t("card-hover-bg-repeat", r), p: hoverBgPosition || t("card-hover-bg-position", p) };

    const baseBg = bg ? resolveBackground(bg) : t("card-bg-color", t("color-surface", "#2a2a4e"));
    const img = isImg(baseBg);
    let inline = { backgroundImage: "none" };
    switch (variant) {
        case "elevated":
            inline.backgroundImage = img ? asset(baseBg) : "none";
            Object.assign(idle, { c: img ? "transparent" : baseBg, b: "none", sh: "0 8px 30px rgba(0,0,0,0.3)" });
            break;
        case "outlined":
            Object.assign(idle, { c: "transparent", b: borderColor ? `1px solid ${borderColor}` : themeBorder, sh: "none" });
            break;
        case "ghost":
            Object.assign(idle, { c: "transparent", b: "none", sh: "none" });
            break;
        case "glass":
            Object.assign(idle, { c: "rgba(255,255,255,0.05)", b: "1px solid rgba(255,255,255,0.1)", sh: themeShadow });
            inline.backdropFilter = inline.WebkitBackdropFilter = "blur(10px)";
            break;
        case "liquid-glass":
            Object.assign(idle, { c: "transparent", b: `1px solid ${primary}22`, sh: "inset 0 1px 0 rgba(255,255,255,0.15), 0 2px 8px rgba(0,0,0,0.2)" });
            Object.assign(hov, { c: hexToRgba(primary, 0.12), b: `1px solid ${primary}44`, sh: "inset 0 1px 0 rgba(255,255,255,0.22), 0 4px 16px rgba(0,0,0,0.25)" });
            inline.backdropFilter = inline.WebkitBackdropFilter = "blur(2px)";
            break;
        default:
            inline.backgroundImage = img ? asset(baseBg) : "none";
            Object.assign(idle, { c: img ? "transparent" : baseBg, b: borderColor ? `1px solid ${borderColor}` : themeBorder, sh: themeShadow });
    }
    idle.t = "none";
    if (fx && glow) hov.sh = glowShadow;
    if (fx && hover) hov.t = "translateY(-2px)";

    const horizontal = imagePosition === "left" || imagePosition === "right";
    const hasHeader = title || subtitle || icon || actions || collapsible;
    const hasBody = !collapsed && children;
    const hasFooter = !collapsed && footer;

    const toggle = () => { const next = !collapsed; setCollapsed(next); if (onCollapse) onCollapse(next); };

    const imageEl = image && (
        <div style={{
            width: horizontal ? "40%" : "100%", height: horizontal ? "auto" : imageHeight, minHeight: horizontal ? "100%" : undefined,
            backgroundImage: `url(${image})`, backgroundSize: "cover", backgroundPosition: "center", flexShrink: 0,
        }} />
    );

    return (
        <div
            className={`dcg-card ${className}`.trim()}
            data-clickable={clickable ? "" : undefined}
            onClick={clickable && onClick ? onClick : undefined}
            style={{
                ...stateVars("c", { idle, hover: hov }),
                ...inline,
                color: text,
                width, minHeight, maxHeight,
                display: horizontal ? "flex" : "block",
                flexDirection: imagePosition === "right" ? "row-reverse" : "row",
                ...style,
            }}
        >
            {(imagePosition === "top" || imagePosition === "left") && imageEl}
            <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
                {hasHeader && (
                    <div
                        className="dcg-card-head"
                        onClick={collapsible ? toggle : undefined}
                        style={{
                            padding: sizing.headerPad,
                            ...(headerBg ? bgLayer(resolveBackground(headerBg), headerBgSize || t("card-header-bg-size", "auto"), headerBgRepeat || t("card-header-bg-repeat", "repeat"), headerBgPosition || t("card-header-bg-position", "center")) : null),
                            borderBottom: (children || footer) && !collapsed ? DIVIDER : "none",
                            cursor: collapsible ? "pointer" : "default",
                            touchAction: collapsible ? "manipulation" : "auto",
                            ...headerStyle,
                        }}
                    >
                        <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1, minWidth: 0 }}>
                            {icon && <span style={{ fontSize: sizing.titleSize, flexShrink: 0 }}>{icon}</span>}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                {title && <div className="dcg-card-title" style={{ fontSize: sizing.titleSize, color: text }}>{title}</div>}
                                {subtitle && <div className="dcg-card-sub" style={{ color: muted }}>{subtitle}</div>}
                            </div>
                        </div>
                        {(actions || collapsible) && (
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                                {actions}
                                {collapsible && (
                                    <svg className="dcg-card-chev" width="12" height="12" viewBox="0 0 12 12" style={{ color: muted, transform: collapsed ? "rotate(-90deg)" : "none" }}>
                                        <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
                                    </svg>
                                )}
                            </div>
                        )}
                    </div>
                )}
                {hasBody && (
                    <div style={{ padding: pad, fontSize: sizing.fontSize, color: text, flex: 1, overflow: maxHeight ? "auto" : "visible", ...bodyStyle }}>
                        {children}
                    </div>
                )}
                {hasFooter && (
                    <div style={{
                        padding: sizing.headerPad,
                        ...(footerBg ? bgLayer(resolveBackground(footerBg), footerBgSize || t("card-footer-bg-size", "auto"), footerBgRepeat || t("card-footer-bg-repeat", "repeat"), footerBgPosition || t("card-footer-bg-position", "center")) : null),
                        borderTop: DIVIDER, fontSize: "12px", color: muted,
                        ...footerStyle,
                    }}>{footer}</div>
                )}
            </div>
            {(imagePosition === "bottom" || imagePosition === "right") && imageEl}
        </div>
    );
}

return { GloCard, Func: GloCard };
