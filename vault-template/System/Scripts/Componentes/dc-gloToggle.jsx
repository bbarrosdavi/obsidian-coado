// ═══════════════════════════════════════════════════════════════════════════════
// DC-GLO-TOGGLE v3 - interruptor ligado a uma chave booleana do frontmatter
//
// - Valor lido do frontmatter de forma reativa (useCurrentFile/useFile): uma
//   edição externa aparece sem recarregar. O clique aplica um valor otimista
//   que some quando o índice confirma.
// - Sem targetFile, grava na nota do próprio bloco (antes gravava na nota
//   ativa, o que errava dentro de embeds).
// - Hover, pressão e brilho são CSS (variáveis por estado).
// ═══════════════════════════════════════════════════════════════════════════════

const { useTheme, getFlashyMode } = await dc.require(dc.fileLink("System/Scripts/Core/dc-themeProvider.jsx"));
const { resolveBackground, hexToRgba, splitBg, stateVars, playClass, useComponentCSS } = await dc.require(
    dc.fileLink("System/Scripts/Componentes/dc-gloButton.jsx")
);

/** Valor booleano de uma chave no frontmatter, reativo, + escrita na nota certa. */
function useFrontmatterBool(targetKey, targetFile) {
    const ownPath = dc.useCurrentPath();
    // useFile(caminho) e useCurrentFile usam a mesma função interna; um hook só, sem condicional.
    const page = dc.useFile(targetFile || ownPath);
    const stored = !!(targetKey && page?.value?.(targetKey));
    const [optimistic, setOptimistic] = dc.useState(null);
    dc.useEffect(() => { if (optimistic !== null && optimistic === stored) setOptimistic(null); }, [stored, optimistic]);
    const value = optimistic !== null ? optimistic : stored;
    const write = async (next) => {
        setOptimistic(next);
        const file = app.vault.getAbstractFileByPath(targetFile || ownPath);
        if (file) await app.fileManager.processFrontMatter(file, fm => { fm[targetKey] = next; });
    };
    return [value, write];
}

function GloToggle({
    targetKey, targetFile = null,
    onLabel = null, offLabel = null, onSub = null, offSub = null,
    showSprite = true, sprite = null, spriteWidth = null, spriteHeight = null, spriteAnimation = null,
    idleBg = null, hoverBg = null, activeBg = null,
    idleBgSize = null, idleBgRepeat = null, idleBgPosition = null,
    hoverBgSize = null, hoverBgRepeat = null, hoverBgPosition = null,
    activeBgSize = null, activeBgRepeat = null, activeBgPosition = null,
    transitionDirection = null,
    glow = true, lift = true, press = true, rainbow = true,
    width = null, padding = null, borderRadius = null,
    variant = "default",
    onChange = null,
    style = {}, className = "", flashy = null,
    themeOverride = null,
}) {
    useComponentCSS();
    const { theme: loaded } = useTheme();
    const theme = themeOverride || loaded;
    const fx = flashy !== null ? flashy : getFlashyMode();
    const [isActive, write] = useFrontmatterBool(targetKey, targetFile);
    const spriteRef = dc.useRef(null);

    const t = (k, d) => theme[k] || d;
    const primary = t("color-primary", "#ff69b4");
    const accent = t("color-accent", "#ffd700");
    const text = t("color-text", "var(--text-normal)");
    const muted = t("color-text-muted", "var(--text-muted, rgba(0,0,0,0.5))");
    const glowHover = t("glow-color-hover", hexToRgba(primary, 0.4));
    const glowActive = t("glow-color-active", hexToRgba(accent, 0.3));

    const spriteUrl = sprite || theme["toggle-sprite"] || theme["bar-sprite"] || null;
    const spW = spriteWidth || theme["toggle-sprite-width"] || theme["bar-sprite-width"] || 50;
    const spH = spriteHeight || theme["toggle-sprite-height"] || theme["bar-sprite-height"] || 50;
    const animation = spriteAnimation || theme["toggle-sprite-click-animation"] || "squish";
    const animDuration = theme["toggle-sprite-click-duration"] || "0.3s";

    const surface = t("color-surface", null);
    const bgOf = (val, key, fb, sz, rp, ps, szK, rpK, psK) => ({
        ...splitBg(resolveBackground(val, null, theme[key] || surface || fb)),
        s: sz || theme[szK] || "auto", r: rp || theme[rpK] || "repeat", p: ps || theme[psK] || "center",
    });
    const borderIdle = theme["card-border"] ? theme["card-border"].replace(/1px solid /, "") : hexToRgba(primary, 0.3);

    let idle = { ...bgOf(idleBg, "toggle-idle-bg", "#2b2b2b", idleBgSize, idleBgRepeat, idleBgPosition, "toggle-idle-bg-size", "toggle-idle-bg-repeat", "toggle-idle-bg-position"), b: `1px solid ${borderIdle}`, sh: "none", t: "none" };
    let hover = bgOf(hoverBg, "toggle-hover-bg", "#3b3b3b", hoverBgSize, hoverBgRepeat, hoverBgPosition, "toggle-hover-bg-size", "toggle-hover-bg-repeat", "toggle-hover-bg-position");
    let on = { ...bgOf(activeBg, "toggle-active-bg", "#4b4b4b", activeBgSize, activeBgRepeat, activeBgPosition, "toggle-active-bg-size", "toggle-active-bg-repeat", "toggle-active-bg-position"), b: `1px solid ${accent}` };
    let pressS = {};
    if (fx) {
        const liftSh = "0 4px 12px rgba(0, 0, 0, 0.25)";
        Object.assign(hover, { t: lift ? "translateY(-2px)" : "none", sh: [glow && `0 0 15px 2px ${glowHover}`, lift && liftSh].filter(Boolean).join(", ") || "none" });
        Object.assign(on, { sh: glow ? `0 0 20px 5px ${glowActive}` : "none" });
        if (press) pressS = { t: "translateY(1px) scale(0.98)" };
    }
    const glass = variant === "liquid-glass";
    if (glass) {
        const n = { i: "none" };
        idle = { ...idle, ...n, c: "transparent", b: `1px solid ${primary}22`, sh: "inset 0 1px 0 rgba(255,255,255,0.15), 0 2px 8px rgba(0,0,0,0.2)", t: "none" };
        hover = { ...n, c: hexToRgba(primary, 0.2), sh: "inset 0 1px 0 rgba(255,255,255,0.22), 0 4px 16px rgba(0,0,0,0.25)", t: "translateY(-2px)" };
        on = { ...n, c: hexToRgba(primary, 0.35), b: `1px solid ${primary}88`, sh: "inset 0 1px 0 rgba(255,255,255,0.28), 0 2px 8px rgba(0,0,0,0.2)", t: "none" };
    }

    const labelOn = onLabel || theme["label-active"] || "Ativo";
    const labelOff = offLabel || theme["label-inactive"] || "Inativo";
    const subOn = onSub || theme["label-active-sub"] || "";
    const subOff = offSub || theme["label-inactive-sub"] || "";
    const labelColor = glass ? (isActive ? primary : muted) : (isActive ? accent : text);
    const rainbowHover = fx && rainbow;

    const handleToggle = async () => {
        if (!targetKey) { console.warn("GloToggle: No targetKey specified"); return; }
        if (showSprite && spriteUrl && fx && animation !== "none") {
            playClass(spriteRef.current, `dc-anim-${animation}`, parseFloat(animDuration) * 1000 + 100);
        }
        const next = !isActive;
        await write(next);
        if (onChange) onChange(next);
    };

    return (
        <div
            onClick={handleToggle}
            data-on={isActive ? "" : undefined}
            className={`dcg-tgl dc-glo-toggle${isActive ? " dc-active" : ""}${rainbowHover ? " dcg-tgl-rb" : ""}${className ? " " + className : ""}`}
            style={{
                ...stateVars("t", { idle, hover, on, press: pressS }),
                display: "flex", alignItems: "center", gap: "15px",
                padding: padding || "15px", width: width || "100%", maxWidth: "220px",
                minHeight: "44px", margin: "15px", boxSizing: "border-box",
                borderRadius: borderRadius || t("border-radius-medium", "12px"),
                position: "relative", overflow: "visible",
                ...(glass ? { backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)" } : null),
                ...style,
            }}
        >
            {showSprite && spriteUrl && (
                <div ref={spriteRef} style={{ position: "relative", width: `${spW}px`, height: `${spH}px`, flexShrink: 0, zIndex: 10, "--dc-anim-duration": animDuration }}>
                    <img src={spriteUrl} alt="" style={{
                        width: `${spW}px`, height: `${spH}px`, objectFit: "contain", pointerEvents: "none", transformOrigin: "center center",
                        transition: "transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.3s ease",
                        transform: isActive ? "scale(1.1)" : "scale(0.85)", opacity: isActive ? 1 : 0.6,
                        filter: isActive && fx && glow ? `drop-shadow(0 0 8px ${glowActive})` : "none",
                    }} />
                </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", zIndex: 2, flex: 1, minWidth: 0 }}>
                <span className={`dcg-tgl-label${rainbowHover && isActive ? " dc-rainbow-text" : ""}`} style={{
                    fontWeight: "bold", fontSize: "14px", color: labelColor,
                    textShadow: rainbowHover && isActive ? "none" : "0 2px 4px rgba(0,0,0,0.9)",
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}>
                    {isActive ? labelOn : labelOff}
                </span>
                {(subOn || subOff) && (
                    <span style={{ fontSize: "0.75em", color: muted, textShadow: "0 1px 3px rgba(0,0,0,0.9)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {isActive ? subOn : subOff}
                    </span>
                )}
            </div>
        </div>
    );
}

const renderedView = (
    <div style={{ padding: "1rem" }}>
        <GloToggle targetKey="demo_toggle" onLabel="Ligado" offLabel="Desligado" />
    </div>
);

return { renderedView, GloToggle, useFrontmatterBool };
