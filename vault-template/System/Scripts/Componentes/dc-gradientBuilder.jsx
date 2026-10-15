// ═══════════════════════════════════════════════════════════════════════════════
// DC-GRADIENT-BUILDER v2 - Editor visual de gradientes (linear, radial, cônico)
// Mesma API: value, onChange(css), label, showPresets, showTypeSelector,
// previewHeight, style, className. Exporta GRADIENT_PRESETS, parseGradient,
// buildGradient com a mesma saída.
//
// Mudanças: leitura do gradiente respeita parênteses aninhados (rgba() dentro
// do gradiente quebrava a análise e virava "#RGBA(..."); só hex é normalizado;
// o editor se realinha quando o valor muda por fora (trocar de tema no editor
// mostrava o gradiente do tema anterior); nova parada nasce branca "#FFFFFF"
// (era "var(--text-normal)", inválido no seletor de cor); hover por CSS;
// rótulos em pt-BR.
// ═══════════════════════════════════════════════════════════════════════════════

const { useTheme } = await dc.require(dc.fileLink("System/Scripts/Core/dc-themeProvider.jsx"));
const { alpha } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloButton.jsx"));
const { ColorPicker, normalizeHex } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-colorPicker.jsx"));

const GRADIENT_PRESETS = [
    { name: "Nyan Rainbow", value: "linear-gradient(90deg, #ff0000, #ff7f00, #ffff00, #00ff00, #0099ff, #6633ff)" },
    { name: "Sunset", value: "linear-gradient(90deg, #ff512f, #f09819)" },
    { name: "Ocean", value: "linear-gradient(90deg, #2193b0, #6dd5ed)" },
    { name: "Purple Dream", value: "linear-gradient(90deg, #7c3aed, #a78bfa)" },
    { name: "Pink Glow", value: "linear-gradient(90deg, #ff69b4, #ff1493)" },
    { name: "Cyberpunk", value: "linear-gradient(90deg, #00ffff, #ff00ff)" },
    { name: "Fire", value: "linear-gradient(90deg, #f12711, #f5af19)" },
    { name: "Forest", value: "linear-gradient(90deg, #134e5e, #71b280)" },
    { name: "Gold", value: "linear-gradient(90deg, #f7971e, #ffd200)" },
    { name: "Midnight", value: "linear-gradient(90deg, #232526, #414345)" },
];
const DIRECTIONS = [
    { label: "→", value: "90deg", title: "Esquerda para direita" },
    { label: "←", value: "270deg", title: "Direita para esquerda" },
    { label: "↓", value: "180deg", title: "Cima para baixo" },
    { label: "↑", value: "0deg", title: "Baixo para cima" },
    { label: "↘", value: "135deg", title: "Diagonal descendo" },
    { label: "↗", value: "45deg", title: "Diagonal subindo" },
];
const TYPES = [["linear", "Linear"], ["radial", "Radial"], ["conic", "Cônico"]];
const FALLBACK = () => [{ color: "#7c3aed", stop: 0 }, { color: "#a78bfa", stop: 100 }];

// Conteúdo entre o primeiro "(" e o ")" que o fecha, dividido por vírgulas de nível 0.
function topLevel(str) {
    const open = str.indexOf("(");
    if (open < 0) return null;
    let depth = 0, cur = "", parts = [];
    for (let i = open + 1; i < str.length; i++) {
        const ch = str[i];
        if (ch === "(") depth++;
        if (ch === ")") { if (depth === 0) { parts.push(cur); return parts; } depth--; }
        if (ch === "," && depth === 0) { parts.push(cur); cur = ""; } else cur += ch;
    }
    return null;
}

function parseGradient(str) {
    if (!str || typeof str !== "string") return { type: "linear", direction: "90deg", colors: FALLBACK() };
    const type = str.startsWith("radial-gradient") ? "radial" : str.startsWith("conic-gradient") ? "conic" : "linear";
    const parts = topLevel(str);
    if (!parts) return { type, direction: "90deg", colors: FALLBACK() };
    let direction = "90deg", start = 0;
    const first = (parts[0] || "").trim();
    if (/deg|to |circle|ellipse|from /.test(first)) { direction = first.replace(/^from\s+/, ""); start = 1; }
    const colors = [], n = parts.length - start;
    for (let i = start; i < parts.length; i++) {
        const m = parts[i].trim().match(/^(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\)|[a-z]+)\s*(\d+(?:\.\d+)?%)?/i);
        if (!m) continue;
        const stop = m[2] ? parseFloat(m[2]) : Math.round((i - start) / Math.max(1, n - 1) * 100);
        colors.push({ color: m[1].startsWith("#") ? normalizeHex(m[1]) : m[1], stop });
    }
    return { type, direction, colors: colors.length >= 2 ? colors : FALLBACK() };
}

function buildGradient(type, direction, colors) {
    const stops = [...colors].sort((a, b) => a.stop - b.stop).map(c => `${c.color} ${c.stop}%`).join(", ");
    if (type === "radial") return `radial-gradient(${direction}, ${stops})`;
    if (type === "conic") return `conic-gradient(from ${direction}, ${stops})`;
    return `linear-gradient(${direction}, ${stops})`;
}

const CSS_ID = "dc-gradientbuilder-css";
const CSS = `.dcg-gb-preset{transition:transform .1s ease}.dcg-gb-preset:hover{transform:scale(1.05)}
.dcg-gb-btn:not(#dcg){border:none;box-shadow:none;border-radius:6px;cursor:pointer;color:var(--gb-text);background:var(--gb-bg,var(--background-modifier-border))}`;
{ let el = document.getElementById(CSS_ID); if (!el) { el = document.createElement("style"); el.id = CSS_ID; document.head.appendChild(el); } if (el.textContent !== CSS) el.textContent = CSS; }   // só toca no <style> se mudou: trocar a folha a cada bloco recalcula o estilo da página inteira

function GradientBuilder({ value = "linear-gradient(90deg, #7c3aed, #a78bfa)", onChange = null, label = null, showPresets = true, showTypeSelector = true, previewHeight = 60, style = {}, className = "" }) {
    const { theme } = useTheme();
    const [g, setG] = dc.useState(() => parseGradient(value));
    const [sel, setSel] = dc.useState(0);
    const [open, setOpen] = dc.useState(false);
    const lastOut = dc.useRef(value);

    // valor novo vindo de fora (não o que este editor acabou de emitir): reanalisa
    dc.useEffect(() => { if (value !== lastOut.current) { lastOut.current = value; setG(parseGradient(value)); setSel(0); } }, [value]);

    const primary = theme["color-primary"] || "#7c3aed", surface = theme["color-surface"] || "var(--background-secondary)";
    const text = theme["color-text"] || "var(--text-normal)", muted = theme["color-text-muted"] || "#888";
    const current = buildGradient(g.type, g.direction, g.colors);
    const commit = (next) => { setG(next); const css = buildGradient(next.type, next.direction, next.colors); lastOut.current = css; onChange?.(css); };
    const setType = (type) => {
        let direction = g.direction;
        if (type === "radial" && direction.includes("deg")) direction = "circle";
        else if (type === "linear" && !direction.includes("deg")) direction = "90deg";
        commit({ ...g, type, direction });
    };
    const setStop = (i, patch) => { const colors = g.colors.map((c, k) => k === i ? { ...c, ...patch } : c); commit({ ...g, colors }); };
    const add = () => { const s = { color: "#FFFFFF", stop: 50 }; const colors = [...g.colors, s].sort((a, b) => a.stop - b.stop); setSel(colors.indexOf(s)); commit({ ...g, colors }); };
    const remove = (i) => { if (g.colors.length <= 2) return; const colors = g.colors.filter((_, k) => k !== i); setSel(Math.min(sel, colors.length - 1)); commit({ ...g, colors }); };
    const preset = (v) => { const p = parseGradient(v); setG(p); setSel(0); lastOut.current = v; onChange?.(v); };
    const cap = { fontSize: 10, color: muted, marginBottom: 6, textTransform: "uppercase", letterSpacing: ".04em" };
    const btnVars = (on) => ({ "--gb-text": text, "--gb-bg": on ? primary : "var(--background-modifier-border)" });

    return (
        <div className={className} style={style}>
            {label && <label style={{ display: "block", fontSize: 12, color: muted, fontWeight: 500, marginBottom: 6 }}>{label}</label>}
            <div onClick={() => setOpen(!open)}
                style={{ height: previewHeight, borderRadius: 8, background: current, cursor: "pointer", border: `2px solid ${open ? primary : "var(--background-modifier-border)"}`, transition: "border-color .2s", position: "relative" }}>
                <div style={{ position: "absolute", bottom: 4, right: 4, fontSize: 10, color: "#fff", background: "rgba(0,0,0,0.5)", padding: "2px 6px", borderRadius: 4 }}>{open ? "Fechar edição" : "Editar"}</div>
            </div>
            {open && (
                <div style={{ marginTop: 12, padding: 12, background: surface, borderRadius: 10, border: `1px solid ${alpha(primary, 0.2)}` }}>
                    {showTypeSelector && (
                        <div style={{ marginBottom: 12 }}>
                            <div style={cap}>Tipo</div>
                            <div style={{ display: "flex", gap: 6 }}>
                                {TYPES.map(([t, l]) => <button key={t} className="dcg-gb-btn" onClick={() => setType(t)} style={{ padding: "6px 12px", fontSize: 11, ...btnVars(g.type === t) }}>{l}</button>)}
                            </div>
                        </div>
                    )}
                    {g.type === "linear" && (
                        <div style={{ marginBottom: 12 }}>
                            <div style={cap}>Direção</div>
                            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                                {DIRECTIONS.map(d => <button key={d.value} className="dcg-gb-btn" title={d.title} onClick={() => commit({ ...g, direction: d.value })} style={{ width: 32, height: 32, fontSize: 16, ...btnVars(g.direction === d.value) }}>{d.label}</button>)}
                            </div>
                        </div>
                    )}
                    <div style={{ marginBottom: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                            <span style={{ ...cap, marginBottom: 0 }}>Paradas de cor ({g.colors.length})</span>
                            <button className="dcg-gb-btn" onClick={add} style={{ padding: "4px 8px", fontSize: 10, ...btnVars(false) }}>+ Adicionar</button>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {g.colors.map((c, i) => (
                                <div key={i} onClick={() => setSel(i)} style={{ display: "flex", alignItems: "center", gap: 8, padding: 8, borderRadius: 6, cursor: "pointer", background: sel === i ? "var(--background-secondary-alt, rgba(0,0,0,0.05))" : "transparent" }}>
                                    <ColorPicker value={c.color} onChange={(color) => setStop(i, { color })} showInput={false} showPresets={false} size="small" />
                                    <input type="range" min="0" max="100" value={c.stop} onInput={(e) => setStop(i, { stop: Math.max(0, Math.min(100, parseInt(e.target.value))) })} style={{ flex: 1, cursor: "pointer" }} />
                                    <span style={{ fontSize: 11, color: muted, width: 35, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{c.stop}%</span>
                                    {g.colors.length > 2 && <button className="dcg-gb-btn" onClick={(e) => { e.stopPropagation(); remove(i); }} title="Remover parada" style={{ width: 20, height: 20, fontSize: 12, padding: 0, "--gb-text": "#ff6666", "--gb-bg": "rgba(255,0,0,0.2)" }}>×</button>}
                                </div>
                            ))}
                        </div>
                    </div>
                    {showPresets && (
                        <div>
                            <div style={cap}>Predefinidos</div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
                                {GRADIENT_PRESETS.map((p, i) => <div key={i} className="dcg-gb-preset" title={p.name} onClick={() => preset(p.value)} style={{ height: 24, borderRadius: 4, background: p.value, cursor: "pointer", border: "1px solid var(--background-modifier-border)" }} />)}
                            </div>
                        </div>
                    )}
                    <div style={{ marginTop: 12 }}>
                        <div style={{ ...cap, marginBottom: 4 }}>Valor CSS</div>
                        <div style={{ padding: 8, background: "rgba(0,0,0,0.3)", borderRadius: 6, fontFamily: "var(--font-monospace)", fontSize: 10, color: muted, wordBreak: "break-all" }}>{current}</div>
                    </div>
                </div>
            )}
        </div>
    );
}

return { GradientBuilder, GRADIENT_PRESETS, parseGradient, buildGradient };
