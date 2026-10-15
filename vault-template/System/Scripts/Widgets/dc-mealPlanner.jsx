// ═══════════════════════════════════════════════════════════════════════════════
// MEAL PLANNER v3 (Cardápio semanal)
// Café, almoço e jantar de segunda a domingo no Planejador de Refeições,
// totais por dia e na semana contra as metas, filtro por dieta (tags das
// receitas), sorteio da semana, salvar e carregar planos.
//
// Grava (mesmo formato): no planejador `<dia>-<break|lunch|dinner>: "[[Receita]]"`
// (remove a chave quando vazia); metas em Settings `activities[].goal`
// (calories, protein, carbs, fat); planos salvos em System/Meal Plans/<nome>.md.
// Correções: o sorteio procurava grupos inexistentes ("Café da Manhã" em vez de
// Breakfast) e falhava sempre; metas gravavam no Settings a cada tecla (agora ao
// sair do campo, como o texto já dizia); nome de plano perdia acentos.
// ═══════════════════════════════════════════════════════════════════════════════

const { useTheme } = await dc.require(dc.fileLink("System/Scripts/Core/dc-themeProvider.jsx"));
const { gate } = await dc.require(dc.fileLink("System/Scripts/Core/dc-visibleGate.jsx"));
const { GloButton, alpha } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloButton.jsx"));
const { GloSelect } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloSelect.jsx"));
const { GloBadge } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloBadge.jsx"));
const { GloCard } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloCard.jsx"));

const SETTINGS_PATH = "System/Settings.md";
const PLANNER_PATH = "System/Planejadores/Planejador de Refeicoes.md";
const SAVE_FOLDER = "System/Meal Plans";
const DAYS = [["monday", "Segunda"], ["tuesday", "Terça"], ["wednesday", "Quarta"], ["thursday", "Quinta"], ["friday", "Sexta"], ["saturday", "Sábado"], ["sunday", "Domingo"]];
const MEALS = [["break", "Breakfast", "Café da manhã"], ["lunch", "Lunch", "Almoço"], ["dinner", "Dinner", "Jantar"]];
const IGNORED_TAGS = ["recipe", "recipes", "meal", "food", "breakfast", "lunch", "dinner", "snack", "dessert"];
const GOALS = [["cal", "calories", "Calorias"], ["pro", "protein", "Proteína (g)"], ["carb", "carbs", "Carboidratos (g)"], ["fat", "fat", "Gordura (g)"]];
const num = (v) => v == null ? 0 : typeof v === "number" ? v : Number(String(v).replace(/[^0-9.]/g, "")) || 0;
const clean = (raw) => { if (!raw) return ""; const s = typeof raw === "object" && raw.path ? raw.path : String(raw); return s.replace(/[\[\]"]/g, "").replace(".md", "").trim(); };

async function ensureFolder(path) {
    if (!path || app.vault.getAbstractFileByPath(path)) return;
    const parent = path.substring(0, path.lastIndexOf("/"));
    if (parent) await ensureFolder(parent);
    try { await app.vault.createFolder(path); } catch (e) { /* já existe */ }
}

function Bar({ value, max, color, height = 4 }) {
    return (
        <div style={{ width: "100%", height, background: alpha(color, 0.15), borderRadius: 4, marginTop: 3, overflow: "hidden" }}>
            <div style={{ width: `${Math.min((value / (max || 1)) * 100, 100)}%`, height: "100%", background: color, borderRadius: 4, transition: "width 0.3s ease" }} />
        </div>
    );
}

function DayCard({ day, label, sel, options, stats, goals, colors, onPick }) {
    const diff = Math.abs(stats.cal - goals.cal);
    const calColor = !stats.cal ? colors.muted : diff < 200 ? colors.cal : stats.cal > goals.cal ? colors.error : colors.warning;
    return (
        <GloCard variant="glass" size="small" title={label} headerStyle={{ padding: "8px 12px 4px" }} bodyStyle={{ padding: "6px 12px 10px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {MEALS.map(([type, bucket, mlabel]) => {
                    const v = sel(`${day}-${type}`);
                    // receita planejada sem nota na vault: aparece com aviso em vez de cair no placeholder
                    const opts = v && !options[bucket].some(o => o.value === v) ? [...options[bucket], { value: v, label: `${v} (sem nota)` }] : options[bucket];
                    return (
                    <div key={type}>
                        <div style={{ fontSize: 10, color: colors.muted, marginBottom: 3, textTransform: "uppercase", letterSpacing: ".04em" }}>{mlabel}</div>
                        <GloSelect value={v} options={opts} onChange={(x) => onPick(`${day}-${type}`, x)} size="small" searchable searchPlaceholder="Buscar..." position={type === "dinner" ? "top" : "bottom"} style={{ width: "100%" }} />
                    </div>
                    );
                })}
                <div style={{ borderTop: "1px solid var(--background-modifier-border)", paddingTop: 8, fontSize: 11 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600, color: calColor, fontVariantNumeric: "tabular-nums" }}><span>{Math.round(stats.cal)} kcal</span><span style={{ opacity: 0.5 }}>{goals.cal}</span></div>
                    <Bar value={stats.cal} max={goals.cal} color={calColor} />
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginTop: 6 }}>
                        {[["P", stats.pro, goals.pro, colors.pro], ["C", stats.carb, goals.carb, colors.carb], ["G", stats.fat, goals.fat, colors.fat]].map(([l, v, g, c]) => (
                            <div key={l}><div style={{ color: c, display: "flex", justifyContent: "space-between", fontVariantNumeric: "tabular-nums" }}><span>{l}</span><span>{Math.round(v * 10) / 10}</span></div><Bar value={v} max={g} color={c} /></div>
                        ))}
                    </div>
                </div>
            </div>
        </GloCard>
    );
}

function GoalInput({ label, value, onCommit, colors }) {
    const [draft, setDraft] = dc.useState(null);
    return (
        <label style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ fontSize: 10, color: colors.muted, textTransform: "uppercase", letterSpacing: ".04em" }}>{label}</span>
            <input type="number" min={0} value={draft ?? value} onFocus={() => setDraft(String(value))} onInput={e => setDraft(e.target.value)}
                onBlur={() => { if (draft !== null && Number(draft) !== Number(value)) onCommit(Number(draft) || 0); setDraft(null); }}
                onKeyDown={e => { if (e.key === "Enter") e.target.blur(); }}
                style={{ width: 80, padding: "4px 8px", fontSize: 12, borderRadius: 6, border: `1px solid ${alpha(colors.primary, 0.3)}`, background: alpha(colors.primary, 0.1), outline: "none", height: 28 }} />
        </label>
    );
}

function MealPlannerReal() {
    const { theme, settings } = useTheme();
    const showBackgrounds = true;   // o original sempre desenhava o cartão, independente de widget-backgrounds
    const planner = dc.useFile(PLANNER_PATH);
    dc.useFile(SETTINGS_PATH);
    const plannerFile = app.vault.getAbstractFileByPath(PLANNER_PATH);
    const fm = (plannerFile && app.metadataCache.getFileCache(plannerFile)?.frontmatter) || {};
    const [local, setLocal] = dc.useState({});
    const [filterTag, setFilterTag] = dc.useState("");
    const [saveName, setSaveName] = dc.useState("");
    const [loadSel, setLoadSel] = dc.useState("");
    const colors = {
        primary: theme["color-primary"] || "#7c3aed", muted: theme["color-text-muted"] || "var(--text-muted)",
        error: theme["color-error"] || "#ef4444", warning: theme["color-warning"] || "#f59e0b",
        cal: theme["color-blue"] || theme["color-primary"], pro: theme["color-success"] || "#10b981", carb: theme["color-warning"] || "#f59e0b", fat: theme["color-orange"] || theme["color-red"] || "#e17055",
    };
    const acts = (() => { const f = app.vault.getAbstractFileByPath(SETTINGS_PATH); return (f && app.metadataCache.getFileCache(f)?.frontmatter?.activities) || []; })();
    const goals = Object.fromEntries(GOALS.map(([k, id]) => [k, acts.find(a => a.id === id)?.goal || { cal: 2000, pro: 150, carb: 200, fat: 65 }[k]]));

    // Receitas, planos salvos e tags (varredura do índice, uma vez por abertura).
    const { recipes, buckets, saved, tags } = dc.useMemo(() => {
        const recipes = new Map(), buckets = { Breakfast: [], Lunch: [], Dinner: [] }, saved = [], tagSet = new Set();
        for (const f of app.vault.getMarkdownFiles()) {
            const r = app.metadataCache.getFileCache(f)?.frontmatter;
            if (!r) continue;
            const cats = r.categories ? JSON.stringify(r.categories) : "";
            const hasTag = (s) => r.tags && (Array.isArray(r.tags) ? r.tags.some(t => String(t).includes(s)) : String(r.tags).includes(s));
            if (cats.includes("Meal Plans") || cats.includes("Planos de Refeicoes")) { saved.push(f); continue; }
            if (!(cats.includes("Recipes") || cats.includes("Receitas") || hasTag("recipe") || hasTag("receita")) || f.path.includes("Template")) continue;
            const t = (r.tags ? (Array.isArray(r.tags) ? r.tags : [r.tags]) : []).map(x => String(x).replace("#", "").trim());
            t.forEach(x => { if (!IGNORED_TAGS.includes(x.toLowerCase())) tagSet.add(x); });
            recipes.set(f.basename, { cal: num(r.calories), pro: num(r.protein), carb: num(r.carbs), fat: num(r.fat), tags: t });
            // O editor de receita grava o tipo em português ([[Café da Manhã]]...): aceitar os dois.
            const ty = JSON.stringify(r.type || "").toLowerCase();
            if (ty.includes("breakfast") || ty.includes("café") || ty.includes("cafe")) buckets.Breakfast.push(f.basename);
            if (ty.includes("lunch") || ty.includes("almoço") || ty.includes("almoco")) buckets.Lunch.push(f.basename);
            if (ty.includes("dinner") || ty.includes("jantar")) buckets.Dinner.push(f.basename);
        }
        Object.values(buckets).forEach(a => a.sort());
        saved.sort((a, b) => a.basename.localeCompare(b.basename));
        return { recipes, buckets, saved, tags: [...tagSet].sort() };
    }, []);
    const pool = (bucket) => filterTag ? buckets[bucket].filter(n => recipes.get(n)?.tags.includes(filterTag)) : buckets[bucket];
    const options = dc.useMemo(() => Object.fromEntries(Object.keys(buckets).map(b => [b, [{ value: "", label: "— escolher —" }, ...pool(b).map(n => ({ value: n, label: n }))]])), [buckets, filterTag]);

    const sel = (k) => clean(local[k] !== undefined ? local[k] : fm[k]);
    const dayStats = (day) => { const s = { cal: 0, pro: 0, carb: 0, fat: 0 }; for (const [t] of MEALS) { const d = recipes.get(sel(`${day}-${t}`)); if (d) { s.cal += d.cal; s.pro += d.pro; s.carb += d.carb; s.fat += d.fat; } } return s; };
    const week = DAYS.reduce((acc, [d]) => { const s = dayStats(d); for (const k in acc) acc[k] += s[k]; return acc; }, { cal: 0, pro: 0, carb: 0, fat: 0 });

    const writePlanner = async (updates) => {
        if (!plannerFile) return;
        setLocal(p => ({ ...p, ...Object.fromEntries(Object.entries(updates).map(([k, v]) => [k, v || ""])) }));
        await app.fileManager.processFrontMatter(plannerFile, f => { for (const [k, v] of Object.entries(updates)) { if (v) f[k] = `[[${v}]]`; else delete f[k]; } });
    };
    const randomize = async () => {
        const pools = Object.fromEntries(MEALS.map(([t, b]) => [t, pool(b)]));
        if (MEALS.some(([t]) => !pools[t].length)) { new Notice(`Receitas insuficientes para a dieta "${filterTag || "todas"}"`); return; }
        const pick = (a) => a[Math.floor(Math.random() * a.length)];
        const up = {};
        for (const [d] of DAYS) for (const [t] of MEALS) up[`${d}-${t}`] = pick(pools[t]);
        await writePlanner(up);
        new Notice(`Semana sorteada (${filterTag || "todas as dietas"})`);
    };
    const updateGoal = async (id, v) => {
        const f = app.vault.getAbstractFileByPath(SETTINGS_PATH);
        if (f) await app.fileManager.processFrontMatter(f, s => { const a = s.activities || []; const i = a.findIndex(x => x.id === id); if (i !== -1) { a[i].goal = v; s.activities = a; } });
    };
    const savePlan = async () => {
        const name = saveName.trim().replace(/[^\p{L}\p{N} -]/gu, "").trim();
        if (!name) { new Notice("Dê um nome ao plano."); return; }
        try {
            await ensureFolder(SAVE_FOLDER);
            const path = `${SAVE_FOLDER}/${name}.md`;
            if (app.vault.getAbstractFileByPath(path)) { new Notice(`"${name}" já existe.`); return; }
            let y = `---\ncategories:\n  - "[[Meal Plans]]"\ngoal-calories: ${goals.cal}\ngoal-protein: ${goals.pro}\ngoal-carbs: ${goals.carb}\ngoal-fat: ${goals.fat}\n`;
            for (const [d] of DAYS) for (const [t] of MEALS) { const v = sel(`${d}-${t}`); if (v) y += `${d}-${t}: "[[${v}]]"\n`; }
            y += "---\n";
            const block = "```datacorejsx\nconst script = await dc.require(dc.fileLink(\"System/Scripts/Widgets/dc-mealPlanner.jsx\"));\nreturn function View() { return script.Func(); }\n```";
            await app.vault.create(path, `${y}\n# ${name}\n\n${block}`);
            new Notice(`Plano salvo: ${name}`);
            setSaveName("");
        } catch (e) { console.error(e); new Notice(`Erro ao salvar: ${e.message}`); }
    };
    const loadPlan = async (base) => {
        setLoadSel(base);
        const f = base && saved.find(x => x.basename === base);
        const s = f && app.metadataCache.getFileCache(f)?.frontmatter;
        if (!s) return;
        const up = {};
        for (const [d] of DAYS) for (const [t] of MEALS) up[`${d}-${t}`] = clean(s[`${d}-${t}`]);
        await writePlanner(up);
        new Notice(`Carregado: ${base}`);
        setLoadSel("");
    };

    if (!plannerFile) return <div style={{ padding: 16, color: colors.error }}>Planejador não encontrado: <code>{PLANNER_PATH}</code></div>;
    const btn = { size: "small", variant: "liquid-glass", glow: false };

    // Cartão em volta do widget inteiro, como no original.
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: 16, background: showBackgrounds ? "var(--background-secondary, transparent)" : "transparent", borderRadius: 12, border: showBackgrounds ? `1px solid ${alpha(colors.primary, 0.2)}` : "none", overflow: "visible" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: colors.primary }}>Cardápio semanal</h2>
                    <GloBadge variant="soft" status="neutral" size="small">{recipes.size} receitas</GloBadge>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                    <GloSelect value={filterTag} options={[{ value: "", label: "Todas as dietas" }, ...tags.map(t => ({ value: t, label: t }))]} onChange={setFilterTag} size="small" searchable searchPlaceholder="Filtrar dieta..." style={{ minWidth: 140 }} />
                    <GloSelect value={loadSel} options={[{ value: "", label: "Carregar plano..." }, ...saved.map(f => ({ value: f.basename, label: f.basename }))]} onChange={loadPlan} size="small" searchable searchPlaceholder="Buscar plano..." style={{ maxWidth: 170 }} />
                    <GloButton {...btn} label="Sortear semana" onClick={randomize} />
                </div>
            </div>

            <GloCard variant="glass" size="small" bodyStyle={{ padding: "10px 12px" }}>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
                    {GOALS.map(([k, id, label]) => {
                        const v = week[k], g = goals[k] * 7, c = colors[k];
                        return (
                            <div key={k} style={{ flex: "1 1 150px", minWidth: 140, display: "flex", gap: 10, alignItems: "flex-end" }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: colors.muted, textTransform: "uppercase", letterSpacing: ".04em" }}><span>{label.replace(" (g)", "")} na semana</span><span>{Math.round((v / (g || 1)) * 100)}%</span></div>
                                    <div style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{v} <span style={{ fontSize: 10, color: colors.muted, fontWeight: 400 }}>/ {g}</span></div>
                                    <Bar value={v} max={g} color={c} height={6} />
                                </div>
                                <GoalInput label="meta/dia" value={goals[k]} colors={colors} onCommit={(x) => updateGoal(id, x)} />
                            </div>
                        );
                    })}
                </div>
            </GloCard>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
                {DAYS.map(([d, label]) => <DayCard key={d} day={d} label={label} sel={sel} options={options} stats={dayStats(d)} goals={goals} colors={colors} onPick={(k, v) => writePlanner({ [k]: v })} />)}
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "flex-end" }}>
                <input type="text" placeholder="Nome do plano" value={saveName} onInput={e => setSaveName(e.target.value)} onKeyDown={e => { if (e.key === "Enter") savePlan(); }}
                    style={{ padding: "4px 8px", fontSize: 12, borderRadius: 6, border: `1px solid ${alpha(colors.primary, 0.3)}`, background: "var(--background-secondary-alt)", height: 28 }} />
                <GloButton {...btn} label="Salvar plano" onClick={savePlan} />
            </div>
        </div>
    );
}

const MealPlanner = gate(MealPlannerReal);
return { Func: MealPlanner, MealPlanner };
