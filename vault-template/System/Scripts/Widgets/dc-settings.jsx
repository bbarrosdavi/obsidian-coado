// ═══════════════════════════════════════════════════════════════════════════════
// DC-SETTINGS v2 (Configurações do LifeOS)
// Abas: Tema (o Painel de temas) e Ordem (ordem das abas instaladas do wrapper
// diário, com setas e "Salvar ordem").
//
// Grava (mesmo formato): Settings `installed-modules` (a mesma lista, reordenada).
// Mudanças: lista reativa ao Settings (antes, lida uma vez ao montar; a ordem
// salva por cima de uma mudança externa a desfazia); Painel de temas carregado
// junto com o módulo (antes, num efeito depois do 1º render, com "Carregando");
// sem emojis (os ícones-emoji dos módulos não aparecem); rótulos em pt-BR; a
// frase "arraste" saiu porque não existe arrasto; portão de visibilidade (a
// cópia oculta do editor montava o painel de temas inteiro de novo).
// ═══════════════════════════════════════════════════════════════════════════════

const { useTheme } = await dc.require(dc.fileLink("System/Scripts/Core/dc-themeProvider.jsx"));
const { GloButton, alpha, hexToRgba } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloButton.jsx"));
const { GloCard } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloCard.jsx"));
const { gate } = await dc.require(dc.fileLink("System/Scripts/Core/dc-visibleGate.jsx"));

let ThemeDashboard = null, dashError = null;
try { ThemeDashboard = (await dc.require(dc.fileLink("System/Scripts/Widgets/dc-themeDashboard.jsx"))).ThemeDashboard; }
catch (e) { console.error("[dc-settings] Painel de temas:", e); dashError = "Painel de temas indisponível"; }

const SETTINGS_PATH = "System/Settings.md";

function OrderSection({ modules, theme }) {
    const primary = theme["color-primary"] || "#7c3aed", text = theme["color-text"] || "var(--text-normal)", muted = theme["color-text-muted"] || "var(--text-muted)";
    const [order, setOrder] = dc.useState(null);   // ids na nova ordem, enquanto não salva
    const list = order ? order.map(id => modules.find(m => m.id === id)).filter(Boolean) : modules;
    const move = (i, d) => { const ids = list.map(m => m.id); const j = i + d; if (j < 0 || j >= ids.length) return; [ids[i], ids[j]] = [ids[j], ids[i]]; setOrder(ids); };
    const save = async () => {
        const f = app.vault.getAbstractFileByPath(SETTINGS_PATH);
        if (!f || !order) return;
        // Reordena a lista atual do arquivo pelos ids escolhidos; módulos novos ficam no fim.
        await app.fileManager.processFrontMatter(f, (fm) => {
            const cur = Array.isArray(fm["installed-modules"]) ? fm["installed-modules"] : [];
            const byId = new Map(cur.map(m => [m.id, m]));
            fm["installed-modules"] = [...order.map(id => byId.get(id)).filter(Boolean), ...cur.filter(m => !order.includes(m.id))];
        });
        setOrder(null);
        new Notice("Ordem das abas salva");
    };
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ fontSize: 13, color: muted }}>Use as setas para reordenar as abas do wrapper diário.</div>
            {!list.length ? (
                <GloCard size="large"><div style={{ textAlign: "center", color: muted }}>Nenhum módulo instalado.</div></GloCard>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {list.map((m, i) => (
                        <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: hexToRgba(primary, 0.1), border: `1px solid ${alpha(primary, 0.2)}`, borderRadius: 10 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: muted, width: 24, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>{i + 1}</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 600, color: text }}>{m.label}</div>
                                <div style={{ fontSize: 11, color: muted }}>{m.description || "Cápsula personalizada"}</div>
                            </div>
                            <div style={{ display: "flex", gap: 4 }}>
                                <GloButton size="small" variant="liquid-glass" glow={false} label="↑" onClick={() => move(i, -1)} disabled={i === 0} style={{ opacity: i === 0 ? 0.3 : 1 }} />
                                <GloButton size="small" variant="liquid-glass" glow={false} label="↓" onClick={() => move(i, 1)} disabled={i === list.length - 1} style={{ opacity: i === list.length - 1 ? 0.3 : 1 }} />
                            </div>
                        </div>
                    ))}
                </div>
            )}
            {order && (
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                    <GloButton size="small" variant="liquid-glass" glow={false} active label="Salvar ordem" onClick={save} />
                </div>
            )}
        </div>
    );
}

function SettingsReal() {
    const { theme } = useTheme();
    dc.useFile(SETTINGS_PATH);
    const f = app.vault.getAbstractFileByPath(SETTINGS_PATH);
    const fm = (f && app.metadataCache.getFileCache(f)?.frontmatter) || {};
    const [tab, setTab] = dc.useState("theme");
    const primary = theme["color-primary"] || "#7c3aed", text = theme["color-text"] || "var(--text-normal)", muted = theme["color-text-muted"] || "var(--text-muted)";

    return (
        <div style={{ background: "var(--background-secondary, transparent)", borderRadius: 16, border: `1px solid ${alpha(primary, 0.2)}`, overflow: "hidden" }}>
            <div style={{ padding: "18px 24px", borderBottom: `1px solid ${alpha(primary, 0.13)}`, background: hexToRgba(primary, 0.05) }}>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: text }}>Configurações</h2>
                <div style={{ fontSize: 12, color: muted }}>Aparência e organização do LifeOS</div>
            </div>
            <div style={{ display: "flex", gap: 6, padding: "10px 16px", borderBottom: `1px solid ${alpha(primary, 0.13)}`, background: hexToRgba(primary, 0.02) }}>
                {[["theme", "Tema"], ["order", "Ordem"]].map(([id, l]) => <GloButton key={id} variant="liquid-glass" glow={false} active={tab === id} label={l} onClick={() => setTab(id)} style={{ flex: 1 }} />)}
            </div>
            <div style={{ padding: 20 }}>
                {tab === "theme" && (ThemeDashboard ? <ThemeDashboard /> : <div style={{ padding: 20, textAlign: "center", color: muted }}>{dashError}</div>)}
                {tab === "order" && <OrderSection modules={Array.isArray(fm["installed-modules"]) ? fm["installed-modules"] : []} theme={theme} />}
            </div>
        </div>
    );
}

const Settings = gate(SettingsReal);
return { Settings, Func: Settings };
