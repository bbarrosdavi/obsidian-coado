// ═══════════════════════════════════════════════════════════════════════════════
// DC-GLO-DIAL v3 - mostrador circular (hora, ângulo ou porcentagem)
//
// - Arrasto imperativo: ponteiro, valor central, AM/PM e brilho escritos no DOM;
//   onChange ao vivo, no máximo uma vez por quadro. O pai continua dono do valor.
// - Rastro (modo flashy): 12 pontos fixos animados por rAF que para quando o
//   rastro acaba (antes: setState a cada movimento + setInterval de 50 ms).
// - AM/PM não dispara mais o arrasto (antes o mousedown do mostrador chamava
//   onChange com o ângulo do centro antes de alternar).
// ═══════════════════════════════════════════════════════════════════════════════

const { useTheme, getFlashyMode } = await dc.require(dc.fileLink("System/Scripts/Core/dc-themeProvider.jsx"));
const { hexToRgba, useComponentCSS } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloButton.jsx"));

const toMin = (s) => { if (!s || typeof s !== "string") return 0; const [h, m] = s.split(":").map(Number); return h * 60 + (m || 0); };
const toHHMM = (t) => `${String(Math.floor(t / 60) % 24).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
const SIZES = {
    small: { diameter: 130, knobRadius: 48, fontSize: 18, labelSize: 10, ampmSize: 12 },
    medium: { diameter: 160, knobRadius: 60, fontSize: 22, labelSize: 11, ampmSize: 13 },
    large: { diameter: 200, knobRadius: 76, fontSize: 26, labelSize: 12, ampmSize: 14 },
};
const TRAIL = 12, TRAIL_MS = 600;

function GloDial({
    value = "12:00", mode = "time", snapMinutes = 15, showAmPm = true, size = "medium",
    label = null, showValue = true, showTicks = true, showTrail = true,
    showSprite = true, sprite = null, spriteWidth = null, spriteHeight = null,
    color = null, trackColor = null, disabled = false,
    onChange = null, onDragStart = null, onDragEnd = null,
    style = {}, className = "", flashy = null,
}) {
    useComponentCSS();
    const { theme } = useTheme();
    const fx = flashy !== null ? flashy : getFlashyMode();
    const dialRef = dc.useRef(null), knobRef = dc.useRef(null), valRef = dc.useRef(null), ampmRef = dc.useRef(null);
    const dots = dc.useRef([]), trail = dc.useRef([]), trailRaf = dc.useRef(0), drag = dc.useRef(null);
    const propValue = dc.useRef(value);
    propValue.current = value;

    const isTime = mode === "time" || mode === "time12";
    const primary = color || theme["color-primary"] || "#7c3aed";
    const text = theme["color-text"] || "var(--text-normal)";
    const muted = theme["color-text-muted"] || "#a0a0b0";
    const spriteUrl = sprite || theme["bar-sprite"] || null;
    const spW = spriteWidth || parseInt(theme["bar-sprite-width"]) || 34;
    const spH = spriteHeight || parseInt(theme["bar-sprite-height"]) || 21;
    const sz = typeof size === "number"
        ? { diameter: size, knobRadius: size * 0.38, fontSize: size * 0.14, labelSize: size * 0.07, ampmSize: size * 0.08 }
        : (SIZES[size] || SIZES.medium);

    const degOf = (v) => isTime ? ((toMin(v) % 720) / 720) * 360 : mode === "percentage" ? (Number(v) / 100) * 360 : Number(v) % 360;
    const valueOf = (deg, pm) => {
        if (!isTime) return mode === "percentage" ? Math.round((deg / 360) * 100) : Math.round(deg);
        let mins = Math.round(Math.round((deg / 360) * 720) / snapMinutes) * snapMinutes;
        if (mins >= 720) mins = 0;
        let h = Math.floor(mins / 60);
        if (pm && h < 12) h += 12;
        if (!pm && h === 12) h = 0;
        return toHHMM(h * 60 + (mins % 60));
    };
    const display = (v) => {
        if (!isTime) return mode === "percentage" ? `${v}%` : `${v}°`;
        const t = toMin(v), h = Math.floor(t / 60);
        return `${mode === "time12" ? (h % 12) || 12 : h}:${String(t % 60).padStart(2, "0")}`;
    };
    const ampm = (v) => Math.floor(toMin(v) / 60) >= 12 ? "PM" : "AM";
    const knobPos = (deg) => {
        const r = (deg - 90) * Math.PI / 180, k = 100 / sz.diameter;
        return { x: 50 + sz.knobRadius * Math.cos(r) * k, y: 50 + sz.knobRadius * Math.sin(r) * k };
    };
    const setText = (el, s) => { const n = el?.firstChild; if (n && n.nodeType === 3) n.data = s; else if (el) el.textContent = s; };

    const paint = (v) => {
        const deg = degOf(v), p = knobPos(deg);
        if (knobRef.current) {
            knobRef.current.style.left = `${p.x}%`; knobRef.current.style.top = `${p.y}%`;
            knobRef.current.style.transform = `translate(-50%, -50%) rotate(${deg + 90}deg)`;
        }
        setText(valRef.current, display(v));
        if (isTime) setText(ampmRef.current, ampm(v));
    };

    // Rastro: pontos fixos, animação só enquanto houver pontos vivos.
    const runTrail = () => {
        if (trailRaf.current) return;
        const step = () => {
            const now = performance.now();
            trail.current = trail.current.filter(t => now - t.time < TRAIL_MS);
            for (let i = 0; i < TRAIL; i++) {
                const el = dots.current[i], t = trail.current[i];
                if (!el) continue;
                if (!t) { el.style.opacity = "0"; continue; }
                const age = (now - t.time) / TRAIL_MS, p = knobPos(t.deg);
                el.style.left = `${p.x}%`; el.style.top = `${p.y}%`;
                el.style.transform = `translate(-50%, -50%) scale(${Math.max(0.3, 1 - age)})`;
                el.style.opacity = String(Math.max(0, 1 - age) * 0.6);
            }
            trailRaf.current = trail.current.length ? requestAnimationFrame(step) : 0;
        };
        trailRaf.current = requestAnimationFrame(step);
    };
    dc.useEffect(() => () => cancelAnimationFrame(trailRaf.current), []);

    const angleAt = (e) => {
        const r = drag.current?.rect || dialRef.current.getBoundingClientRect();
        let a = Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180 / Math.PI + 90;
        return a < 0 ? a + 360 : a;
    };
    const setDragLook = (on) => {
        const d = dialRef.current, k = knobRef.current;
        if (d) { d.style.borderColor = on ? primary : (trackColor || `${primary}44`); d.style.boxShadow = on && fx ? `0 0 20px ${hexToRgba(primary, 0.4)}` : "none"; }
        if (k) { k.style.transition = on ? "none" : "all 0.1s ease"; k.style.filter = on && fx ? `drop-shadow(0 0 8px ${primary})` : "none"; }
    };
    const moveTo = (e) => {
        const d = drag.current, deg = angleAt(e);
        d.v = valueOf(deg, d.pm);
        if (fx && showTrail) { trail.current = [...trail.current, { deg, time: performance.now() }].slice(-TRAIL); runTrail(); }
        if (!d.raf) d.raf = requestAnimationFrame(() => { d.raf = 0; paint(d.v); if (onChange) onChange(d.v); });
    };

    const onDown = (e) => {
        if (disabled || (e.button !== undefined && e.button !== 0)) return;
        e.preventDefault();
        dialRef.current.setPointerCapture?.(e.pointerId);
        drag.current = { pid: e.pointerId, pm: isTime && toMin(value) >= 720, v: value, raf: 0, rect: dialRef.current.getBoundingClientRect() };
        setDragLook(true);
        if (onDragStart) onDragStart();
        moveTo(e);
    };
    const onMove = (e) => { if (drag.current && e.pointerId === drag.current.pid) moveTo(e); };
    const onUp = (e) => {
        const d = drag.current;
        if (!d || e.pointerId !== d.pid) return;
        drag.current = null;
        if (d.raf) { cancelAnimationFrame(d.raf); paint(d.v); if (onChange) onChange(d.v); }
        setDragLook(false);
        // Sem onChange o pai não muda o valor: volta o ponteiro para a prop.
        if (!onChange) requestAnimationFrame(() => paint(propValue.current));
        if (onDragEnd) onDragEnd();
    };
    const toggleAmPm = (e) => {
        e.stopPropagation();
        if (disabled || !isTime) return;
        const t = toMin(value), h = Math.floor(t / 60);
        if (onChange) onChange(toHHMM(((h >= 12 ? h - 12 : h + 12) * 60) + (t % 60)));
    };

    const deg = degOf(value), kp = knobPos(deg);
    const padX = Math.max(0, (44 - spW) / 2), padY = Math.max(0, (44 - spH) / 2);

    return (
        <div className={`dc-glo-dial ${className}`.trim()} style={{ textAlign: "center", width: sz.diameter, opacity: disabled ? 0.5 : 1, ...style }}>
            {label && <div style={{ fontSize: sz.labelSize, color: muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>{label}</div>}
            <div ref={dialRef}
                onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
                style={{
                    width: sz.diameter, height: sz.diameter, borderRadius: "50%", position: "relative", margin: "0 auto", overflow: "hidden",
                    border: `2px solid ${trackColor || `${primary}44`}`, background: theme["color-background"] || "var(--background-primary)",
                    cursor: disabled ? "not-allowed" : "pointer", userSelect: "none", touchAction: "none",
                    transition: "border-color 0.2s, box-shadow 0.2s",
                }}>
                {showTicks && [0, 90, 180, 270].map(d => (
                    <div key={d} style={{ position: "absolute", width: 2, height: 8, background: `${muted}44`, left: "50%", top: 4, transformOrigin: `50% ${sz.diameter / 2 - 4}px`, transform: `translateX(-50%) rotate(${d}deg)` }} />
                ))}
                {fx && showTrail && Array.from({ length: TRAIL }, (_, i) => (
                    <div key={i} ref={el => { dots.current[i] = el; }} style={{ position: "absolute", width: 8, height: 8, borderRadius: "50%", background: primary, opacity: 0, pointerEvents: "none" }} />
                ))}
                <div ref={knobRef} style={{
                    position: "absolute", left: `${kp.x}%`, top: `${kp.y}%`, transform: `translate(-50%, -50%) rotate(${deg + 90}deg)`,
                    width: spW, height: spH, padding: `${padY}px ${padX}px`, boxSizing: "content-box",
                    transition: "all 0.1s ease", zIndex: 10, pointerEvents: "none", display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                    {showSprite && spriteUrl
                        ? <img src={spriteUrl} alt="" draggable={false} style={{ width: spW, height: spH, objectFit: "contain", pointerEvents: "none" }} />
                        : <div style={{ width: Math.max(16, spW * 0.5), height: Math.max(16, spH * 0.5), borderRadius: "50%", background: primary, border: "2px solid white" }} />}
                </div>
                {showValue && (
                    <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", display: "flex", flexDirection: "column", alignItems: "center", pointerEvents: "none" }}>
                        <div ref={valRef} style={{ fontWeight: "bold", fontSize: sz.fontSize, color: text, fontVariantNumeric: "tabular-nums" }}>{display(value)}</div>
                        {showAmPm && isTime && (
                            <div ref={ampmRef} onPointerDown={e => e.stopPropagation()} onClick={toggleAmPm}
                                style={{
                                    fontSize: sz.ampmSize || sz.labelSize, fontWeight: 600, color: primary, background: `${primary}20`, border: `1px solid ${primary}40`,
                                    padding: "8px 16px", borderRadius: 8, marginTop: 6, cursor: disabled ? "not-allowed" : "pointer", pointerEvents: "auto",
                                    minWidth: 52, minHeight: 36, display: "flex", alignItems: "center", justifyContent: "center", touchAction: "manipulation", userSelect: "none",
                                }}>{ampm(value)}</div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

function DialDemo() {
    const [bed, setBed] = dc.useState("23:00");
    const [pct, setPct] = dc.useState(40);
    return (
        <div style={{ display: "flex", gap: "24px", flexWrap: "wrap", padding: "1rem" }}>
            <GloDial label="Dormir" value={bed} mode="time" onChange={setBed} />
            <GloDial label="Progresso" value={pct} mode="percentage" onChange={setPct} />
        </div>
    );
}
const renderedView = <DialDemo />;

return { renderedView, GloDial };
