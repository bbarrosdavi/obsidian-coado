// ═══════════════════════════════════════════════════════════════════════════════
// SHOPPING LIST v3 (Lista de compras)
// Lê o cardápio da semana no Planejador de Refeições, calcula lotes por receita
// (porções x vezes usada, sobras) e soma os ingredientes da seção de
// ingredientes de cada receita. Marcar itens, limpar e exportar para uma nota.
//
// Grava apenas ao exportar: "Shopping List AAAA-MM-DD.md" na raiz (mesmo nome).
// Correções: seção "## Ingredientes" (pt) não era reconhecida (só "Ingredients");
// frações por eval() trocadas por conversão própria; data do arquivo em fuso
// local; resumo de receitas sempre visível.
// ═══════════════════════════════════════════════════════════════════════════════

const { useTheme } = await dc.require(dc.fileLink("System/Scripts/Core/dc-themeProvider.jsx"));
const { gate } = await dc.require(dc.fileLink("System/Scripts/Core/dc-visibleGate.jsx"));
const { GloButton, alpha } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloButton.jsx"));
const { GloBadge, GloBadgeGroup } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloBadge.jsx"));

const PLANNER_PATH = "System/Planejadores/Planejador de Refeicoes.md";
const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const MEALS = ["break", "lunch", "dinner"];
const servingsOf = (v) => { const m = v ? String(v).match(/(\d+)/) : null; return m ? Number(m[1]) : 1; };
const qtyOf = (s) => { const f = s.match(/^(\d+)\/(\d+)$/); return f ? Number(f[1]) / Number(f[2]) : Number(s); };
const normName = (raw) => { let n = raw.toLowerCase().trim(); if (n.endsWith("s") && !n.endsWith("ss")) n = n.slice(0, -1); return n.includes("onion") ? "onion" : n; };
function parseIngredient(line) {
    const c = line.replace(/^[-*]\s+(\[.?\])?\s*/, "").trim();
    const m = c.match(/^(\d+(?:\.\d+)?|\d+\/\d+)\s*([a-zA-Z]+)?\s+(.*)$/);
    if (!m) return { qty: 0, unit: "nm", name: normName(c) };
    let unit = m[2] ? m[2].toLowerCase() : "count", name = m[3];
    if (!name) { name = unit; unit = "count"; }
    return { qty: qtyOf(m[1]), unit, name: normName(name) };
}
const localDay = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

function ShoppingListReal() {
    const { theme, settings } = useTheme();
    dc.useFile(PLANNER_PATH);
    const plannerFile = app.vault.getAbstractFileByPath(PLANNER_PATH);
    const fm = (plannerFile && app.metadataCache.getFileCache(plannerFile)?.frontmatter) || {};
    const [list, setList] = dc.useState([]);
    const [stats, setStats] = dc.useState({});
    const [status, setStatus] = dc.useState("ready");
    const [checked, setChecked] = dc.useState({});
    const primary = theme["color-primary"] || "#7c3aed", success = theme["color-success"] || "#10b981", warning = theme["color-warning"] || "#f59e0b";
    const bg = settings?.widgetBackgrounds !== false;

    const generate = async () => {
        setStatus("scanning");
        const usage = {};
        for (const d of DAYS) for (const t of MEALS) {
            const key = `${d}-${t}`;
            let v = fm[key];
            if (!v) { const k = Object.keys(fm).find(x => x.toLowerCase() === key); if (k) v = fm[k]; }
            const name = v ? String(v).replace(/[\[\]"]/g, "").trim() : "";
            if (name) usage[name] = (usage[name] || 0) + 1;
        }
        if (!Object.keys(usage).length) { setStatus("error"); new Notice("Nenhuma refeição no cardápio"); return; }
        const inv = {}, st = {};
        for (const [recipe, times] of Object.entries(usage)) {
            const f = app.metadataCache.getFirstLinkpathDest(recipe, "");
            if (!f) { console.warn("Receita não encontrada:", recipe); continue; }
            const srv = servingsOf(app.metadataCache.getFileCache(f)?.frontmatter?.servings);
            const batches = Math.ceil(times / srv);
            st[recipe] = { times, servings: srv, batches, total: batches * srv, leftovers: batches * srv - times };
            const text = await app.vault.cachedRead(f);
            const hd = text.match(/^#{1,6}\s+.*Ingredient(?:e?s)?\b.*$/im);
            if (!hd) continue;
            const rest = text.slice(hd.index + hd[0].length), end = rest.match(/^(#{1,6}\s|---)/m);
            for (const line of (end ? rest.slice(0, end.index) : rest).split("\n")) {
                if (!line.trim().startsWith("-")) continue;
                const it = parseIngredient(line);
                const e = inv[it.name] || (inv[it.name] = { units: {} });
                if (it.qty > 0) { const u = it.unit || "count"; e.units[u] = (e.units[u] || 0) + it.qty * batches; }
                else e.units.nm = 1;
            }
        }
        const out = Object.keys(inv).sort().map(name => {
            const parts = Object.entries(inv[name].units).filter(([u]) => u !== "nm").map(([u, q]) => { const r = Math.round(q * 100) / 100; return u === "count" ? `${r}` : `${r} ${u}`; });
            const s = parts.length ? `${parts.join(" + ")} ${name}` : name;
            return s.charAt(0).toUpperCase() + s.slice(1);
        });
        setList(out); setStats(st); setChecked({}); setStatus("done");
        new Notice(`${out.length} itens de ${Object.keys(st).length} receitas`);
    };

    const exportNote = async () => {
        if (!list.length) { new Notice("Gere a lista primeiro."); return; }
        const day = localDay(), name = `Shopping List ${day}.md`;
        let c = `---\ncreated: ${day}\ntype: shopping-list\n---\n\n# Lista de Compras\n\n`;
        if (Object.keys(stats).length) {
            c += "## Resumo das receitas\n\n";
            for (const [r, s] of Object.entries(stats)) c += `- **[[${r}]]**: ${s.batches} ${s.batches > 1 ? "lotes" : "lote"} → ${s.total} porções${s.leftovers > 0 ? ` (${s.leftovers} sobrando)` : ""}\n`;
            c += "\n";
        }
        c += "## Itens\n\n" + list.map(i => `- [${checked[i] ? "x" : " "}] ${i}`).join("\n") + "\n";
        try {
            await app.vault.create(name, c);
            new Notice(`Criado: ${name}`);
            const f = app.vault.getAbstractFileByPath(name);
            if (f) await app.workspace.getLeaf().openFile(f);
        } catch (e) {
            if (String(e.message).includes("already exists")) new Notice(`Já existe: ${name}`);
            else { console.error(e); new Notice("Falha ao criar a lista"); }
        }
    };

    if (!plannerFile) return <div style={{ padding: 16, borderRadius: 8, textAlign: "center", color: theme["color-red"], border: `1px solid ${theme["color-red"]}` }}>Planejador não encontrado: <code>{PLANNER_PATH}</code></div>;
    const done = Object.values(checked).filter(Boolean).length;
    const btn = { size: "small", variant: "liquid-glass", glow: false };

    return (
        <div style={{ padding: bg ? 14 : 0, borderRadius: 12, background: bg ? (theme["color-surface"] || "var(--background-secondary)") : "transparent", border: bg ? `1px solid ${alpha(primary, 0.2)}` : "none" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
                <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                    Lista de compras
                    {status === "done" && list.length > 0 && <GloBadge size="small" variant="soft" color={done === list.length ? success : primary}>{done}/{list.length}</GloBadge>}
                </h3>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <GloButton {...btn} label={status === "scanning" ? "Lendo receitas..." : "Gerar"} disabled={status === "scanning"} onClick={generate} />
                    {status === "done" && list.length > 0 && <GloButton {...btn} label="Exportar" onClick={exportNote} />}
                    {done > 0 && <GloButton {...btn} label="Limpar marcados" onClick={() => setChecked({})} />}
                </div>
            </div>
            {status === "done" && Object.keys(stats).length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 10 }}>
                    {Object.entries(stats).map(([r, s]) => (
                        <div key={r} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, fontSize: 12.5, padding: "4px 8px", borderRadius: 6, background: alpha(primary, 0.08) }}>
                            <span className="dcg-link" style={{ cursor: "pointer" }} onClick={() => app.workspace.openLinkText(r, "", false)}>{r}</span>
                            <GloBadgeGroup gap="4px">
                                <GloBadge size="small" variant="soft" status="primary">{s.batches} {s.batches > 1 ? "lotes" : "lote"} · {s.total} porções</GloBadge>
                                {s.leftovers > 0 && <GloBadge size="small" variant="soft" color={warning}>+{s.leftovers} sobrando</GloBadge>}
                            </GloBadgeGroup>
                        </div>
                    ))}
                </div>
            )}
            {status === "done" && list.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 400, overflowY: "auto" }}>
                    {list.map((it, i) => {
                        const on = !!checked[it];
                        return (
                            <div key={i} className="dcg-row" onClick={() => setChecked(p => ({ ...p, [it]: !p[it] }))} style={{
                                display: "flex", alignItems: "center", gap: 10, padding: "6px 10px", borderRadius: 6, cursor: "pointer",
                                background: on ? alpha(success, 0.13) : "var(--background-primary)", border: `1px solid ${on ? success : "transparent"}`, opacity: on ? 0.7 : 1,
                            }}>
                                <span style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${on ? success : "var(--text-muted)"}`, background: on ? success : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "var(--text-on-accent)", fontSize: 11 }}>{on ? "✓" : ""}</span>
                                <span style={{ flex: 1, textDecoration: on ? "line-through" : "none" }}>{it}</span>
                            </div>
                        );
                    })}
                </div>
            )}
            {status === "done" && !list.length && <div style={{ opacity: 0.5, fontSize: 13 }}>Nenhum ingrediente encontrado nas receitas do cardápio.</div>}
            {status === "ready" && <div style={{ opacity: 0.6, fontSize: 13 }}>Gere a lista a partir do cardápio da semana.</div>}
            {status === "error" && <div style={{ color: theme["color-red"], fontSize: 13 }}>O cardápio está vazio.</div>}
        </div>
    );
}

const ShoppingList = gate(ShoppingListReal);
return { Func: ShoppingList, ShoppingList };
