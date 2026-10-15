// ═══════════════════════════════════════════════════════════════════════════════
// DC-EXERCISE-PICKER v2 - Seletor de notas de exercício (categoria Exercise)
// GloSelect pesquisável com as notas cuja `categories` contém "Exercise"
// (exceto template, planner e a própria categoria).
// Mudanças: consulta restrita a páginas com `categories` (antes, todas as
// páginas da vault); sem ícones-emoji inferidos por tipo/músculo: mostra só o
// `icon` que a nota de exercício definir.
// ═══════════════════════════════════════════════════════════════════════════════

const { GloSelect } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloSelect.jsx"));

const DEFAULT_ICONS = {};   // mantido por compatibilidade de exportação; ícones inferidos removidos
const asArray = (v) => Array.isArray(v) ? v : v ? [v] : [];
const getExerciseIcon = (fm) => fm?.icon && String(fm.icon).trim() ? fm.icon : null;

function ExercisePicker({ value = "", onChange = null, onSelect = null, placeholder = "Escolha um exercício...", width = "100%", size = "medium", disabled = false, style = {} }) {
    const pages = dc.useQuery("@page and exists(categories)");
    const options = dc.useMemo(() => {
        const out = [];
        for (const p of pages) {
            if (!asArray(p.value("categories")).some(c => String(c).includes("Exercise"))) continue;
            const name = p.$name || "", low = name.toLowerCase();
            if (!name || low.includes("template") || low.includes("planner") || low === "exercise") continue;
            const target = asArray(p.value("target")), type = asArray(p.value("type"));
            out.push({ value: name, label: name, icon: getExerciseIcon({ icon: p.value("icon") }), _meta: { path: p.$path, target, type } });
        }
        return out.sort((a, b) => a.label.localeCompare(b.label));
    }, [pages]);

    const handle = (v) => {
        if (onChange) onChange(v);
        if (onSelect) {
            const o = options.find(x => x.value === v);
            if (o) onSelect({ name: o.value, icon: o.icon, path: o._meta.path, target: o._meta.target, type: o._meta.type });
        }
    };

    return (
        <GloSelect options={options} value={value} onChange={handle} placeholder={options.length ? placeholder : "Nenhuma nota de exercício"}
            searchable={true} searchPlaceholder="Buscar exercícios..." showIcon={true} size={size} width={width}
            position="auto" maxHeight="300px" disabled={disabled} style={style} glow={true} />
    );
}

return { ExercisePicker, getExerciseIcon, DEFAULT_ICONS };
