// ═══════════════════════════════════════════════════════════════════════════════
// JOURNAL NAV v2 (Navegador do diário)
// Numa nota diária (AAAA-MM-DD): voltar/avançar dias e ver, no lugar, a seção
// "### 📔" daquele dia até o próximo "---"; clicar na data volta a hoje.
// Mudanças: data pela nota do bloco (antes, a nota ativa: errado em embed);
// hooks antes de qualquer retorno; prévia renderizada pelo Markdown do Obsidian
// (antes, substituição de **negrito**/[[links]] por HTML, links mortos);
// carregamento de dc-journal.css removido (o arquivo não existe na vault).
// ═══════════════════════════════════════════════════════════════════════════════

const { gate } = await dc.require(dc.fileLink("System/Scripts/Core/dc-visibleGate.jsx"));
const { GloButton } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloButton.jsx"));

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const NO_NOTE = "Não existe nota para este dia.";

function JournalBrowserReal() {
    const path = dc.useCurrentPath();
    const base = (path || "").split("/").pop().replace(/\.md$/, "");
    const m = base.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const today = m ? iso(new Date(+m[1], +m[2] - 1, +m[3])) : null;
    const [day, setDay] = dc.useState(today);
    const [preview, setPreview] = dc.useState(null);   // { path, text } | { msg }
    const [loading, setLoading] = dc.useState(false);

    dc.useEffect(() => { setDay(today); }, [today]);
    dc.useEffect(() => {
        if (!day || day === today) { setPreview(null); return; }
        let live = true;
        (async () => {
            setLoading(true);
            const file = app.metadataCache.getFirstLinkpathDest(day, "");
            let out;
            if (!file) out = { msg: NO_NOTE };
            else {
                const parts = (await app.vault.cachedRead(file)).split(/^###\s+📔.*$/m);
                out = parts.length > 1 ? { path: file.path, text: parts[1].split(/^\s*---/m)[0].trim() } : { path: file.path, msg: "A nota existe, mas não tem a seção \"### 📔\"." };
            }
            if (live) { setPreview(out); setLoading(false); }
        })();
        return () => { live = false; };
    }, [day, today]);

    if (!today) return <div style={{ opacity: 0.5, fontSize: 12 }}>Abra uma nota diária (AAAA-MM-DD) para navegar.</div>;
    const shift = (n) => { const [y, mo, d] = day.split("-").map(Number); setDay(iso(new Date(y, mo - 1, d + n))); };
    const [y, mo, d] = day.split("-").map(Number);
    const label = new Date(y, mo - 1, d).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "short" });
    const isToday = day === today;
    const btn = { size: "small", variant: "liquid-glass", glow: false };

    return (
        <div>
            <div className="dc-journal-nav" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 12, paddingBottom: 10, borderBottom: "1px solid var(--background-modifier-border)", fontSize: 13 }}>
                <GloButton {...btn} label="← Anterior" onClick={() => shift(-1)} />
                <span style={{ fontWeight: 700, cursor: "pointer", textAlign: "center" }} onClick={() => setDay(today)} title="Voltar para hoje">
                    {label}{!isToday && <span style={{ fontSize: "0.8em", opacity: 0.6, marginLeft: 6, fontWeight: 400 }}>(vendo)</span>}
                </span>
                <GloButton {...btn} label="Próximo →" onClick={() => shift(1)} />
            </div>
            {!isToday && (
                <div style={{ background: "var(--background-secondary-alt)", border: "1px dashed var(--background-modifier-border)", padding: 14, borderRadius: 6, margin: "10px 0 20px", minHeight: 60 }}>
                    {loading || !preview ? <span style={{ opacity: 0.6 }}>Carregando...</span>
                        : preview.text ? <dc.Markdown content={preview.text} sourcePath={preview.path} inline={false} />
                        : <span style={{ fontStyle: "italic", opacity: 0.7 }}>{preview.text === "" ? "Seção vazia." : preview.msg}</span>}
                    {preview?.path && (
                        <div style={{ marginTop: 10, textAlign: "right", fontSize: 12 }}>
                            <span className="dcg-link" style={{ cursor: "pointer", opacity: 0.7 }} onClick={() => app.workspace.openLinkText(preview.path, "", false)}>Abrir nota ↗</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

const JournalBrowser = gate(JournalBrowserReal);
return { Func: JournalBrowser, JournalBrowser };
