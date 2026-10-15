// ═══════════════════════════════════════════════════════════════════════════════
// DC-BACKGROUND-PICKER v2 - Fundo por cor, gradiente ou imagem (base64/URL)
// Mesma API: value, onChange, label, previewHeight, allowColor, allowGradient,
// allowImage, style, className. Exporta detectBackgroundType e extractColor
// com o mesmo comportamento.
// Mudanças: rótulos em pt-BR, sem emojis; botões com hover por CSS; o campo de
// URL não regrava a cada tecla um data URL inteiro no tema (grava ao sair).
// ═══════════════════════════════════════════════════════════════════════════════

const { useTheme } = await dc.require(dc.fileLink("System/Scripts/Core/dc-themeProvider.jsx"));
const { alpha } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloButton.jsx"));
const { ColorPicker } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-colorPicker.jsx"));
const { GradientBuilder } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gradientBuilder.jsx"));

function detectBackgroundType(value) {
    if (!value) return "color";
    if (value.startsWith("data:image") || value.startsWith("url(") || /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(value)) return "image";
    if (value.includes("gradient(")) return "gradient";
    return "color";
}
function extractColor(value) {
    if (!value) return "#7c3aed";
    if (value.startsWith("#")) return value;
    const m = value.startsWith("rgb") && value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (m) return `#${[m[1], m[2], m[3]].map(x => parseInt(x).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
    return "#7c3aed";
}
const TYPES = [["color", "Cor"], ["gradient", "Gradiente"], ["image", "Imagem"]];
const TYPE_LABEL = { color: "cor", gradient: "gradiente", image: "imagem" };

function BackgroundPicker({ value = "", onChange = null, label = null, previewHeight = 50, allowColor = true, allowGradient = true, allowImage = true, style = {}, className = "" }) {
    const { theme } = useTheme();
    const t0 = detectBackgroundType(value);
    const [type, setType] = dc.useState(t0);
    const [color, setColor] = dc.useState(t0 === "color" ? extractColor(value) : "#7c3aed");
    const [gradient, setGradient] = dc.useState(t0 === "gradient" ? value : "linear-gradient(90deg, #7c3aed, #a78bfa)");
    const [image, setImage] = dc.useState(t0 === "image" ? value : "");
    const [urlDraft, setUrlDraft] = dc.useState(null);
    const [open, setOpen] = dc.useState(false);
    const userType = dc.useRef(false);

    dc.useEffect(() => {
        if (userType.current) { userType.current = false; return; }
        const t = detectBackgroundType(value);
        setType(t);
        if (t === "color") setColor(extractColor(value));
        else if (t === "gradient") setGradient(value);
        else setImage(value);
    }, [value]);

    const primary = theme["color-primary"] || "#7c3aed", surface = theme["color-surface"] || "var(--background-secondary)";
    const text = theme["color-text"] || "var(--text-normal)", muted = theme["color-text-muted"] || "#888";
    const display = type === "color" ? color : type === "gradient" ? gradient : image ? (image.startsWith("url(") ? image : `url("${image}")`) : "";
    const cap = { fontSize: 10, color: muted, marginBottom: 6, textTransform: "uppercase", letterSpacing: ".04em" };
    const btn = (on) => ({ "--gb-text": text, "--gb-bg": on ? primary : "var(--background-modifier-border)" });

    const changeType = (t) => {
        userType.current = true; setType(t);
        const v = t === "color" ? color : t === "gradient" ? gradient : image;
        if (v) onChange?.(v);
    };
    const setImg = (v) => { setImage(v); if (type === "image") onChange?.(v); };
    const upload = () => {
        const input = document.createElement("input");
        input.type = "file"; input.accept = "image/*";
        input.onchange = (e) => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = (ev) => setImg(ev.target.result); r.readAsDataURL(f); };
        input.click();
    };
    const types = TYPES.filter(([id]) => (id === "color" && allowColor) || (id === "gradient" && allowGradient) || (id === "image" && allowImage));

    return (
        <div className={className} style={style}>
            {label && <label style={{ display: "block", fontSize: 11, color: muted, fontWeight: 500, marginBottom: 6 }}>{label}</label>}
            <div onClick={() => setOpen(!open)}
                style={{
                    height: previewHeight, borderRadius: 8, cursor: "pointer", position: "relative", overflow: "hidden", transition: "border-color .2s",
                    background: display || "repeating-linear-gradient(45deg, #333, #333 10px, #444 10px, #444 20px)",
                    backgroundSize: type === "image" ? "contain" : undefined, backgroundRepeat: type === "image" ? "repeat" : undefined, backgroundPosition: type === "image" ? "center" : undefined,
                    border: `2px solid ${open ? primary : "var(--background-modifier-border)"}`,
                }}>
                <div style={{ position: "absolute", top: 4, left: 4, fontSize: 9, padding: "2px 6px", background: "rgba(0,0,0,0.6)", borderRadius: 4, color: "#fff", textTransform: "uppercase", fontWeight: 600 }}>{TYPE_LABEL[type]}</div>
                <div style={{ position: "absolute", bottom: 4, right: 4, fontSize: 9, color: "#fff", background: "rgba(0,0,0,0.5)", padding: "2px 6px", borderRadius: 4 }}>{open ? "Fechar edição" : "Editar"}</div>
            </div>
            {open && (
                <div style={{ marginTop: 10, padding: 12, background: surface, borderRadius: 10, border: `1px solid ${alpha(primary, 0.2)}` }}>
                    <div style={{ marginBottom: 12 }}>
                        <div style={cap}>Tipo de fundo</div>
                        <div style={{ display: "flex", gap: 6 }}>
                            {types.map(([id, l]) => <button key={id} className="dcg-gb-btn" onClick={() => changeType(id)} style={{ padding: "8px 14px", fontSize: 11, ...btn(type === id) }}>{l}</button>)}
                        </div>
                    </div>
                    {type === "color" && (
                        <div>
                            <div style={cap}>Cor</div>
                            <ColorPicker value={color} onChange={(c) => { setColor(c); if (type === "color") onChange?.(c); }} size="medium" presetPalette="primary" />
                        </div>
                    )}
                    {type === "gradient" && <GradientBuilder value={gradient} onChange={(gv) => { setGradient(gv); if (type === "gradient") onChange?.(gv); }} previewHeight={50} showPresets={true} />}
                    {type === "image" && (
                        <div>
                            <div style={cap}>Origem da imagem</div>
                            {image && <div style={{ width: "100%", height: 80, borderRadius: 8, background: `url("${image}") center/contain no-repeat`, border: "1px solid var(--background-modifier-border)", marginBottom: 10 }} />}
                            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                                <button className="dcg-gb-btn" onClick={upload} style={{ padding: "8px 14px", fontSize: 11, flex: 1, ...btn(false) }}>Enviar imagem</button>
                                {image && <button className="dcg-gb-btn" onClick={() => setImg("")} style={{ padding: "8px 14px", fontSize: 11, "--gb-text": "#ff6666", "--gb-bg": "rgba(255,0,0,0.15)" }}>Limpar</button>}
                            </div>
                            <div style={{ fontSize: 10, color: muted, marginBottom: 4 }}>Ou cole URL / Base64:</div>
                            <input type="text" value={urlDraft ?? image} placeholder="https://... ou data:image/..."
                                onFocus={() => setUrlDraft(image)} onInput={(e) => setUrlDraft(e.target.value)}
                                onBlur={() => { if (urlDraft !== null && urlDraft !== image) setImg(urlDraft); setUrlDraft(null); }}
                                onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }}
                                style={{ width: "100%", padding: "8px 10px", fontSize: 11, fontFamily: "var(--font-monospace)", background: "rgba(0,0,0,0.2)", border: "1px solid var(--background-modifier-border)", borderRadius: 6, color: text }} />
                        </div>
                    )}
                    <div style={{ marginTop: 12 }}>
                        <div style={{ ...cap, marginBottom: 4 }}>Valor</div>
                        <div style={{ padding: 8, background: "rgba(0,0,0,0.3)", borderRadius: 6, fontFamily: "var(--font-monospace)", fontSize: 9, color: muted, wordBreak: "break-all", maxHeight: 60, overflow: "auto" }}>{display || "(vazio)"}</div>
                    </div>
                </div>
            )}
        </div>
    );
}

return { BackgroundPicker, detectBackgroundType, extractColor };
