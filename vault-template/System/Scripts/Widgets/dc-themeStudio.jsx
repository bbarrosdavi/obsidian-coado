// ═══════════════════════════════════════════════════════════════════════════════
// THEME STUDIO v2
// Junta o Painel de temas e o Editor de temas: alternar entre os dois, abrir
// o editor já no tema do cartão ("Editar"), ligar/desligar o modo Flashy.
//
// Grava (mesmo formato): Settings `flashy-mode` (booleano).
// Mudanças: estado do Flashy lido do Settings na hora e reativo (antes nascia
// ligado e corrigia num efeito: dois renders do estúdio inteiro ao abrir);
// CSS injetado no carregamento do módulo; rótulos em pt-BR, sem emojis; portão
// de visibilidade (a cópia oculta do editor montava o estúdio inteiro de novo);
// botão ativo com as cores do tema (usava --theme-primary, que nunca existiu, e
// saía sem o degradê).
// ═══════════════════════════════════════════════════════════════════════════════

const { useTheme } = await dc.require(dc.fileLink("System/Scripts/Core/dc-themeProvider.jsx"));
const { ThemeDashboard } = await dc.require(dc.fileLink("System/Scripts/Widgets/dc-themeDashboard.jsx"));
const { ThemeEditor } = await dc.require(dc.fileLink("System/Scripts/Widgets/dc-themeEditor.jsx"));
const { gate } = await dc.require(dc.fileLink("System/Scripts/Core/dc-visibleGate.jsx"));

const SETTINGS_PATH = "System/Settings.md";
const CSS_ID = "dc-theme-studio-responsive-css";
const CSS = `
.dc-theme-studio-container{display:flex;flex-direction:column;min-height:600px}
.dc-theme-studio-header{display:flex;justify-content:space-between;align-items:center;padding:16px 24px;border-radius:12px 12px 0 0;background:linear-gradient(135deg, var(--theme-surface), var(--theme-background));border-bottom:1px solid var(--theme-surface-hover)}
.dc-theme-studio-nav-left{display:flex;align-items:center;gap:16px;flex-wrap:wrap}
.dc-theme-studio-nav-right{display:flex;gap:10px}
.dc-theme-studio-nav-btn:not(#dcg){display:flex;align-items:center;gap:8px;padding:10px 18px;font-size:13px;font-weight:600;border-radius:10px;cursor:pointer;transition:all .2s ease;outline:none;box-shadow:none}
.dc-theme-studio-nav-btn.active:not(#dcg){background:linear-gradient(135deg, var(--st-primary), var(--st-accent));color:#fff;border:none;box-shadow:0 4px 12px var(--theme-surface-hover)}
.dc-theme-studio-nav-btn.inactive:not(#dcg){background:transparent;color:var(--theme-text-muted);border:1px solid var(--theme-surface-hover)}
.dc-theme-studio-nav-btn.inactive:not(#dcg):hover{background:var(--theme-surface-hover);color:var(--theme-text)}
.dc-theme-studio-title{margin:0;font-size:20px;font-weight:700;color:var(--st-primary)}
.dc-theme-studio-breadcrumb{font-size:12px;padding:4px 10px;background:rgba(255,255,255,0.08);border-radius:12px;color:var(--theme-text-muted)}
@media (max-width:640px){
 .dc-theme-studio-header{flex-direction:column;align-items:stretch;gap:16px;padding:16px}
 .dc-theme-studio-nav-left{justify-content:space-between;width:100%}
 .dc-theme-studio-nav-right{width:100%}
 .dc-theme-studio-nav-btn:not(#dcg){flex:1;justify-content:center}
}`;
{ let el = document.getElementById(CSS_ID); if (!el) { el = document.createElement("style"); el.id = CSS_ID; document.head.appendChild(el); } if (el.textContent !== CSS) el.textContent = CSS; }   // só toca no <style> se mudou: trocar a folha a cada bloco recalcula o estilo da página inteira

function ThemeStudio() {
    const { theme } = useTheme();
    const [mode, setMode] = dc.useState("dashboard");
    const [editId, setEditId] = dc.useState(null);
    dc.useFile(SETTINGS_PATH);
    const sFile = app.vault.getAbstractFileByPath(SETTINGS_PATH);
    const flashy = ((sFile && app.metadataCache.getFileCache(sFile)?.frontmatter) || {})["flashy-mode"] !== false;

    const toggleFlashy = async () => {
        if (!sFile) return;
        await app.fileManager.processFrontMatter(sFile, (fm) => { fm["flashy-mode"] = !flashy; });
        new Notice(`Modo Flashy: ${!flashy ? "ligado" : "desligado"}`);
    };
    const openEditor = (id = null) => { setEditId(id); setMode("editor"); };

    return (
        <div className="dc-theme-studio-container" style={{ "--st-primary": theme["color-primary"] || "var(--interactive-accent)", "--st-accent": theme["color-accent"] || theme["color-primary"] || "var(--interactive-accent)" }}>
            <div className="dc-theme-studio-header">
                <div className="dc-theme-studio-nav-left">
                    <h1 className="dc-theme-studio-title">Theme Studio</h1>
                    <span className="dc-theme-studio-breadcrumb">{mode === "dashboard" ? "Escolher e aplicar" : "Editar tema"}</span>
                    <button onClick={toggleFlashy} className={`dc-theme-studio-nav-btn ${flashy ? "active" : "inactive"}`} style={{ padding: "6px 12px", fontSize: 12 }}
                        title={flashy ? "Desligar efeitos (brilho, animações)" : "Ligar efeitos (brilho, animações)"}>Flashy {flashy ? "ligado" : "desligado"}</button>
                </div>
                <div className="dc-theme-studio-nav-right">
                    <button onClick={() => { setMode("dashboard"); setEditId(null); }} className={`dc-theme-studio-nav-btn ${mode === "dashboard" ? "active" : "inactive"}`}>Painel</button>
                    <button onClick={() => openEditor(null)} className={`dc-theme-studio-nav-btn ${mode === "editor" ? "active" : "inactive"}`}>Editor</button>
                </div>
            </div>
            <div style={{ flex: 1 }}>
                {mode === "dashboard" ? <ThemeDashboard onEditTheme={openEditor} /> : <ThemeEditor initialThemeId={editId} />}
            </div>
        </div>
    );
}

const GatedStudio = gate(ThemeStudio);
const renderedView = <GatedStudio />;
return { renderedView, ThemeStudio };
