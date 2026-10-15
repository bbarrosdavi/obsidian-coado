// ═══════════════════════════════════════════════════════════════════════════════
// TODAY MENU v3 (Refeições do dia)
// Café, almoço, jantar e lanches escolhidos entre as receitas, comparados com
// o Planejador de Refeições do dia da semana; calorias e macros contra as metas
// do Settings; marcação de nutrição registrada.
//
// Grava na nota do dia (mesmo formato): breakfast/lunch/dinner "[[Receita]]"
// ou null, snacks ["[[...]]"], consumed-calories/protein/carbs/fat,
// nutrition-completed.
// Mecanismos: useDayFrontmatter; linhas e barras como componentes de módulo
// (antes eram recriados a cada render e o seletor aberto fechava sozinho).
// ═══════════════════════════════════════════════════════════════════════════════

const { useTheme } = await dc.require(dc.fileLink("System/Scripts/Core/dc-themeProvider.jsx"));
const { resolveDateStr, useDayFrontmatter, getActivities } = await dc.require(dc.fileLink("System/Scripts/Core/dc-dateContext.jsx"));
const { GloSelect } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloSelect.jsx"));
const { GloButton, alpha } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloButton.jsx"));

const PLANNER_PATH = "System/Planejadores/Planejador de Refeicoes.md";
const num = (v) => v == null ? 0 : typeof v === "number" ? v : Number(String(v).replace(/[^0-9.]/g, "")) || 0;
const clean = (v) => {
    if (!v) return "";
    if (typeof v === "object") {
        if (v.path) return v.path.replace(".md", "").trim();
        if (v.link) return String(v.link).replace(/[\[\]"]/g, "").replace(".md", "").trim();
    }
    return String(v).replace(/[\[\]"]/g, "").replace(".md", "").trim();
};
const MEALS = [["breakfast", "Café da manhã", "break"], ["lunch", "Almoço", "lunch"], ["dinner", "Jantar", "dinner"]];

function Bar({ value, max, color, height = 4 }) {
    return (
        <div style={{ width: "100%", height, background: "var(--background-secondary-alt, rgba(0,0,0,0.05))", borderRadius: 2, marginTop: 3, overflow: "hidden" }}>
            <div style={{ width: `${Math.min((value / (max || 1)) * 100, 100)}%`, height: "100%", background: color, transition: "width 0.3s ease" }} />
        </div>
    );
}

function MealRow({ label, value, planned, options, onChange, theme }) {
    const muted = theme["color-text-muted"] || "var(--text-muted)";
    let status = "", color = muted;
    if (value && planned) { if (value === planned) { status = "conforme o plano"; color = theme["color-success"] || "#10b981"; } else { status = "trocado"; color = theme["color-warning"] || "#f59e0b"; } }
    else if (!value && planned) status = `plano: ${planned}`;
    return (
        <div style={{ display: "flex", flexDirection: "column", marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: muted, marginBottom: 4, textTransform: "uppercase", letterSpacing: ".04em" }}>
                <span>{label}</span>{status && <span style={{ color, fontWeight: 700, textTransform: "none" }}>{status}</span>}
            </div>
            <GloSelect value={value} options={options} onChange={onChange} size="small" searchable searchPlaceholder="Buscar receitas..." style={{ width: "100%" }} />
        </div>
    );
}

function DailyNutrition({ targetDate } = {}) {
    const { theme, settings } = useTheme();
    const dateStr = resolveDateStr(targetDate);
    const day = window.moment(dateStr).locale("en").format("dddd").toLowerCase();   // chaves do planejador em inglês
    const { fm, save, exists } = useDayFrontmatter(dateStr, 250);
    const planners = dc.useQuery('@page and path("System/Planejadores")');
    const planner = planners.find(p => p.$path === PLANNER_PATH || p.$path?.endsWith(PLANNER_PATH));
    const recipes = dc.useQuery('@page and (#recipe or exists(categories))');
    const { map, options } = dc.useMemo(() => {
        const map = new Map(), options = [{ value: "", label: "— pular / jejum —" }];
        for (const p of recipes) {
            const f = app.vault.getFileByPath(p.$path);
            const r = f && app.metadataCache.getFileCache(f)?.frontmatter;
            if (!r) continue;
            const cats = JSON.stringify(r.categories || "");
            const isRecipe = (r.tags && (Array.isArray(r.tags) ? r.tags.includes("recipe") : r.tags === "recipe")) || cats.includes("Receitas") || cats.includes("Recipes");
            if (!isRecipe || f.path.includes("Template")) continue;
            map.set(f.basename, { cal: num(r.calories), pro: num(r.protein), carb: num(r.carbs), fat: num(r.fat) });
            options.push({ value: f.basename, label: f.basename });
        }
        options.sort((a, b) => a.label.localeCompare(b.label));
        return { map, options };
    }, [recipes]);
    const goals = dc.useMemo(() => {
        const acts = getActivities(), g = (id, d) => acts.find(a => a.id === id)?.goal || d;
        return { cal: g("calories", 2000), pro: g("protein", 150), carb: g("carbs", 200), fat: g("fat", 65) };
    }, [settings]);

    const plannedOf = (k) => planner ? clean(planner.value(`${day}-${k}`)) : "";
    const meals = Object.fromEntries(MEALS.map(([key, , pk]) => [key, fm[key] ? clean(fm[key]) : plannedOf(pk)]));
    const snacks = Array.isArray(fm.snacks) ? fm.snacks.map(clean).filter(Boolean) : [];
    const [draftSnacks, setDraftSnacks] = dc.useState(0);   // lanches vazios recém-adicionados (ainda não salvos)
    const total = (ms, ss) => { const t = { cal: 0, pro: 0, carb: 0, fat: 0 }; for (const n of [ms.breakfast, ms.lunch, ms.dinner, ...ss]) { const d = map.get(n); if (d) { t.cal += d.cal; t.pro += d.pro; t.carb += d.carb; t.fat += d.fat; } } return t; };
    const stats = total(meals, snacks);

    const persist = (ms, ss) => {
        const t = total(ms, ss);
        save({
            breakfast: ms.breakfast ? `[[${ms.breakfast}]]` : null, lunch: ms.lunch ? `[[${ms.lunch}]]` : null, dinner: ms.dinner ? `[[${ms.dinner}]]` : null,
            snacks: ss.length ? ss.map(s => `[[${s}]]`) : [],
            "consumed-calories": t.cal, "consumed-protein": t.pro, "consumed-carbs": t.carb, "consumed-fat": t.fat,
        });
    };
    const setMeal = (k, v) => persist({ ...meals, [k]: v }, snacks);
    const setSnack = (i, v) => {
        const list = [...snacks, ...Array(draftSnacks).fill("")];
        list[i] = v;
        const kept = list.filter(Boolean);
        setDraftSnacks(list.length - kept.length > 0 && !v ? draftSnacks : Math.max(0, draftSnacks - (i >= snacks.length ? 1 : 0)));
        persist(meals, kept);
    };
    const removeSnack = (i) => { if (i >= snacks.length) { setDraftSnacks(Math.max(0, draftSnacks - 1)); return; } persist(meals, snacks.filter((_, k) => k !== i)); };

    const primary = theme["color-primary"] || "#7c3aed", muted = theme["color-text-muted"] || "var(--text-muted)";
    const over = stats.cal > goals.cal, calColor = over ? (theme["color-red"] || "#ef4444") : (theme["color-blue"] || primary);
    const done = !!fm["nutrition-completed"];
    const bg = settings?.widgetBackgrounds !== false;

    if (!planner) return <div style={{ padding: 16, borderRadius: 8, textAlign: "center", color: theme["color-red"], border: `1px solid ${theme["color-red"]}`, background: alpha(theme["color-red"] || "#ef4444", 0.08) }}>Planejador não encontrado: <code>{PLANNER_PATH}</code></div>;

    return (
        <div style={{ padding: 14, borderRadius: 12, background: bg ? (theme["color-surface"] || "var(--background-secondary)") : "transparent", border: bg ? "1px solid var(--background-modifier-border)" : "none" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: primary }}>Nutrição</h3>
                    <GloButton size="small" variant="liquid-glass" glow={false} label="Planejador" onClick={() => app.workspace.openLinkText(PLANNER_PATH, "", false)} />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: calColor, fontVariantNumeric: "tabular-nums" }}>{stats.cal} / {goals.cal} kcal</span>
                    {exists
                        ? <GloButton size="small" variant="liquid-glass" glow={false} active={done} label={done ? "Registrado" : "Registrar"} onClick={() => { save({ "nutrition-completed": !done }, true); new Notice(!done ? "Nutrição registrada" : "Nutrição desmarcada"); }} />
                        : <span style={{ fontSize: 10, color: theme["color-red"] }}>Crie a nota do dia</span>}
                </div>
            </div>
            <Bar value={stats.cal} max={goals.cal} color={calColor} height={6} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, margin: "10px 0 14px", fontSize: 11 }}>
                {[["Proteína", stats.pro, goals.pro, theme["color-success"]], ["Carboidrato", stats.carb, goals.carb, theme["color-warning"]], ["Gordura", stats.fat, goals.fat, theme["color-orange"] || theme["color-red"]]].map(([l, v, g, c]) => (
                    <div key={l}><div style={{ color: c, display: "flex", justifyContent: "space-between" }}><span>{l}</span><span style={{ fontVariantNumeric: "tabular-nums" }}>{v}/{g}</span></div><Bar value={v} max={g} color={c} /></div>
                ))}
            </div>
            {MEALS.map(([k, label, pk]) => <MealRow key={k} label={label} value={meals[k]} planned={plannedOf(pk)} options={options} onChange={(v) => setMeal(k, v)} theme={theme} />)}
            <div style={{ borderTop: "1px solid var(--background-modifier-border)", paddingTop: 10, marginTop: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: 11, color: muted, textTransform: "uppercase", letterSpacing: ".04em" }}>Lanches</span>
                    <GloButton size="small" variant="liquid-glass" glow={false} label="+ lanche" onClick={() => setDraftSnacks(draftSnacks + 1)} />
                </div>
                {[...snacks, ...Array(draftSnacks).fill("")].map((s, i) => (
                    <div key={i} style={{ marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}>
                        <GloSelect value={s} options={options} onChange={(v) => setSnack(i, v)} size="small" searchable searchPlaceholder="Buscar lanches..." style={{ flex: 1 }} />
                        <GloButton size="small" variant="liquid-glass" glow={false} label="×" onClick={() => removeSnack(i)} style={{ padding: "4px 9px" }} />
                    </div>
                ))}
            </div>
        </div>
    );
}

return { Func: DailyNutrition, DailyNutrition };
