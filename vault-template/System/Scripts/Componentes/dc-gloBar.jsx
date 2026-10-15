// ═══════════════════════════════════════════════════════════════════════════════
// DC-GLO-BAR v3 - barra de progresso da família Glo* (horizontal ou vertical)
//
// - Arrasto imperativo: durante o arrasto o preenchimento, o sprite e o texto
//   do valor são escritos direto no DOM por rAF; nenhum render por movimento.
//   onChange continua ao vivo, no máximo uma vez por quadro. O valor final é
//   confirmado (estado + frontmatter) ao soltar.
// - Pointer Events com captura: mouse, caneta e toque pelo mesmo caminho.
// - Valor de frontmatter reativo; sem targetFile grava na nota do bloco.
// ═══════════════════════════════════════════════════════════════════════════════

const { useTheme, getFlashyMode } = await dc.require(dc.fileLink("System/Scripts/Core/dc-themeProvider.jsx"));
const { resolveBackground, splitBg, useComponentCSS } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloButton.jsx"));

const toNum = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

function GloBar({
    value = null, max = 100, targetKey = null, targetFile = null,
    vertical = false,
    label = null, showValue = true, valueFormat = null, showPercentage = false,
    showSprite = true, sprite = null, spriteWidth = null, spriteHeight = null,
    clickAnimation = null, clickDuration = null,
    draggable = false, step = 1,
    trackBg = null, fillGradient = null,
    height = null, length = null, borderRadius = null, width = "100%",
    trackBgSize = null, trackBgRepeat = null, trackBgPosition = null,
    fillBgSize = null, fillBgRepeat = null, fillBgPosition = null,
    transitionDirection = null,
    onChange = null, onDragStart = null, onDragEnd = null,
    style = {}, className = "", flashy = null,
    themeOverride = null,
}) {
    useComponentCSS();
    const { theme: loaded } = useTheme();
    const theme = themeOverride || loaded;
    const ownPath = dc.useCurrentPath();
    const page = dc.useFile(targetFile || ownPath);
    const fillRef = dc.useRef(null), spriteRef = dc.useRef(null), animRef = dc.useRef(null), textRef = dc.useRef(null), trackRef = dc.useRef(null);
    const drag = dc.useRef(null);   // { pid, x0, y0, moved, v, raf }
    const [committed, setCommitted] = dc.useState(null);   // valor otimista após soltar

    const source = value !== null ? toNum(value) : targetKey ? toNum(page?.value?.(targetKey)) : 0;
    dc.useEffect(() => {
        if (committed === null) return;
        if (committed === source) { setCommitted(null); return; }
        const id = setTimeout(() => setCommitted(null), 1500);
        return () => clearTimeout(id);
    }, [committed, source]);
    const current = committed !== null ? committed : source;

    const fx = flashy !== null ? flashy : getFlashyMode();
    const spriteUrl = sprite || theme["bar-sprite"] || null;
    const spW = spriteWidth || parseInt(theme["bar-sprite-width"]) || 34;
    const spH = spriteHeight || parseInt(theme["bar-sprite-height"]) || 21;
    const animation = clickAnimation || theme["bar-sprite-click-animation"] || "squish";
    const animDuration = clickDuration || theme["bar-sprite-click-duration"] || "0.3s";

    const track = splitBg(resolveBackground(trackBg, null, theme["bar-track-bg"] || "#1a1a2e"));
    let fillBg = resolveBackground(fillGradient, null, theme["bar-fill-gradient"] || "linear-gradient(to right, #ff69b4, #ff1493)");
    if (vertical && fillBg.includes("gradient(") && !fillGradient && theme["bar-fill-gradient"]) fillBg = fillBg.replace("to right", "to top");
    const fill = splitBg(fillBg);
    const thick = height || theme["bar-height"] || "14px";
    const len = length || (vertical ? "150px" : "100%");
    const radius = borderRadius || theme["bar-border-radius"] || "6px";

    const pct = (v) => Math.min(100, Math.max(0, (v / max) * 100));
    const fmt = (v) => valueFormat ? valueFormat(v, max) : showPercentage ? `${Math.round((v / max) * 100)}%` : `${Math.round(v)}/${max}`;
    const clampStep = (v) => Math.min(max, Math.max(0, Math.round(v / step) * step));
    const fromPoint = (x, y) => {
        const r = drag.current?.rect || trackRef.current.getBoundingClientRect();
        const k = vertical ? (r.bottom - y) / r.height : (x - r.left) / r.width;
        return Math.min(1, Math.max(0, k)) * max;
    };

    // Escrita direta no DOM durante o arrasto.
    const paint = (v) => {
        const p = pct(v);
        if (fillRef.current) fillRef.current.style[vertical ? "height" : "width"] = `${p}%`;
        if (spriteRef.current) {
            if (vertical) spriteRef.current.style.bottom = `calc(${p}% - ${spH / 2}px)`;
            else spriteRef.current.style.left = `calc(${p}% - ${spW / 2}px)`;
        }
        // Troca o data do nó de texto existente: textContent recriaria o nó
        // (mutação de childList), com invalidação de estilo bem mais cara.
        const tn = textRef.current?.firstChild;
        if (tn && tn.nodeType === 3) tn.data = fmt(v); else if (textRef.current) textRef.current.textContent = fmt(v);
    };

    const setDragging = (on) => {
        const tr = trackRef.current;
        if (tr) tr.style.cursor = draggable ? (on ? "grabbing" : "grab") : "default";
        for (const el of [fillRef.current, spriteRef.current]) if (el) el.style.transition = on ? "none" : "";
        if (animRef.current && animation !== "none") animRef.current.classList.toggle(`dc-anim-${animation}-loop`, on);
    };

    const onPointerDown = (e) => {
        if (!draggable || (e.button !== undefined && e.button !== 0)) return;
        e.preventDefault(); e.stopPropagation();
        trackRef.current.setPointerCapture?.(e.pointerId);
        // Retângulo lido uma vez: nada de leitura de layout por movimento.
        drag.current = { pid: e.pointerId, x0: e.clientX, y0: e.clientY, moved: false, v: current, raf: 0, rect: trackRef.current.getBoundingClientRect() };
        setDragging(true);
        if (onDragStart) onDragStart();
    };
    const onPointerMove = (e) => {
        const d = drag.current;
        if (!d || e.pointerId !== d.pid) return;
        if (!d.moved && Math.abs(e.clientX - d.x0) <= 5 && Math.abs(e.clientY - d.y0) <= 5) return;
        d.moved = true;
        d.v = clampStep(fromPoint(e.clientX, e.clientY));
        if (!d.raf) d.raf = requestAnimationFrame(() => { d.raf = 0; paint(d.v); if (onChange) onChange(d.v); });
    };
    const onPointerUp = async (e) => {
        const d = drag.current;
        if (!d || e.pointerId !== d.pid) return;
        if (d.raf) cancelAnimationFrame(d.raf);
        setDragging(false);
        if (!d.moved) { drag.current = null; paint(current); return; }
        const final = clampStep(fromPoint(e.clientX, e.clientY));
        drag.current = null;
        paint(final);
        setCommitted(final);
        if (targetKey) {
            const file = app.vault.getAbstractFileByPath(targetFile || ownPath);
            if (file) await app.fileManager.processFrontMatter(file, fm => { fm[targetKey] = final; });
        }
        if (onChange) onChange(final);
        if (onDragEnd) onDragEnd();
    };

    // Clique no sprite sem arrasto: animação enquanto o botão estiver pressionado.
    const onSpriteDown = (e) => {
        if (draggable) return;
        e.preventDefault(); e.stopPropagation();
        if (!animRef.current || animation === "none") return;
        const cls = `dc-anim-${animation}-loop`;
        animRef.current.classList.add(cls);
        const up = () => { animRef.current?.classList.remove(cls); document.removeEventListener("pointerup", up); };
        document.addEventListener("pointerup", up);
    };

    const p = pct(current);
    const padX = Math.max(0, (44 - spW) / 2), padY = Math.max(0, (44 - spH) / 2);
    const cursor = draggable ? "grab" : "default";
    const layer = (b, s, r, ps) => ({ backgroundColor: b.c, backgroundImage: b.i, backgroundSize: s, backgroundRepeat: r, backgroundPosition: ps });

    return (
        <div className={`dc-glo-bar-container ${className}`.trim()}
            style={{ ...(vertical ? { display: "flex", flexDirection: "column", alignItems: "center", height: "100%", width: "auto" } : { width }), ...style }}>
            {(label || showValue) && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px", fontSize: "12px", width: "100%" }}>
                    {label && <span style={{ color: theme["color-text"] || "var(--text-normal)", fontWeight: "bold" }}>{label}</span>}
                    {showValue && <span ref={textRef} style={{ color: theme["color-text-muted"] || "#888", fontVariantNumeric: "tabular-nums" }}>{fmt(current)}</span>}
                </div>
            )}
            <div
                ref={trackRef}
                onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
                className={`dc-glo-bar-track${draggable ? " dc-glo-bar-draggable" : ""}`}
                style={{
                    position: "relative", overflow: "visible", borderRadius: radius, cursor,
                    touchAction: "none", userSelect: "none", WebkitUserSelect: "none",
                    ...(vertical ? { height: len, width: thick } : { width: len, height: thick }),
                    ...layer(track, trackBgSize || theme["bar-track-bg-size"] || "auto", trackBgRepeat || theme["bar-track-bg-repeat"] || "repeat", trackBgPosition || theme["bar-track-bg-position"] || "center"),
                }}
            >
                <div ref={fillRef} className="dc-glo-bar-fill" style={{
                    position: "absolute", left: 0, pointerEvents: "none", borderRadius: radius,
                    ...(vertical ? { bottom: 0, width: "100%", height: `${p}%`, transition: "height 0.15s ease-out, background-position 0.3s ease-out" }
                        : { top: 0, height: "100%", width: `${p}%`, transition: "width 0.15s ease-out, background-position 0.3s ease-out" }),
                    ...layer(fill, fillBgSize || theme["bar-fill-bg-size"] || "auto", fillBgRepeat || theme["bar-fill-bg-repeat"] || "repeat", fillBgPosition || theme["bar-fill-bg-position"] || "center"),
                }} />
                {showSprite && spriteUrl && (
                    <div ref={spriteRef} onPointerDown={onSpriteDown} className="dc-glo-bar-sprite" style={{
                        position: "absolute", width: `${spW}px`, height: `${spH}px`, zIndex: 10, userSelect: "none",
                        cursor: draggable ? "grab" : "pointer",
                        padding: `${padY}px ${padX}px`, margin: `-${padY}px -${padX}px`, boxSizing: "content-box",
                        ...(vertical ? { left: "50%", bottom: `calc(${p}% - ${spH / 2}px)`, transform: "translateX(-50%)", transition: "bottom 0.3s ease" }
                            : { left: `calc(${p}% - ${spW / 2}px)`, top: "50%", transform: "translateY(-50%)", transition: "left 0.3s ease" }),
                    }}>
                        <div ref={animRef} style={{ width: "100%", height: "100%", "--dc-anim-duration": animDuration }}>
                            <img src={spriteUrl} alt="" draggable={false} style={{ width: "100%", height: "100%", objectFit: "contain", pointerEvents: "none", userSelect: "none" }} />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

const renderedView = (
    <div style={{ display: "flex", gap: "2rem", padding: "1rem" }}>
        <div style={{ width: "200px" }}><GloBar value={65} label="Horizontal" /></div>
        <div style={{ height: "200px" }}><GloBar value={65} label="Vertical" vertical length="150px" height="20px" draggable /></div>
    </div>
);

return { renderedView, GloBar };
