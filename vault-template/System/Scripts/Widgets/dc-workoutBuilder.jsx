// ═══════════════════════════════════════════════════════════════════════════════
// WORKOUT BUILDER v2 (Montador de plano de treino)
// Na nota do plano: aquecimento, exercícios principais (séries, repetições,
// carga) e desaquecimento; adicionar pelo seletor de exercícios, editar campos,
// remover no modo Editar, abrir a nota do exercício.
//
// Grava na nota do bloco (mesmo formato): warmup/cooldown [{link, info}],
// exercises [{link, sets, reps, weight}]; novos itens com os mesmos padrões
// (info "5 mins"; sets 3, reps "10", weight "0").
// Mudanças: grava sempre na nota do bloco (antes caía na nota ativa quando o
// contexto faltava); subcomponentes no nível do módulo (antes eram recriados a
// cada render e o campo em edição perdia o foco); botões com rótulo (os ícones
// "plus/check/x" apareciam como texto); hover por CSS.
// ═══════════════════════════════════════════════════════════════════════════════

const { useTheme } = await dc.require(dc.fileLink("System/Scripts/Core/dc-themeProvider.jsx"));
const { gate } = await dc.require(dc.fileLink("System/Scripts/Core/dc-visibleGate.jsx"));
const { GloButton, alpha } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloButton.jsx"));
const { GloCard } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloCard.jsx"));
const { ExercisePicker } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-exercisePicker.jsx"));

const toText = (v) => v == null ? "" : String(v);
const displayName = (raw) => raw ? String(raw).replace(/\[\[(?:.*\|)?(.*?)\]\]/g, "$1").replace(/[\[\]]/g, "") : "Sem nome";
const linkTarget = (raw) => raw ? String(raw).replace(/\[\[(.*?)(?:\|.*)?\]\]/g, "$1").replace(/[\[\]]/g, "") : "";
const openLink = (e, raw) => { e.stopPropagation(); const t = linkTarget(raw); if (t) app.workspace.openLinkText(t, "", false); else new Notice("Link sem destino"); };
const SECTIONS = [["warmup", "Aquecimento", "color-warning"], ["exercises", "Exercícios principais", "color-accent"], ["cooldown", "Desaquecimento", "color-blue"]];

function StatInput({ value, label, onUpdate }) {
    const [draft, setDraft] = dc.useState(null);
    return (
        <label style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, minWidth: 0 }}>
            {label && <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".04em", opacity: 0.6, fontWeight: 700, marginBottom: 2 }}>{label}</span>}
            <input type="text" value={draft ?? toText(value)} onFocus={() => setDraft(toText(value))} onInput={e => setDraft(e.target.value)}
                onBlur={() => { if (draft !== null && draft !== toText(value)) onUpdate(draft); setDraft(null); }}
                onKeyDown={e => { if (e.key === "Enter") e.target.blur(); }}
                style={{ width: "100%", background: "rgba(0,0,0,0.1)", border: "1px solid var(--background-modifier-border)", borderRadius: 6, padding: "6px 8px", textAlign: "center", color: "var(--text-normal)", fontWeight: 700, fontSize: 14 }} />
        </label>
    );
}

function RemoveButton({ onClick }) {
    return <GloButton size="small" variant="liquid-glass" glow={false} label="Remover" onClick={onClick} style={{ flexShrink: 0, color: "var(--color-red)" }} />;
}

function Item({ type, item, i, editing, onUpdate, onDelete }) {
    const raw = item?.link || "";
    const name = <span className="dcg-link" style={{ cursor: "pointer", fontWeight: 600 }} onClick={(e) => openLink(e, raw)}>{displayName(raw)}</span>;
    if (type !== "exercises") return (
        <GloCard variant="glass" style={{ padding: "8px 12px", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>{name}</div>
            <div style={{ width: 90 }}><StatInput value={item?.info} onUpdate={(v) => onUpdate(i, "info", v)} /></div>
            {editing && <RemoveButton onClick={() => onDelete(i)} />}
        </GloCard>
    );
    return (
        <GloCard variant="glass" style={{ padding: "10px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, fontSize: 15 }}>
                <span style={{ opacity: 0.4, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>#{i + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>{name}</div>
                {editing && <RemoveButton onClick={() => onDelete(i)} />}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
                <StatInput label="Séries" value={item?.sets} onUpdate={(v) => onUpdate(i, "sets", v)} />
                <StatInput label="Repetições" value={item?.reps} onUpdate={(v) => onUpdate(i, "reps", v)} />
                <StatInput label="Peso" value={item?.weight} onUpdate={(v) => onUpdate(i, "weight", v)} />
            </div>
        </GloCard>
    );
}

function WorkoutBuilderReal() {
    const { theme } = useTheme();
    const path = dc.useCurrentPath();
    dc.useFile(path);
    const file = path ? app.vault.getAbstractFileByPath(path) : null;
    const fm = (file && app.metadataCache.getFileCache(file)?.frontmatter) || {};
    const [adding, setAdding] = dc.useState(null);
    const [pick, setPick] = dc.useState("");
    const [editing, setEditing] = dc.useState(false);

    const edit = (fn) => file ? app.fileManager.processFrontMatter(file, fn) : null;
    const add = async () => {
        if (!pick || !adding) return;
        const link = pick.startsWith("[[") ? pick : `[[${pick}]]`;
        await edit((f) => { if (!f[adding]) f[adding] = []; f[adding].push(adding === "exercises" ? { link, sets: 3, reps: "10", weight: "0" } : { link, info: "5 mins" }); });
        setAdding(null); setPick("");
    };
    const update = (type) => (i, field, v) => edit((f) => { if (f[type]?.[i]) f[type][i][field] = v; });
    const remove = (type) => (i) => edit((f) => { if (f[type]) f[type].splice(i, 1); });
    const labelOf = Object.fromEntries(SECTIONS.map(([k, l]) => [k, l]));

    return (
        <div style={{ maxWidth: 800, margin: "0 auto", padding: 16, background: "var(--background-secondary)", border: "1px solid var(--background-modifier-border)", borderRadius: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <h2 style={{ margin: 0, fontSize: 18 }}>Montador de treino</h2>
                <GloButton size="small" variant="liquid-glass" glow={false} active={editing} label={editing ? "Concluído" : "Editar"} onClick={() => setEditing(!editing)} />
            </div>
            {adding && (
                <div style={{ margin: "12px 0", padding: 14, background: "var(--background-primary)", border: `1px dashed ${alpha(theme["color-primary"] || "var(--interactive-accent)", 0.7)}`, borderRadius: 8 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
                        <strong>Adicionar em {labelOf[adding]}</strong>
                        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                            <GloButton size="small" variant="liquid-glass" glow={false} label="Adicionar" onClick={add} disabled={!pick} />
                            <GloButton size="small" variant="liquid-glass" glow={false} label="Cancelar" onClick={() => setAdding(null)} />
                        </div>
                    </div>
                    <ExercisePicker value={pick} onChange={setPick} width="100%" />
                </div>
            )}
            {SECTIONS.map(([type, title, colorKey]) => {
                const list = Array.isArray(fm[type]) ? fm[type] : [];
                return (
                    <div key={type}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "20px 0 10px", paddingBottom: 6, borderBottom: `1px solid ${theme["color-base-30"] || "var(--background-modifier-border)"}` }}>
                            <span style={{ fontSize: 15, fontWeight: 700, color: theme[colorKey] || theme["color-accent"] }}>{title} <span style={{ opacity: 0.5, fontWeight: 500 }}>{list.length}</span></span>
                            <GloButton size="small" variant="liquid-glass" glow={false} label="+ adicionar" onClick={() => { setAdding(type); setPick(""); }} />
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: type === "exercises" ? 10 : 6 }}>
                            {!list.length && <div style={{ opacity: 0.4, fontSize: 12 }}>Nenhum item.</div>}
                            {list.map((it, i) => <Item key={`${type}-${i}`} type={type} item={it} i={i} editing={editing} onUpdate={update(type)} onDelete={remove(type)} />)}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

const WorkoutBuilder = gate(WorkoutBuilderReal);
return { Func: WorkoutBuilder, WorkoutBuilder };
