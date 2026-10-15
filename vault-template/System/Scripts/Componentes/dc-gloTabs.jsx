// ═══════════════════════════════════════════════════════════════════════════════
// DC-GLO-TABS v3 - abas da família Glo*
// - Aba ativa: controlada (activeTab), ligada ao frontmatter (targetKey, reativo,
//   gravando na nota do bloco) ou local.
// - Hover do liquid-glass em CSS (abas usam .dcg-btn com variáveis por estado).
// - Indicador do underline posicionado direto no DOM (sem render extra).
// ═══════════════════════════════════════════════════════════════════════════════

const { useTheme, getFlashyMode } = await dc.require(dc.fileLink("System/Scripts/Core/dc-themeProvider.jsx"));
const { hexToRgba, stateVars, useComponentCSS } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloButton.jsx"));

const SIZES = {
    small: { padding: "6px 12px", fontSize: "12px", gap: "4px" },
    medium: { padding: "10px 16px", fontSize: "14px", gap: "8px" },
    large: { padding: "14px 24px", fontSize: "16px", gap: "12px" },
};
const ALIGN = { center: "center", right: "flex-end", stretch: "stretch" };

function GloTabs({
    tabs = [], activeTab = null, defaultTab = null,
    targetKey = null, targetFile = null,
    variant = "underline", size = "medium", align = "left",
    orientation = "horizontal", width = "100%", tabsWidth = null,
    glow = true, animated = true,
    renderContent = true, contentPadding = "16px",
    onChange = null,
    style = {}, tabsStyle = {}, contentStyle = {}, className = "", flashy = null,
    accentColorOverride = null, surfaceColorOverride = null,
}) {
    useComponentCSS();
    const { theme } = useTheme();
    const fx = flashy !== null ? flashy : getFlashyMode();
    const ownPath = dc.useCurrentPath();
    const page = dc.useFile(targetFile || ownPath);
    const [local, setLocal] = dc.useState(defaultTab || (tabs.length ? tabs[0].id : null));
    const [pending, setPending] = dc.useState(null);
    const barRef = dc.useRef(null), tabEls = dc.useRef({}), indRef = dc.useRef(null);

    const stored = targetKey ? (page?.value?.(targetKey) || null) : null;
    dc.useEffect(() => { if (pending !== null && stored === pending) setPending(null); }, [stored, pending]);
    const currentId = activeTab !== null ? activeTab : (pending ?? stored ?? local);
    const currentTab = tabs.find(t => t.id === currentId) || tabs[0];
    const vertical = orientation === "vertical";

    // Indicador do underline: posição medida e escrita no DOM após o render.
    dc.useEffect(() => {
        if (variant !== "underline" || !animated) return;
        const el = tabEls.current[currentTab?.id], bar = barRef.current, ind = indRef.current;
        if (!el || !bar || !ind) return;
        const b = bar.getBoundingClientRect(), r = el.getBoundingClientRect();
        if (vertical) { ind.style.top = `${r.top - b.top}px`; ind.style.height = `${r.height}px`; }
        else { ind.style.left = `${r.left - b.left + bar.scrollLeft}px`; ind.style.width = `${r.width}px`; }
    }, [currentTab?.id, variant, animated, vertical, tabs.length]);

    const primary = accentColorOverride || theme["color-primary"] || "#ff69b4";
    const text = theme["color-text"] || "var(--text-normal)";
    const muted = theme["color-text-muted"] || "#888";
    const surface = surfaceColorOverride || theme["color-surface"] || "#2a2a4e";
    const sizing = SIZES[size] || SIZES.medium;
    const glowColor = hexToRgba(primary, 0.4);

    const select = async (id) => {
        const tab = tabs.find(t => t.id === id);
        if (!tab || tab.disabled) return;
        setLocal(id);
        if (targetKey) {
            setPending(id);
            const file = app.vault.getAbstractFileByPath(targetFile || ownPath);
            if (file) await app.fileManager.processFrontMatter(file, fm => { fm[targetKey] = id; });
        }
        if (onChange) onChange(id);
    };

    // Valores por estado de cada aba (idle/hover), no vocabulário do .dcg-btn.
    const tabVars = (active) => {
        const n = { i: "none", s: "auto", r: "repeat", p: "center", t: "none", sh: "none", b: "none" };
        switch (variant) {
            case "pills":
                return { idle: { ...n, c: active ? primary : "transparent", fg: active ? "var(--text-on-accent)" : muted, fw: active ? "bold" : "normal", sh: active && fx && glow ? `0 0 15px ${glowColor}` : "none" } };
            case "boxed":
                return { idle: { ...n, c: active ? surface : "transparent", fg: active ? text : muted, fw: active ? "bold" : "normal" } };
            case "minimal":
                return { idle: { ...n, c: "transparent", fg: active ? primary : muted, fw: active ? "bold" : "normal" } };
            case "liquid-glass":
                if (active) return { idle: { ...n, c: hexToRgba(primary, 0.35), fg: primary, fw: 600, b: `1px solid ${primary}88`, sh: "inset 0 1px 0 rgba(255,255,255,0.28), 0 2px 8px rgba(0,0,0,0.2)" } };
                return {
                    idle: { ...n, c: "transparent", fg: muted, fw: 400, b: `1px solid ${primary}22`, sh: "inset 0 1px 0 rgba(255,255,255,0.15), 0 2px 8px rgba(0,0,0,0.2)" },
                    hover: { c: hexToRgba(primary, 0.2), fg: text, sh: "inset 0 1px 0 rgba(255,255,255,0.22), 0 4px 16px rgba(0,0,0,0.25)", t: "translateY(-2px)" },
                };
            default:
                return { idle: { ...n, c: "transparent", fg: active ? text : muted, fw: active ? "bold" : "normal" } };
        }
    };

    return (
        <div className={`dc-glo-tabs dc-glo-tabs-${variant} ${className}`.trim()}
            style={{ width, display: vertical ? "flex" : "block", gap: vertical ? "16px" : 0, ...style }}>
            <div ref={barRef} className="dc-glo-tabs-bar" role="tablist" style={{
                display: "flex", flexDirection: vertical ? "column" : "row",
                alignItems: vertical ? "stretch" : (ALIGN[align] || "flex-start"),
                justifyContent: align === "stretch" ? "stretch" : undefined,
                gap: sizing.gap, width: vertical ? tabsWidth : "100%", flexShrink: 0,
                background: theme["tabs-bg"] || "transparent",
                borderBottom: !vertical && variant === "underline" ? "2px solid var(--background-modifier-border, rgba(0,0,0,0.1))" : "none",
                borderRight: vertical && variant === "underline" ? "2px solid var(--background-modifier-border, rgba(0,0,0,0.1))" : "none",
                position: "relative",
                overflowX: vertical ? "visible" : "auto", overflowY: vertical ? "auto" : "visible",
                scrollSnapType: vertical ? "none" : "x mandatory", scrollbarWidth: "none",
                ...tabsStyle,
            }}>
                {tabs.map(tab => {
                    const active = tab.id === currentTab?.id;
                    return (
                        <button key={tab.id} ref={el => { tabEls.current[tab.id] = el; }}
                            role="tab" aria-selected={active} aria-disabled={tab.disabled} disabled={tab.disabled}
                            onClick={() => select(tab.id)}
                            className="dcg-btn dcg-tab"
                            style={{
                                ...stateVars("b", tabVars(active)),
                                gap: "6px", padding: sizing.padding, fontSize: sizing.fontSize, whiteSpace: "nowrap",
                                outline: "none", position: "relative", zIndex: active ? 1 : 0, textShadow: "none",
                                opacity: tab.disabled ? 0.4 : 1,
                                borderRadius: variant === "pills" ? "20px" : variant === "boxed" ? "8px 8px 0 0" : variant === "liquid-glass" ? "8px" : 0,
                                ...(variant === "boxed" ? { borderBottom: active ? `2px solid ${primary}` : "2px solid transparent", marginBottom: "-2px" } : null),
                                ...(variant === "liquid-glass" ? { backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)" } : null),
                                ...(variant === "underline" && !animated ? { borderBottom: active ? `2px solid ${primary}` : "2px solid transparent" } : null),
                                ...(variant === "underline" && animated ? { paddingBottom: sizing.padding.split(" ")[0] } : null),
                                flex: align === "stretch" ? 1 : undefined, justifyContent: align === "stretch" ? "center" : undefined,
                                minHeight: "44px", minWidth: "44px", scrollSnapAlign: "start", flexShrink: 0,
                            }}>
                            {tab.icon && <span>{tab.icon}</span>}
                            <span>{tab.label}</span>
                        </button>
                    );
                })}
                {variant === "underline" && animated && (
                    <div ref={indRef} className="dc-glo-tabs-indicator" style={{
                        position: "absolute", background: primary, transition: "all 0.25s ease",
                        ...(vertical ? { right: 0, width: "2px" } : { bottom: 0, height: "2px" }),
                        boxShadow: fx && glow ? `0 0 10px ${glowColor}` : "none",
                    }} />
                )}
            </div>
            {renderContent && currentTab && (
                <div role="tabpanel" className="dc-glo-tabs-content" style={{
                    flex: 1, padding: contentPadding, color: text, fontSize: sizing.fontSize,
                    animation: fx ? "dc-tab-fade 0.2s ease" : "none", ...contentStyle,
                }}>
                    {currentTab.content}
                </div>
            )}
        </div>
    );
}

const renderedView = (
    <GloTabs tabs={[{ id: "a", label: "Primeira", content: "Conteúdo A" }, { id: "b", label: "Segunda", content: "Conteúdo B" }]} />
);

return { renderedView, GloTabs };
