// ═══════════════════════════════════════════════════════════════════════════════
// THEME DASHBOARD v3 (Painel de temas)
// Escolher pacote de sprites (System/Temas), sobreposição de cores
// (style-settings-*.json), prévia ao vivo de todos os Glo*, fundo dos widgets,
// aplicar e sincronizar com o Obsidian, limpar cache. onEditTheme(id) abre o
// editor (Theme Studio).
//
// Grava (mesmo formato): Settings `widget-theme`, `color-override` (via
// switchTheme) e `widget-backgrounds`.
// Mudanças: hover dos cartões por CSS (antes, setState por mouseenter
// re-renderizava o painel e a prévia inteira); miniaturas lidas direto do cache
// (antes, efeito + estado por cartão: 2 renders cada); amostras de cores lidas
// uma vez por arquivo e guardadas por data de modificação; fundo dos widgets
// reativo ao Settings (antes, lido uma vez); prévia do tema ativo sem carga
// assíncrona (antes, todo painel aberto renderizava a prévia duas vezes);
// rótulos em pt-BR.
// ═══════════════════════════════════════════════════════════════════════════════

const { useTheme, useAvailableThemes, useAvailableColorSchemes, switchTheme, clearThemeCache, loadThemeById, loadColorOverride, mapStyleSettingsToWidgetProps, deriveGlowColors } = await dc.require(dc.fileLink("System/Scripts/Core/dc-themeProvider.jsx"));
const { GloButton, alpha } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloButton.jsx"));
const { ThemePreviewContent } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-themePreviewContent.jsx"));
const { StickyPreview } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-stickyPreview.jsx"));

const SETTINGS_PATH = "System/Settings.md";
const CSS_ID = "dc-theme-dashboard-responsive-css";
const CSS = `
.dc-theme-dashboard-main{display:flex;flex-direction:column;gap:20px;margin-bottom:24px}
.dc-theme-dashboard-preview-wrapper{order:1}
.dc-theme-dashboard-console-wrapper{order:2}
.dc-theme-dashboard-console{display:flex;flex-direction:column;gap:20px}
.dcg-td-card{transition:transform .2s ease, box-shadow .2s ease}
.dcg-td-card:not([data-sel]):hover{transform:translateY(-2px);box-shadow:0 8px 20px var(--td-glow)}
.dcg-td-btn:not(#dcg){border:none;box-shadow:none;cursor:pointer;transition:filter .2s ease}
.dcg-td-btn:not(#dcg):not(:disabled):hover{filter:brightness(1.12)}
@media (min-width:641px){
 .dc-theme-dashboard-main{display:grid;grid-template-columns:380px 1fr;gap:24px}
 .dc-theme-dashboard-preview-wrapper{order:2;position:relative}
 .dc-theme-dashboard-console-wrapper{order:1}
 .dc-theme-dashboard-preview-wrapper .dc-sticky-preview{position:sticky;top:0;max-height:calc(100vh - 200px);overflow:hidden}
 .dc-theme-dashboard-preview-wrapper .dc-sticky-preview-content.expanded{overflow-y:auto;max-height:calc(100vh - 280px)}
}
@media (max-width:640px){
 .dc-theme-dashboard-container{padding:16px}
 .dc-theme-dashboard-header{flex-direction:column;gap:12px;align-items:flex-start}
 .dc-theme-dashboard-footer{flex-direction:column;gap:12px;align-items:stretch}
 .dc-theme-dashboard-footer button{width:100%}
 .dc-theme-dashboard-scheme-grid{grid-template-columns:1fr 1fr}
 .dc-theme-dashboard-apply-btn{min-height:48px}
}`;
{ let el = document.getElementById(CSS_ID); if (!el) { el = document.createElement("style"); el.id = CSS_ID; document.head.appendChild(el); } if (el.textContent !== CSS) el.textContent = CSS; }   // só toca no <style> se mudou: trocar a folha a cada bloco recalcula o estilo da página inteira

// Amostras dos esquemas: um JSON por arquivo, relido só quando o arquivo muda.
const SWATCH = window.__dcSchemeSwatches || (window.__dcSchemeSwatches = new Map());
function useSchemeSwatch(path) {
    const f = app.vault.getAbstractFileByPath(path);
    const key = f ? `${path}@${f.stat.mtime}` : null;
    const [, bump] = dc.useState(0);
    dc.useEffect(() => {
        if (!f || SWATCH.has(key)) return;
        let live = true;
        app.vault.cachedRead(f).then(txt => {
            const j = JSON.parse(txt);
            SWATCH.set(key, { primary: j["minimal-style@@ui3@@dark"] || "#7c3aed", bg: j["minimal-style@@ui1@@dark"] || "var(--background-primary)", accent: j["minimal-style@@ax3@@dark"] || "#f59e0b", h1: j["minimal-style@@h1-color@@dark"] || "var(--text-normal)" });
            if (live) bump(n => n + 1);
        }).catch(e => console.warn("[dc-themeDashboard] esquema:", e));
        return () => { live = false; };
    }, [key]);
    return key ? SWATCH.get(key) : null;
}

function ThemePreviewMini({ themePath }) {
    const f = app.vault.getAbstractFileByPath(themePath);
    const fm = (f && app.metadataCache.getFileCache(f)?.frontmatter) || {};
    return (
        <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: 6, padding: 8, marginBottom: 8, position: "relative" }}>
            <div style={{ width: "100%", height: 8, borderRadius: 4, background: fm["bar-fill-gradient"] || "linear-gradient(90deg, #7c3aed, #a78bfa)" }} />
            {(fm["bar-sprite"] || fm["toggle-sprite"]) && <div style={{ position: "absolute", top: 4, right: 4, fontSize: 9, padding: "2px 6px", background: "rgba(255,255,255,0.2)", borderRadius: 4, color: "rgba(255,255,255,0.85)", fontWeight: 600 }}>GIF</div>}
        </div>
    );
}

function ColorSchemePreview({ schemePath }) {
    const c = useSchemeSwatch(schemePath);
    const sw = { width: 16, height: 16, borderRadius: 4, border: "1px solid rgba(255,255,255,0.2)" };
    return (
        <div style={{ display: "flex", justifyContent: "center", gap: 4, marginBottom: 6 }}>
            {c ? [["Primária", c.primary], ["Destaque", c.accent], ["Título", c.h1], ["Fundo", c.bg]].map(([t, v]) => <div key={t} title={t} style={{ ...sw, background: v }} />) : <div style={sw} />}
        </div>
    );
}

function WidgetSettingsPanel({ primaryColor, accentColor, textMuted, surfaceColor }) {
    dc.useFile(SETTINGS_PATH);
    const f = app.vault.getAbstractFileByPath(SETTINGS_PATH);
    const on = ((f && app.metadataCache.getFileCache(f)?.frontmatter) || {})["widget-backgrounds"] !== false;
    const toggle = async () => {
        try {
            if (!f) return;
            await app.fileManager.processFrontMatter(f, fm => { fm["widget-backgrounds"] = !on; });
            new Notice(`Fundos dos widgets ${!on ? "ligados" : "desligados"}`);
        } catch (e) { console.error(e); new Notice("Falha ao salvar a configuração"); }
    };
    return (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "12px 14px", background: surfaceColor, borderRadius: 8, border: `1px solid ${alpha(primaryColor, 0.13)}`, minHeight: 56 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>Fundos dos widgets</span>
                <span style={{ fontSize: 11, color: textMuted }}>Mostrar o fundo dos contêineres dos widgets</span>
            </div>
            <GloButton size="small" variant="liquid-glass" glow={false} active={on} label={on ? "Ligado" : "Desligado"} onClick={toggle} />
        </div>
    );
}

function ThemeDashboard({ onEditTheme = null }) {
    const { theme: activeTheme, themeName: activeName, colorOverrideName } = useTheme();
    const { themes } = useAvailableThemes();
    const { schemes } = useAvailableColorSchemes();
    const [themeId, setThemeId] = dc.useState(activeName);
    const [scheme, setScheme] = dc.useState(colorOverrideName || "");
    const [useOverride, setUseOverride] = dc.useState(!!colorOverrideName);
    const [applying, setApplying] = dc.useState(false);
    const [collapsed, setCollapsed] = dc.useState(false);
    const [preview, setPreview] = dc.useState(null);
    const [previewLoading, setPreviewLoading] = dc.useState(false);

    dc.useEffect(() => { setThemeId(activeName); setScheme(colorOverrideName || ""); setUseOverride(!!colorOverrideName); }, [activeName, colorOverrideName]);
    // Seleção igual ao tema ativo: a prévia é o próprio tema ativo, sem carga
    // assíncrona nem segundo render da prévia inteira ao abrir o painel.
    const same = themeId === activeName && (useOverride ? scheme : "") === (colorOverrideName || "");
    dc.useEffect(() => {
        if (!themeId || same) { setPreview(null); setPreviewLoading(false); return; }
        let live = true;
        (async () => {
            setPreviewLoading(true);
            try {
                let t = await loadThemeById(themeId);
                if (useOverride && scheme) {
                    const o = await loadColorOverride(scheme);
                    if (o) t = deriveGlowColors({ ...t, ...mapStyleSettingsToWidgetProps(o) });
                }
                if (live) setPreview(t);
            } catch (e) { console.error("[dc-themeDashboard] prévia:", e); if (live) setPreview(activeTheme); }
            if (live) setPreviewLoading(false);
        })();
        return () => { live = false; };
    }, [themeId, useOverride, scheme, same]);

    const apply = async () => {
        setApplying(true);
        try { await switchTheme(themeId, useOverride ? scheme : "", true); }
        catch (e) { console.error(e); new Notice("Falha ao aplicar o tema"); setApplying(false); }
    };
    const changed = themeId !== activeName || (useOverride ? scheme : "") !== (colorOverrideName || "");

    const t = preview || activeTheme;
    const primary = t["color-primary"] || t["color-accent"] || "#7c3aed", accent = t["color-accent"] || "#f59e0b";
    const surface = t["color-surface"] || "var(--background-secondary)", bg = t["color-background"] || "var(--background-primary)";
    const text = t["color-text"] || "var(--text-normal)", muted = t["color-text-muted"] || "#a0a0b0";
    const secTitle = { fontSize: 14, fontWeight: 600, margin: "0 0 8px", textTransform: "uppercase", letterSpacing: ".5px", color: primary };

    if (applying) return <div className="dc-theme-dashboard-container" style={{ padding: 60, textAlign: "center", color: muted, fontSize: 14 }}>Aplicando o tema e sincronizando com o Obsidian...</div>;

    return (
        <div className="dc-theme-dashboard-container" style={{ padding: 24, borderRadius: 16, background: bg, color: text, border: `1px solid ${alpha(primary, 0.2)}` }}>
            <div className="dc-theme-dashboard-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
                <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: primary }}>Painel de temas</h2>
                <div style={{ fontSize: 11, color: muted, padding: "6px 12px", background: "rgba(255,255,255,0.08)", borderRadius: 20, fontWeight: 500 }}>Ativo: {activeName}{colorOverrideName ? ` + ${colorOverrideName}` : ""}</div>
            </div>
            <div className="dc-theme-dashboard-main">
                <div className="dc-theme-dashboard-preview-wrapper">
                    <StickyPreview title="Prévia ao vivo" subtitle={preview?.["theme-name"] || themeId} primaryColor={primary} surfaceColor={surface} backgroundColor={bg} textColor={text} textMuted={muted} defaultCollapsed={collapsed} onToggle={setCollapsed}>
                        {previewLoading && !preview ? <div style={{ padding: 40, textAlign: "center", color: muted }}>Carregando prévia...</div> : <ThemePreviewContent theme={t} />}
                    </StickyPreview>
                </div>
                <div className="dc-theme-dashboard-console-wrapper">
                    <div className="dc-theme-dashboard-console">
                        <div>
                            <h3 style={secTitle}>Pacote de sprites</h3>
                            <p style={{ fontSize: 12, margin: "0 0 12px", color: muted }}>Personagem animado das barras de progresso e alternadores</p>
                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                {themes.map(th => {
                                    const sel = th.id === themeId;
                                    return (
                                        <div key={th.id} className="dcg-td-card" data-sel={sel ? "" : undefined} onClick={() => setThemeId(th.id)}
                                            style={{ "--td-glow": alpha(primary, 0.13), padding: 14, borderRadius: 10, cursor: "pointer", position: "relative", minHeight: 60, background: sel ? `linear-gradient(135deg, ${alpha(primary, 0.2)}, ${surface})` : surface, border: sel ? `2px solid ${primary}` : `1px solid ${alpha(primary, 0.2)}`, boxShadow: "0 2px 8px rgba(0,0,0,0.2)" }}>
                                            <ThemePreviewMini themePath={th.path} />
                                            <div style={{ display: "flex", flexDirection: "column", gap: 2, paddingRight: onEditTheme ? 70 : 0 }}>
                                                <span style={{ fontSize: 13, fontWeight: 600, color: sel ? primary : text }}>{th.name}</span>
                                                <span style={{ fontSize: 10, lineHeight: 1.3, color: muted }}>{th.description || "Pacote de sprites"}</span>
                                            </div>
                                            {onEditTheme && <button className="dcg-td-btn" title={`Editar ${th.name}`} onClick={(e) => { e.stopPropagation(); onEditTheme(th.id); }} style={{ position: "absolute", bottom: 8, right: 8, fontSize: 11, fontWeight: 600, padding: "6px 12px", borderRadius: 6, zIndex: 5, minHeight: 32, background: alpha(primary, 0.13), color: primary, outline: `1px solid ${alpha(primary, 0.27)}` }}>Editar</button>}
                                            {sel && <div style={{ position: "absolute", top: 8, right: 8, fontSize: 9, fontWeight: 700, padding: "3px 8px", borderRadius: 10, color: "#fff", background: primary, textTransform: "uppercase", letterSpacing: ".3px" }}>Escolhido</div>}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        <div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                                <h3 style={{ ...secTitle, margin: 0 }}>Sobreposição de cores</h3>
                                <GloButton size="small" variant="liquid-glass" glow={false} active={useOverride} label={useOverride ? "Ativada" : "Desativada"}
                                    onClick={() => { const on = !useOverride; setUseOverride(on); if (!on) setScheme(""); else if (schemes.length && !scheme) setScheme(schemes[0].name); }} />
                            </div>
                            {useOverride ? (
                                <div className="dc-theme-dashboard-scheme-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
                                    {schemes.map(s => {
                                        const sel = s.name === scheme;
                                        return (
                                            <div key={s.name} className="dcg-td-card" data-sel={sel ? "" : undefined} onClick={() => setScheme(s.name)}
                                                style={{ "--td-glow": alpha(accent, 0.13), padding: 12, borderRadius: 8, cursor: "pointer", textAlign: "center", minHeight: 60, background: sel ? `linear-gradient(135deg, ${alpha(accent, 0.2)}, ${surface})` : surface, border: sel ? `2px solid ${accent}` : `1px solid ${alpha(accent, 0.2)}` }}>
                                                <ColorSchemePreview schemePath={s.path} />
                                                <span style={{ fontSize: 11, fontWeight: 600, color: sel ? accent : text }}>{s.name}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : <div style={{ padding: 14, background: "rgba(255,255,255,0.03)", borderRadius: 8, fontSize: 12, textAlign: "center", fontStyle: "italic", color: muted }}>Usando as cores do próprio pacote de sprites</div>}
                        </div>
                        <div>
                            <h3 style={secTitle}>Widgets</h3>
                            <WidgetSettingsPanel primaryColor={primary} accentColor={accent} textMuted={muted} surfaceColor={surface} />
                        </div>
                        <div style={{ marginTop: 8, textAlign: "center" }}>
                            <button className="dcg-td-btn dc-theme-dashboard-apply-btn" onClick={apply} disabled={!changed}
                                style={{ width: "100%", padding: "14px 24px", fontSize: 14, fontWeight: 700, color: "#fff", borderRadius: 10, minHeight: 48, background: changed ? `linear-gradient(135deg, ${primary}, ${accent})` : surface, opacity: changed ? 1 : 0.5, cursor: changed ? "pointer" : "not-allowed", boxShadow: changed ? `0 4px 20px ${alpha(primary, 0.27)}` : "none" }}>
                                {changed ? "Aplicar tema e sincronizar" : "Sem mudanças"}
                            </button>
                            {changed && <div style={{ marginTop: 10, fontSize: 11, color: muted }}>Prévia: <strong style={{ color: primary }}>{themeId}</strong>{useOverride && scheme && <> + <strong style={{ color: accent }}>{scheme}</strong></>}</div>}
                        </div>
                    </div>
                </div>
            </div>
            <div className="dc-theme-dashboard-footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 16, flexWrap: "wrap", gap: 12, borderTop: `1px solid ${alpha(primary, 0.13)}` }}>
                <GloButton size="small" variant="liquid-glass" glow={false} label="Limpar cache" onClick={() => { clearThemeCache(); new Notice("Cache de temas limpo. Recarregue para atualizar."); }} />
                <span style={{ fontSize: 11, color: muted }}>{themes.length} pacotes de sprites disponíveis</span>
            </div>
        </div>
    );
}

const renderedView = <ThemeDashboard />;
return { renderedView, ThemeDashboard };
