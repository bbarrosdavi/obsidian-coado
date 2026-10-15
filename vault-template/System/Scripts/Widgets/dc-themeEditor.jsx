// ═══════════════════════════════════════════════════════════════════════════════
// THEME EDITOR v3 (Editor de temas)
// Editar todas as propriedades de um tema (cores, fundos, gradientes, sprites
// em base64, animações, medidas) com prévia ao vivo de todos os Glo*; salvar no
// arquivo do tema, salvar como novo, criar, desfazer alterações.
//
// Grava (mesmo formato): System/Temas/<theme-id>.md, frontmatter na mesma ordem,
// com os mesmos comentários de seção em inglês ("# Color Palette" etc.), mesmas
// regras de aspas, título e descrição no corpo.
// Mudanças: a prévia segue a edição com atraso de um quadro agrupado (antes,
// cada pixel arrastado no seletor de cor re-renderizava a prévia inteira e os
// ~120 campos); seções viram abas (uma seção montada por vez, nenhuma
// recolhida pela metade); seletores GloSelect; rótulos em pt-BR, sem emojis.
// ═══════════════════════════════════════════════════════════════════════════════

const { useTheme, useAvailableThemes, loadThemeById, deriveGlowColors, DEFAULT_THEME } = await dc.require(dc.fileLink("System/Scripts/Core/dc-themeProvider.jsx"));
const { GloButton, alpha } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloButton.jsx"));
const { GloSelect } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloSelect.jsx"));
const { ColorPicker } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-colorPicker.jsx"));
const { GradientBuilder } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gradientBuilder.jsx"));
const { BackgroundPicker } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-backgroundPicker.jsx"));
const { ThemePreviewContent } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-themePreviewContent.jsx"));
const { StickyPreview } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-stickyPreview.jsx"));

const CSS_ID = "dc-theme-editor-responsive-css";
const CSS = `
.dc-theme-editor-main{display:flex;flex-direction:column;gap:20px;flex:1;min-height:0}
.dc-theme-editor-preview-wrapper{order:1}
.dc-theme-editor-content-wrapper{order:2;display:flex;flex-direction:column;gap:20px}
.dc-theme-editor-column{border-radius:12px;border:1px solid rgba(255,255,255,0.1);overflow:visible;display:flex;flex-direction:column}
.dcg-te-chip:not(#dcg){border:1px solid var(--te-line);box-shadow:none;cursor:pointer;border-radius:999px;padding:5px 12px;font-size:12px;background:transparent;color:var(--te-muted);transition:background .15s,color .15s}
.dcg-te-chip:not(#dcg):hover{background:var(--te-hover);color:var(--te-text)}
.dcg-te-chip:not(#dcg)[data-on]{background:var(--te-primary);border-color:var(--te-primary);color:#fff}
.dcg-td-btn:not(#dcg){border:none;box-shadow:none;cursor:pointer;transition:filter .2s ease}
.dcg-td-btn:not(#dcg):not(:disabled):hover{filter:brightness(1.12)}
.dcg-te-in:not(#dcg){padding:8px 12px;font-size:13px;background:var(--background-secondary-alt, rgba(0,0,0,0.05));border:1px solid rgba(255,255,255,0.1);border-radius:6px;color:var(--te-text);width:100%;min-height:38px;font-family:inherit}
@media (min-width:641px){
 .dc-theme-editor-main{display:grid;grid-template-columns:1fr 380px;gap:20px}
 .dc-theme-editor-preview-wrapper{order:2;position:relative}
 .dc-theme-editor-content-wrapper{order:1}
 .dc-theme-editor-preview-wrapper .dc-sticky-preview{position:sticky;top:0;max-height:calc(100vh - 200px);overflow:hidden}
 .dc-theme-editor-preview-wrapper .dc-sticky-preview-content.expanded{overflow-y:auto;max-height:calc(100vh - 280px)}
}
@media (max-width:640px){
 .dc-theme-editor-container{padding:16px}
 .dc-theme-editor-header{flex-direction:column;gap:12px;align-items:flex-start}
 .dc-theme-editor-footer{flex-direction:column;gap:12px}
 .dc-theme-editor-footer-left,.dc-theme-editor-footer-right{width:100%}
 .dc-theme-editor-footer button{flex:1}
}`;
{ let el = document.getElementById(CSS_ID); if (!el) { el = document.createElement("style"); el.id = CSS_ID; document.head.appendChild(el); } if (el.textContent !== CSS) el.textContent = CSS; }   // só toca no <style> se mudou: trocar a folha a cada bloco recalcula o estilo da página inteira

const ANIM = [["none", "Nenhuma"], ["squish", "Achatar"], ["bounce", "Quicar"], ["spin", "Girar"], ["twist", "Torcer"], ["jiggle", "Tremer"], ["pulse", "Pulsar"], ["wiggle", "Balançar"], ["flip", "Virar"]].map(([value, label]) => ({ value, label }));
const SIZE = [["auto", "Automático (tamanho original)"], ["cover", "Cobrir (preenche e corta)"], ["contain", "Conter (cabe inteiro)"], ["100% 100%", "Esticar (100%)"], ["50%", "50%"]].map(([value, label]) => ({ value, label }));
const REPEAT = [["repeat", "Ladrilhar"], ["no-repeat", "Sem repetição"], ["repeat-x", "Repetir na horizontal"], ["repeat-y", "Repetir na vertical"]].map(([value, label]) => ({ value, label }));
const POS = [["center", "Centro"], ["top", "Topo"], ["bottom", "Base"], ["left", "Esquerda"], ["right", "Direita"], ["top left", "Topo à esquerda"], ["top right", "Topo à direita"], ["bottom left", "Base à esquerda"], ["bottom right", "Base à direita"]].map(([value, label]) => ({ value, label }));
const DIR = [["none", "Nenhuma"], ["left", "Desliza da esquerda"], ["right", "Desliza da direita"], ["top", "Desliza de cima"], ["bottom", "Desliza de baixo"]].map(([value, label]) => ({ value, label }));

// Trio tamanho/repetição/posição de um fundo.
const bgTrio = (prefix, label) => [
    { key: `${prefix}-size`, label: `${label}: tamanho`, type: "select", options: SIZE },
    { key: `${prefix}-repeat`, label: `${label}: repetição`, type: "select", options: REPEAT },
    { key: `${prefix}-position`, label: `${label}: posição`, type: "select", options: POS },
];
const sprite = (p) => [
    { key: `${p}-sprite`, label: "Sprite (Base64/URL)", type: "image" },
    { key: `${p}-sprite-width`, label: "Largura do sprite", type: "number", min: 10, max: 200, unit: "px" },
    { key: `${p}-sprite-height`, label: "Altura do sprite", type: "number", min: 10, max: 200, unit: "px" },
    { key: `${p}-sprite-click-animation`, label: "Animação no clique", type: "select", options: ANIM },
];

// `title` em inglês vira o comentário de seção no arquivo salvo (formato mantido).
const PROPERTY_SECTIONS = [
    { id: "metadata", title: "Theme Metadata", label: "Metadados", properties: [
        { key: "theme-id", label: "ID do tema", type: "text", placeholder: "meu-tema", required: true },
        { key: "theme-name", label: "Nome exibido", type: "text", placeholder: "Meu tema" },
        { key: "theme-description", label: "Descrição", type: "textarea", placeholder: "Uma descrição curta..." },
        { key: "theme-author", label: "Autor", type: "text", placeholder: "Seu nome" },
        { key: "theme-version", label: "Versão", type: "text", placeholder: "1.0" },
    ] },
    { id: "colors", title: "Color Palette", label: "Cores", properties: [
        ["color-primary", "Primária"], ["color-secondary", "Secundária"], ["color-accent", "Destaque"], ["color-success", "Sucesso"], ["color-warning", "Alerta"],
        ["color-error", "Erro"], ["color-background", "Fundo"], ["color-surface", "Superfície"], ["color-text", "Texto"], ["color-text-muted", "Texto suave"],
    ].map(([key, label]) => ({ key, label, type: "color" })) },
    { id: "progressbar", title: "Progress Bar", label: "Barra de progresso", properties: [
        ...sprite("bar"),
        { key: "bar-fill-gradient", label: "Fundo do preenchimento", type: "background" }, ...bgTrio("bar-fill-bg", "Preenchimento"),
        { key: "bar-track-bg", label: "Fundo do trilho", type: "background" }, ...bgTrio("bar-track-bg", "Trilho"),
        { key: "bar-transition-direction", label: "Direção do deslize no hover", type: "select", options: DIR },
        { key: "bar-height", label: "Altura da barra", type: "text", placeholder: "14px" },
        { key: "bar-border-radius", label: "Raio da borda", type: "text", placeholder: "6px" },
    ] },
    { id: "toggle", title: "Toggle", label: "Alternador", properties: [
        ...sprite("toggle"),
        { key: "toggle-idle-bg", label: "Fundo em repouso", type: "background" }, ...bgTrio("toggle-idle-bg", "Repouso"),
        { key: "toggle-hover-bg", label: "Fundo no hover", type: "background" }, ...bgTrio("toggle-hover-bg", "Hover"),
        { key: "toggle-active-bg", label: "Fundo ativo", type: "background" }, ...bgTrio("toggle-active-bg", "Ativo"),
        { key: "toggle-transition-direction", label: "Direção do deslize no hover", type: "select", options: DIR },
        { key: "label-active", label: "Rótulo ativo", type: "text", placeholder: "ON" },
        { key: "label-inactive", label: "Rótulo inativo", type: "text", placeholder: "OFF" },
    ] },
    { id: "buttons", title: "Buttons", label: "Botões", properties: [
        { key: "button-idle-bg", label: "Fundo em repouso", type: "background" }, ...bgTrio("button-idle-bg", "Repouso"),
        { key: "button-hover-bg", label: "Fundo no hover", type: "background" }, ...bgTrio("button-hover-bg", "Hover"),
        { key: "button-active-bg", label: "Fundo ativo", type: "background" }, ...bgTrio("button-active-bg", "Ativo"),
        { key: "button-transition-direction", label: "Direção do deslize no hover", type: "select", options: DIR },
        { key: "button-text-color", label: "Cor do texto", type: "color" },
        ...sprite("button"),
    ] },
    { id: "inputs", title: "Inputs & Select", label: "Campos e seleção", properties: [
        { key: "input-bg", label: "Fundo do campo", type: "background" }, ...bgTrio("input-bg", "Campo em repouso"), ...bgTrio("input-focus-bg", "Campo em foco"),
        { key: "input-transition-direction", label: "Campo: direção do deslize no foco", type: "select", options: DIR },
        { key: "input-border", label: "Borda do campo", type: "text", placeholder: "1px solid rgba(255,105,180,0.3)" },
        { key: "input-border-focus", label: "Borda do campo em foco", type: "text", placeholder: "1px solid #ff69b4" },
        { key: "input-border-radius", label: "Raio da borda do campo", type: "text", placeholder: "6px" },
        { key: "select-bg", label: "Fundo da seleção", type: "background" }, ...bgTrio("select-bg", "Seleção fechada"), ...bgTrio("select-open-bg", "Seleção aberta"),
        { key: "select-transition-direction", label: "Seleção: direção do deslize ao abrir", type: "select", options: DIR },
        { key: "select-border", label: "Borda da seleção", type: "text", placeholder: "1px solid rgba(255,105,180,0.3)" },
        { key: "select-border-focus", label: "Borda da seleção aberta", type: "text", placeholder: "1px solid #ff69b4" },
    ] },
    { id: "cards", title: "Cards", label: "Cartões", properties: [
        { key: "card-bg-color", label: "Fundo do cartão", type: "background" }, ...bgTrio("card-bg", "Cartão em repouso"), ...bgTrio("card-hover-bg", "Cartão no hover"),
        { key: "card-transition-direction", label: "Cartão: direção do deslize no hover", type: "select", options: DIR },
        { key: "card-border", label: "Borda do cartão", type: "text", placeholder: "1px solid rgba(124,58,237,0.3)" },
        { key: "card-border-radius", label: "Raio da borda do cartão", type: "text", placeholder: "12px" },
        { key: "card-shadow", label: "Sombra do cartão", type: "text", placeholder: "0 4px 15px rgba(0,0,0,0.2)" },
        { key: "card-padding", label: "Espaçamento interno", type: "text", placeholder: "16px" },
        ...bgTrio("card-header-bg", "Cabeçalho"), ...bgTrio("card-footer-bg", "Rodapé"),
    ] },
    { id: "effects", title: "Effects & Transitions", label: "Efeitos e transições", properties: [
        { key: "glow-enabled", label: "Brilho ligado", type: "boolean" },
        { key: "glow-intensity", label: "Intensidade do brilho", type: "text", placeholder: "15px" },
        { key: "transition-duration", label: "Duração da transição", type: "text", placeholder: "0.3s" },
        { key: "border-radius-small", label: "Raio da borda (pequeno)", type: "text", placeholder: "6px" },
        { key: "border-radius-medium", label: "Raio da borda (médio)", type: "text", placeholder: "12px" },
        { key: "border-radius-large", label: "Raio da borda (grande)", type: "text", placeholder: "16px" },
    ] },
];

// Mesmo texto de arquivo que a versão anterior gerava.
function serializeTheme(t) {
    const lines = ["---"];
    for (const sec of PROPERTY_SECTIONS) {
        lines.push(`# ${sec.title}`);
        for (const p of sec.properties) {
            const v = t[p.key];
            if (v === undefined || v === null || v === "") continue;
            if (typeof v === "string" && (v.includes("\n") || v.includes(":"))) lines.push(`${p.key}: "${v.replace(/"/g, '\\"')}"`);
            else if (typeof v === "boolean" || typeof v === "number") lines.push(`${p.key}: ${v}`);
            else lines.push(`${p.key}: "${v}"`);
        }
        lines.push("");
    }
    lines.push("---", "", `# ${t["theme-name"] || t["theme-id"]}`, "", t["theme-description"] || "Custom theme created with Theme Editor.");
    return lines.join("\n");
}

function uploadImage(onDone) {
    const input = document.createElement("input");
    input.type = "file"; input.accept = "image/*";
    input.onchange = (e) => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = (ev) => onDone(ev.target.result); r.readAsDataURL(f); };
    input.click();
}

function PropertyField({ prop, value, onChange, muted }) {
    let input;
    switch (prop.type) {
        case "color": input = <ColorPicker value={value || "#7c3aed"} onChange={onChange} size="small" />; break;
        case "gradient": input = <GradientBuilder value={value || "linear-gradient(90deg, #7c3aed, #a78bfa)"} onChange={onChange} previewHeight={40} />; break;
        case "background": input = <BackgroundPicker value={value || ""} onChange={onChange} previewHeight={40} />; break;
        case "image": input = (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {value && <div style={{ width: 60, height: 60, borderRadius: 8, background: `url("${value}") center/contain no-repeat`, border: "1px solid rgba(255,255,255,0.1)" }} />}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <GloButton size="small" variant="liquid-glass" glow={false} label="Enviar imagem" onClick={() => uploadImage(onChange)} />
                    {value && <GloButton size="small" variant="liquid-glass" glow={false} label="Remover" onClick={() => onChange("")} style={{ color: "#ff6666" }} />}
                </div>
            </div>
        ); break;
        case "select": input = <GloSelect value={value || ""} options={prop.options} onChange={onChange} size="small" style={{ width: "100%" }} />; break;
        case "number": input = (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input type="range" min={prop.min || 0} max={prop.max || 100} value={value || prop.min || 0} onInput={(e) => onChange(parseInt(e.target.value))} style={{ flex: 1, minHeight: 24 }} />
                <span style={{ fontSize: 12, color: muted, minWidth: 50, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{value || 0}{prop.unit || ""}</span>
            </div>
        ); break;
        case "boolean": input = <GloButton size="small" variant="liquid-glass" glow={false} active={!!value} label={value ? "Ligado" : "Desligado"} onClick={() => onChange(!value)} />; break;
        case "textarea": input = <textarea className="dcg-te-in" value={value || ""} placeholder={prop.placeholder} rows={3} onInput={(e) => onChange(e.target.value)} style={{ resize: "vertical", minHeight: 80 }} />; break;
        default: input = <input type="text" className="dcg-te-in" value={value || ""} placeholder={prop.placeholder} onInput={(e) => onChange(e.target.value)} />;
    }
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: muted }}>{prop.label}{prop.required && <span style={{ color: "#ff6666" }}> *</span>}</label>
            {input}
        </div>
    );
}

function ThemeEditor({ initialThemeId = null }) {
    useTheme();
    const { themes } = useAvailableThemes();
    const [edited, setEdited] = dc.useState({ ...DEFAULT_THEME });
    const [original, setOriginal] = dc.useState(null);
    const [themeId, setThemeId] = dc.useState(initialThemeId || "");
    const [section, setSection] = dc.useState("metadata");
    const [saving, setSaving] = dc.useState(false);
    const [dirty, setDirty] = dc.useState(false);
    const [collapsed, setCollapsed] = dc.useState(false);
    // A prévia anda um quadro atrás da edição: arrastos e digitação viram um render por quadro.
    const [preview, setPreview] = dc.useState(edited);
    const raf = dc.useRef(0);
    dc.useEffect(() => { cancelAnimationFrame(raf.current); raf.current = requestAnimationFrame(() => setPreview(edited)); }, [edited]);
    dc.useEffect(() => () => cancelAnimationFrame(raf.current), []);

    dc.useEffect(() => {
        let live = true;
        (async () => {
            const t = themeId ? { ...DEFAULT_THEME, ...(await loadThemeById(themeId)) } : { ...DEFAULT_THEME, "theme-id": "", "theme-name": "" };
            if (!live) return;
            setEdited(t); setOriginal(themeId ? t : null); setDirty(false);
        })();
        return () => { live = false; };
    }, [themeId]);

    const update = (key, value) => {
        setEdited(prev => { const u = { ...prev, [key]: value }; return key.startsWith("color-") ? deriveGlowColors(u) : u; });
        setDirty(true);
    };

    const save = async (asNew = false) => {
        const id = edited["theme-id"];
        if (!id) { new Notice("Informe o ID do tema"); return; }
        setSaving(true);
        try {
            const content = serializeTheme(edited);
            const path = asNew || !original ? `System/Temas/${id}.md` : (themes.find(t => t.id === original["theme-id"])?.path || `System/Temas/${id}.md`);
            const existing = app.vault.getAbstractFileByPath(path);
            if (existing && asNew) { new Notice(`O arquivo já existe: ${path}`); setSaving(false); return; }
            if (existing) await app.vault.modify(existing, content); else await app.vault.create(path, content);
            new Notice(`Tema salvo em ${path}`);
            setOriginal({ ...edited }); setDirty(false); setThemeId(id);
        } catch (e) { console.error("[dc-themeEditor]", e); new Notice("Falha ao salvar o tema: " + e.message); }
        setSaving(false);
    };
    const reset = () => { setEdited(original ? { ...original } : { ...DEFAULT_THEME, "theme-id": "", "theme-name": "" }); setDirty(false); };

    const primary = edited["color-primary"] || edited["color-accent"] || "#7c3aed", accent = edited["color-accent"] || "#f59e0b";
    const surface = edited["color-surface"] || "var(--background-secondary)", bg = edited["color-background"] || "var(--background-primary)";
    const text = edited["color-text"] || "var(--text-normal)", muted = edited["color-text-muted"] || "#a0a0b0";
    const cur = PROPERTY_SECTIONS.find(s => s.id === section) || PROPERTY_SECTIONS[0];
    const vars = { "--te-line": alpha(primary, 0.27), "--te-muted": muted, "--te-text": text, "--te-hover": alpha(primary, 0.13), "--te-primary": primary };
    const btn = { size: "small", variant: "liquid-glass", glow: false };

    return (
        <div className="dc-theme-editor-container" style={{ padding: 24, borderRadius: 16, minHeight: 600, display: "flex", flexDirection: "column", background: bg, color: text, ...vars }}>
            <div className="dc-theme-editor-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: primary }}>Editor de temas</h2>
                    <p style={{ margin: "4px 0 0", fontSize: 13, color: muted }}>Crie e ajuste temas com prévia ao vivo</p>
                </div>
                {dirty && <span style={{ fontSize: 11, padding: "4px 10px", borderRadius: 12, fontWeight: 500, background: "#f59e0b33", color: "#f59e0b" }}>Alterações não salvas</span>}
            </div>
            <div className="dc-theme-editor-selector" style={{ display: "flex", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
                <span style={{ fontSize: 12, color: muted }}>Editar tema:</span>
                <GloSelect value={themeId} options={[{ value: "", label: "+ Novo tema" }, ...themes.map(t => ({ value: t.id, label: t.name }))]} onChange={setThemeId} size="small" style={{ minWidth: 220 }} />
            </div>
            <div className="dc-theme-editor-main">
                <div className="dc-theme-editor-preview-wrapper">
                    <StickyPreview title="Prévia ao vivo" subtitle={edited["theme-name"] || edited["theme-id"] || "Sem nome"} primaryColor={primary} surfaceColor={surface} backgroundColor={bg} textColor={text} textMuted={muted} defaultCollapsed={collapsed} onToggle={setCollapsed}>
                        <ThemePreviewContent theme={preview} />
                    </StickyPreview>
                </div>
                <div className="dc-theme-editor-content-wrapper">
                    <div className="dc-theme-editor-column" style={{ background: surface, borderColor: alpha(primary, 0.13) }}>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", padding: "12px 14px", borderBottom: `1px solid ${alpha(primary, 0.13)}` }}>
                            {PROPERTY_SECTIONS.map(s => <button key={s.id} className="dcg-te-chip" data-on={s.id === section ? "" : undefined} onClick={() => setSection(s.id)}>{s.label}</button>)}
                        </div>
                        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
                            {cur.properties.map(p => <PropertyField key={p.key} prop={p} value={edited[p.key]} onChange={(v) => update(p.key, v)} muted={muted} />)}
                        </div>
                    </div>
                </div>
            </div>
            <div className="dc-theme-editor-footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 20, marginTop: 20, borderTop: `1px solid ${alpha(primary, 0.13)}`, flexWrap: "wrap", gap: 12 }}>
                <div className="dc-theme-editor-footer-left" style={{ display: "flex", gap: 10 }}>
                    <GloButton {...btn} label="Desfazer alterações" onClick={reset} disabled={!dirty} />
                </div>
                <div className="dc-theme-editor-footer-right" style={{ display: "flex", gap: 10 }}>
                    {original && <GloButton {...btn} label="Salvar como novo" onClick={() => save(true)} disabled={saving || !edited["theme-id"]} />}
                    <button className="dcg-td-btn" onClick={() => save(false)} disabled={saving || !edited["theme-id"]}
                        style={{ padding: "10px 22px", fontSize: 13, fontWeight: 600, color: "var(--text-on-accent)", border: "none", borderRadius: 8, cursor: "pointer", minHeight: 40, background: `linear-gradient(135deg, ${primary}, ${accent})`, opacity: !saving && edited["theme-id"] ? 1 : 0.5 }}>
                        {saving ? "Salvando..." : original ? "Salvar alterações" : "Criar tema"}
                    </button>
                </div>
            </div>
        </div>
    );
}

const renderedView = <ThemeEditor />;
return { renderedView, ThemeEditor, PROPERTY_SECTIONS, serializeTheme };
