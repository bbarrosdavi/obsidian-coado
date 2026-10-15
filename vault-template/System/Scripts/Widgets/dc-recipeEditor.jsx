// ═══════════════════════════════════════════════════════════════════════════════
// RECIPE EDITOR v3 - painel da nota de receita
// Tipo (café, almoço, jantar, lanche), porções, calorias e macros, avaliação.
//
// Grava na própria nota (mesmo formato): type ["[[Café da Manhã]]", ...],
// servings (texto), calories "350 kcal", protein/carbs/fat "20 g", rating (número).
// Correções: gravava na nota ativa (ctx.path não existe no datacore; agora o
// caminho do bloco); hook depois de retorno antecipado.
// ═══════════════════════════════════════════════════════════════════════════════

const { useTheme } = await dc.require(dc.fileLink("System/Scripts/Core/dc-themeProvider.jsx"));
const { gate } = await dc.require(dc.fileLink("System/Scripts/Core/dc-visibleGate.jsx"));
const { GloCard } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloCard.jsx"));
const { GloButton, alpha } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloButton.jsx"));
const { GloRating } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloRating.jsx"));

const TIPOS = ["Café da Manhã", "Almoço", "Jantar", "Snack"];
const norm = (s) => s ? String(s).replace(/[\[\]"#]/g, "").trim() : "";

function Field({ label, value, unit, color, onCommit, text = false }) {
    const shown = value == null ? "" : unit ? (Number.isFinite(parseFloat(String(value))) ? String(parseFloat(String(value))) : "") : String(value);
    const [draft, setDraft] = dc.useState(null);
    const commit = () => {
        if (draft === null) return;
        let out = draft;
        if (unit && draft !== "" && !isNaN(draft)) out = `${parseFloat(draft)} ${unit}`;
        if (String(out) !== String(value ?? "")) onCommit(out);
        setDraft(null);
    };
    return (
        <label style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 80 }}>
            <span style={{ fontSize: 10, color, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".05em" }}>{label}</span>
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <input type={text ? "text" : "number"} value={draft ?? shown} onFocus={() => setDraft(shown)} onInput={e => setDraft(e.target.value)} onBlur={commit} onKeyDown={e => { if (e.key === "Enter") e.target.blur(); }}
                    style={{ width: "100%", padding: 8, borderRadius: 8, textAlign: "center", fontWeight: 700, fontSize: "1.1em", border: "1px solid var(--background-modifier-border)", background: "var(--background-modifier-form-field)", height: 38 }} />
                {unit && (draft ?? shown) !== "" && <span style={{ position: "absolute", right: 8, fontSize: 11, color: "var(--text-muted)", pointerEvents: "none", fontWeight: 600 }}>{unit}</span>}
            </div>
        </label>
    );
}

function RecipeEditorReal() {
    const { theme } = useTheme();
    const path = dc.useCurrentPath();
    dc.useCurrentFile();
    const file = app.vault.getAbstractFileByPath(path);
    const fm = (file && app.metadataCache.getFileCache(file)?.frontmatter) || {};
    const update = async (key, value) => {
        if (!file) { new Notice("Nota não encontrada."); return; }
        try { await app.fileManager.processFrontMatter(file, f => { f[key] = key === "rating" ? Number(value) : value; }); }
        catch (e) { console.error(e); new Notice("Falha ao salvar."); }
    };
    const toggleType = async (label) => {
        if (!file) return;
        try {
            await app.fileManager.processFrontMatter(file, f => {
                let cur = f.type || [];
                if (!Array.isArray(cur)) cur = [cur];
                const i = cur.findIndex(t => norm(t) === norm(label));
                if (i >= 0) cur.splice(i, 1); else cur.push(`[[${label}]]`);
                f.type = cur;
            });
        } catch (e) { console.error(e); new Notice("Falha ao alterar o tipo."); }
    };
    if (!file) return <div style={{ padding: 16, color: "var(--text-error)" }}>Nota da receita não encontrada.</div>;
    const types = Array.isArray(fm.type) ? fm.type : fm.type ? [fm.type] : [];
    const kcal = parseFloat(String(fm.calories || 0)) || 0, p = parseFloat(String(fm.protein || 0)) || 0, c = parseFloat(String(fm.carbs || 0)) || 0, g = parseFloat(String(fm.fat || 0)) || 0;
    const fromMacros = Math.round(p * 4 + c * 4 + g * 9);

    return (
        <GloCard variant="glass" size="small" bodyStyle={{ padding: 14 }} style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "space-between", alignItems: "flex-end", paddingBottom: 12, marginBottom: 12, borderBottom: "1px solid var(--background-modifier-border)" }}>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", flex: 2 }}>
                    {TIPOS.map(t => <GloButton key={t} label={t} size="small" variant="liquid-glass" glow={false} active={types.some(x => norm(x) === norm(t))} onClick={() => toggleType(t)} style={{ flexGrow: 1 }} />)}
                </div>
                <div style={{ flex: 1, minWidth: 90 }}><Field label="Porções" value={fm.servings} text color="var(--text-muted)" onCommit={(v) => update("servings", v)} /></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(80px, 1fr))", gap: 10, marginBottom: 12 }}>
                <Field label="Calorias" value={fm.calories} unit="kcal" color="var(--text-normal)" onCommit={(v) => update("calories", v)} />
                <Field label="Proteína" value={fm.protein} unit="g" color={theme["color-success"] || "var(--color-green)"} onCommit={(v) => update("protein", v)} />
                <Field label="Carboidratos" value={fm.carbs} unit="g" color={theme["color-warning"] || "var(--color-orange)"} onCommit={(v) => update("carbs", v)} />
                <Field label="Gordura" value={fm.fat} unit="g" color={theme["color-error"] || "var(--color-red)"} onCommit={(v) => update("fat", v)} />
            </div>
            {(p || c || g) ? (
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 10, textAlign: "center" }}>
                    pelos macros: {fromMacros} kcal{kcal ? ` · declarado ${kcal} kcal (${kcal >= fromMacros ? "+" : ""}${Math.round(kcal - fromMacros)})` : ""}
                </div>
            ) : null}
            <div style={{ display: "flex", justifyContent: "center", padding: 8, borderRadius: 8, background: alpha(theme["color-primary"] || "#7c3aed", 0.06) }}>
                <div style={{ width: 220 }}><GloRating label="Avaliação" shape="star" value={fm.rating || 0} color={theme["color-accent"] || theme["color-warning"]} size={16} onChange={(n) => update("rating", n)} /></div>
            </div>
        </GloCard>
    );
}

const RecipeEditor = gate(RecipeEditorReal);
return { Func: RecipeEditor, RecipeEditor };
