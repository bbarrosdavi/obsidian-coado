// ═══════════════════════════════════════════════════════════════════════════════
// DC-COLOR-PICKER v2 - Seletor de cor (amostra, hex, popup HSV, presets)
// Mesma API: value, onChange(hex), label, showInput, showPresets, presetPalette,
// size, swatchSize, disabled, style, className. Exporta os mesmos utilitários.
//
// Mudanças: arrasto no quadro saturação/brilho por ponteiro, cursor movido no
// DOM e onChange agrupado por quadro de animação (antes, 4 setState + onChange
// a cada mousemove: o editor de temas re-renderizava a prévia inteira por
// pixel); campo hex é rascunho até ficar válido; presets com hex de verdade
// (havia "var(--text-normal)" e "var(--background-primary)" na lista, que
// viravam "#VAR(--TEXT-NORMAL)" ao clicar); hover dos presets por CSS.
// ═══════════════════════════════════════════════════════════════════════════════

const { useTheme } = await dc.require(dc.fileLink("System/Scripts/Core/dc-themeProvider.jsx"));
const { alpha } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloButton.jsx"));

const COLOR_PRESETS = {
    primary: ["#ff69b4", "#ff1493", "#ff69b4", "#da70d6", "#ba55d3", "#9370db", "#8a2be2", "#7c3aed", "#6d28d9", "#5b21b6"],
    rainbow: ["#ff0000", "#ff7f00", "#ffff00", "#00ff00", "#00ffff", "#0000ff", "#8b00ff", "#ff00ff", "#ff1493", "#ffffff"],
    neon: ["#ff00ff", "#00ffff", "#ff69b4", "#39ff14", "#ff6600", "#ffff00", "#ff0099", "#00ff99", "#9d00ff", "#ff3131"],
    pastel: ["#ffb3ba", "#ffdfba", "#ffffba", "#baffc9", "#bae1ff", "#e0b0ff", "#ffc0cb", "#dda0dd", "#f0e68c", "#e6e6fa"],
    dark: ["#1a1a2e", "#16213e", "#0f3460", "#1e1e2e", "#2d2d44", "#1a1a1a", "#2b2b2b", "#3d3d3d", "#0d1117", "#161b22"],
    grayscale: ["#ffffff", "#e0e0e0", "#c0c0c0", "#a0a0a0", "#808080", "#606060", "#404040", "#303030", "#202020", "#000000"],
};

const isValidHex = (hex) => /^#([0-9A-Fa-f]{3}){1,2}$/.test(hex);
function normalizeHex(hex) {
    if (!hex) return "#000000";
    let h = hex.startsWith("#") ? hex : `#${hex}`;
    if (h.length === 4) h = `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`;
    return h.toUpperCase();
}
function hsvToRgb(h, s, v) {
    let r, g, b;
    const i = Math.floor(h * 6), f = h * 6 - i, p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
    switch (i % 6) {
        case 0: r = v; g = t; b = p; break;
        case 1: r = q; g = v; b = p; break;
        case 2: r = p; g = v; b = t; break;
        case 3: r = p; g = q; b = v; break;
        case 4: r = t; g = p; b = v; break;
        case 5: r = v; g = p; b = q; break;
    }
    return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}
const rgbToHex = (r, g, b) => "#" + [r, g, b].map(x => x.toString(16).padStart(2, "0")).join("").toUpperCase();
function hexToHsv(hex) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!m) return { h: 0, s: 0, v: 0 };
    const r = parseInt(m[1], 16) / 255, g = parseInt(m[2], 16) / 255, b = parseInt(m[3], 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    let h = 0;
    if (max !== min) {
        if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
        else if (max === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
        h /= 6;
    }
    return { h, s: max === 0 ? 0 : d / max, v: max };
}
const hsvHex = (h, s, v) => { const c = hsvToRgb(h, s, v); return rgbToHex(c.r, c.g, c.b); };
const toHsv = (v) => isValidHex(v || "") ? hexToHsv(normalizeHex(v)) : hexToHsv("");

const CSS_ID = "dc-colorpicker-css";
const CSS = `.dcg-cp-preset{transition:transform .1s ease}.dcg-cp-preset:hover{transform:scale(1.1)}`;
{ let el = document.getElementById(CSS_ID); if (!el) { el = document.createElement("style"); el.id = CSS_ID; document.head.appendChild(el); } if (el.textContent !== CSS) el.textContent = CSS; }   // só toca no <style> se mudou: trocar a folha a cada bloco recalcula o estilo da página inteira
const SIZES = { small: { swatch: 24, font: 11, padding: 4 }, medium: { swatch: 32, font: 13, padding: 6 }, large: { swatch: 40, font: 14, padding: 8 } };

function ColorPicker({ value = "#7c3aed", onChange = null, label = null, showInput = true, showPresets = true, presetPalette = "primary", size = "medium", swatchSize = null, disabled = false, style = {}, className = "" }) {
    const { theme } = useTheme();
    const [open, setOpen] = dc.useState(false);
    const [draft, setDraft] = dc.useState(null);            // texto do campo enquanto inválido/em edição
    const [hsv, setHsv] = dc.useState(() => toHsv(value));
    const box = dc.useRef(null), sb = dc.useRef(null), cursor = dc.useRef(null), live = dc.useRef(hsv), raf = dc.useRef(0), pending = dc.useRef(null);
    const cb = dc.useRef(onChange); cb.current = onChange;

    // valor externo novo (outro tema, preset de gradiente): realinha o HSV
    dc.useEffect(() => { if (normalizeHex(value) !== hsvHex(live.current.h, live.current.s, live.current.v)) { const x = toHsv(value); live.current = x; setHsv(x); } }, [value]);
    dc.useEffect(() => {
        if (!open) return;
        const out = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
        document.addEventListener("mousedown", out);
        return () => document.removeEventListener("mousedown", out);
    }, [open]);
    dc.useEffect(() => () => cancelAnimationFrame(raf.current), []);

    const emit = (hex) => { pending.current = hex; if (!raf.current) raf.current = requestAnimationFrame(() => { raf.current = 0; const h = pending.current; pending.current = null; if (h) cb.current?.(h); }); };
    const setFrom = (next, commit = true) => { live.current = next; if (commit) setHsv(next); emit(hsvHex(next.h, next.s, next.v)); };

    const primary = theme["color-primary"] || "#7c3aed", surface = theme["color-surface"] || "var(--background-secondary)";
    const text = theme["color-text"] || "var(--text-normal)", muted = theme["color-text-muted"] || "#888";
    const sz = SIZES[size] || SIZES.medium, sw = swatchSize || sz.swatch;
    const display = hsvHex(hsv.h, hsv.s, hsv.v);
    const liveHex = hsvHex(live.current.h, live.current.s, live.current.v);
    const shown = isValidHex(value || "") && normalizeHex(value) === liveHex ? liveHex : display;   // durante o arrasto o valor do pai acompanha
    const presets = COLOR_PRESETS[presetPalette] || COLOR_PRESETS.primary;

    // Arrasto: o cursor anda no DOM; o estado do React só assenta ao soltar.
    const onDown = (e) => {
        const el = sb.current; if (!el) return;
        e.preventDefault();
        el.setPointerCapture?.(e.pointerId);
        const rect = el.getBoundingClientRect();
        const at = (ev) => {
            const s = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width)), v = 1 - Math.max(0, Math.min(1, (ev.clientY - rect.top) / rect.height));
            if (cursor.current) { cursor.current.style.left = `${s * 100}%`; cursor.current.style.top = `${(1 - v) * 100}%`; }
            setFrom({ h: live.current.h, s, v }, false);
        };
        at(e);
        const move = (ev) => at(ev);
        const up = () => { el.removeEventListener("pointermove", move); el.removeEventListener("pointerup", up); el.removeEventListener("pointercancel", up); setHsv({ ...live.current }); };
        el.addEventListener("pointermove", move); el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
    };
    const onHex = (raw) => {
        setDraft(raw);
        const v = raw && !raw.startsWith("#") ? `#${raw}` : raw;
        if (isValidHex(v)) { const n = normalizeHex(v); const x = hexToHsv(n); live.current = x; setHsv(x); cb.current?.(n); }
    };
    const pick = (c) => { const n = normalizeHex(c); const x = hexToHsv(n); live.current = x; setHsv(x); setDraft(null); cb.current?.(n); };

    return (
        <div ref={box} className={className} style={{ display: "inline-flex", flexDirection: "column", gap: 4, position: "relative", ...style }}>
            {label && <label style={{ fontSize: sz.font - 1, color: muted, fontWeight: 500 }}>{label}</label>}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div onClick={() => !disabled && setOpen(!open)} title={shown}
                    style={{ width: sw, height: sw, borderRadius: 6, background: shown, border: "2px solid rgba(255,255,255,0.2)", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1, boxShadow: open ? `0 0 0 2px ${primary}` : "none", transition: "box-shadow .2s" }} />
                {showInput && (
                    <input type="text" value={draft ?? shown} disabled={disabled} placeholder="#000000"
                        onInput={(e) => onHex(e.target.value)} onBlur={() => setDraft(null)}
                        style={{ width: 84, padding: `${sz.padding}px 8px`, fontSize: sz.font, fontFamily: "var(--font-monospace)", background: "var(--background-secondary-alt, rgba(0,0,0,0.05))", border: "1px solid var(--background-modifier-border)", borderRadius: 4, color: text, outline: "none" }} />
                )}
            </div>
            {open && (
                <div style={{ position: "absolute", top: "100%", left: 0, marginTop: 8, padding: 12, background: surface, border: `1px solid ${alpha(primary, 0.27)}`, borderRadius: 10, boxShadow: "0 8px 32px rgba(0,0,0,0.4)", zIndex: 1000, minWidth: 220 }}>
                    <div ref={sb} onPointerDown={onDown}
                        style={{ width: "100%", height: 150, borderRadius: 6, position: "relative", cursor: "crosshair", marginBottom: 10, touchAction: "none", background: `linear-gradient(to bottom, transparent, black), linear-gradient(to right, white, ${hsvHex(hsv.h, 1, 1)})` }}>
                        <div ref={cursor} style={{ position: "absolute", left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, width: 14, height: 14, borderRadius: "50%", border: "2px solid white", boxShadow: "0 0 4px rgba(0,0,0,0.5)", transform: "translate(-50%, -50%)", pointerEvents: "none" }} />
                    </div>
                    <input type="range" min="0" max="1" step="0.01" value={hsv.h} onInput={(e) => setFrom({ ...live.current, h: parseFloat(e.target.value) })}
                        style={{ width: "100%", height: 14, borderRadius: 7, appearance: "none", background: "linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)", cursor: "pointer", marginBottom: 10 }} />
                    {showPresets && (
                        <div>
                            <div style={{ fontSize: 10, color: muted, marginBottom: 6, textTransform: "uppercase", letterSpacing: ".5px" }}>Predefinidas</div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 4 }}>
                                {presets.map((c, i) => (
                                    <div key={i} className="dcg-cp-preset" onClick={() => pick(c)} title={c}
                                        style={{ width: "100%", aspectRatio: "1", borderRadius: 4, background: c, cursor: "pointer", border: display === c.toUpperCase() ? "2px solid white" : "1px solid var(--background-modifier-border)" }} />
                                ))}
                            </div>
                        </div>
                    )}
                    <div style={{ marginTop: 10, padding: 8, background: "rgba(0,0,0,0.2)", borderRadius: 6, display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 24, height: 24, borderRadius: 4, background: display, border: "1px solid rgba(255,255,255,0.2)" }} />
                        <span style={{ fontFamily: "var(--font-monospace)", fontSize: 12, color: text }}>{display}</span>
                    </div>
                </div>
            )}
        </div>
    );
}

return { ColorPicker, COLOR_PRESETS, isValidHex, normalizeHex, hexToHsv, hsvToRgb, rgbToHex };
