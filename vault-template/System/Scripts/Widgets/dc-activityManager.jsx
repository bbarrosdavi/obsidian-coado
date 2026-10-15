// ═══════════════════════════════════════════════════════════════════════════════
// ACTIVITY MANAGER v2 (Gerenciador de atividades)
// CRUD das atividades rastreadas em Settings.md `activities[]`: listar, editar
// no lugar, excluir (com confirmação), mostrar/ocultar no registro, criar.
//
// Grava (mesmo formato): Settings `activities` com os mesmos campos (id, name,
// field, type, goal, unit, color, icon, increment, max, managed, hidden,
// goalManagedBy preservado); criação limpa campos por tipo como antes.
// Mudanças: lista reativa ao Settings (antes, lida uma vez ao montar) e cada
// operação aplicada sobre o frontmatter atual por id (antes, regravava a lista
// inteira da memória e desfazia metas alteradas por outros widgets, como a
// agenda de treino ou o planejador de refeições); sem emojis na interface:
// ícone de imagem aparece, ícone de texto vira o ponto colorido da atividade.
// ═══════════════════════════════════════════════════════════════════════════════

const { useTheme } = await dc.require(dc.fileLink("System/Scripts/Core/dc-themeProvider.jsx"));
const { gate } = await dc.require(dc.fileLink("System/Scripts/Core/dc-visibleGate.jsx"));
const { GloButton, alpha } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloButton.jsx"));
const { GloInput } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloInput.jsx"));
const { GloSelect } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloSelect.jsx"));
const { GloBadge } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloBadge.jsx"));
const { isTimeUnit } = await dc.require(dc.fileLink("System/Scripts/Core/dc-pomodoroTime.jsx"));

const SETTINGS_PATH = "System/Settings.md";
const TYPES = [
    { value: "value", label: "Valor (número com meta)" },
    { value: "rating", label: "Avaliação (escala 1-5)" },
    { value: "boolean", label: "Sim/não" },
    { value: "count", label: "Contagem (automática)" },
];
const TYPE_LABEL = { value: "valor", rating: "avaliação", boolean: "sim/não", count: "contagem" };
const COLORS = ["#0984E3", "#00B894", "#FDCB6E", "#FF7675", "#E17055", "#6C5CE7", "#A29BFE", "#FD79A8", "#00CEC9", "#81ECEC"];
const DEFAULT = { id: "", name: "", field: "", type: "value", goal: 100, unit: "", color: "#0984E3", icon: "📊", increment: null, max: null, managed: false, hidden: false };
const MANAGED_BY = { mealPlanner: "Planejador de refeições", weeklyWorkout: "Agenda de treino" };
const isImage = (icon) => typeof icon === "string" && /^(https?:\/\/|data:image\/)/.test(icon);

function Dot({ icon, color, size = 22 }) {
    return isImage(icon)
        ? <img src={icon} alt="" style={{ width: size, height: size, objectFit: "contain", borderRadius: 4 }} />
        : <span style={{ width: size * 0.5, height: size * 0.5, borderRadius: "50%", background: color, flexShrink: 0, display: "inline-block" }} />;
}

function Field({ label, children, muted, grow = 1 }) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: grow, minWidth: 120 }}>
            <span style={{ fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em", color: muted }}>{label}</span>
            {children}
        </div>
    );
}

function ActivityForm({ data, onChange, muted, warning }) {
    const set = (k, v) => onChange({ ...data, [k]: v });
    const pasteImage = () => {
        const input = prompt("Cole a URL da imagem ou um data URL base64:\n\n(ex.: https://... ou data:image/png;base64,...)");
        if (!input || !input.trim()) return;
        if (isImage(input.trim())) set("icon", input.trim());
        else new Notice("URL inválida: precisa começar com http://, https:// ou data:image/");
    };
    const managedGoal = !!data.goalManagedBy;
    const row = { display: "flex", gap: 12, flexWrap: "wrap" };
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={row}>
                <Field label="Nome *" muted={muted}><GloInput value={data.name || ""} onChange={(v) => set("name", v)} placeholder="Água" size="small" /></Field>
                <Field label="Ícone" muted={muted}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {isImage(data.icon)
                            ? <><Dot icon={data.icon} color={data.color} /><GloButton size="small" variant="liquid-glass" glow={false} label="Remover imagem" onClick={() => set("icon", "📊")} /></>
                            : <><GloInput value={data.icon || ""} onChange={(v) => set("icon", v)} size="small" style={{ width: 70 }} /><GloButton size="small" variant="liquid-glass" glow={false} label="Imagem por URL" onClick={pasteImage} /></>}
                    </div>
                </Field>
            </div>
            <div style={row}>
                <Field label="ID *" muted={muted}><GloInput value={data.id || ""} onChange={(v) => set("id", v.toLowerCase().replace(/\s+/g, "_"))} placeholder="water" size="small" /></Field>
                <Field label="Campo no frontmatter *" muted={muted}><GloInput value={data.field || ""} onChange={(v) => set("field", v.toLowerCase().replace(/\s+/g, "-"))} placeholder="water-ml" size="small" /></Field>
            </div>
            <div style={row}>
                <Field label="Tipo" muted={muted}><GloSelect options={TYPES} value={data.type || "value"} onChange={(v) => set("type", v)} size="small" /></Field>
                <Field label="Cor" muted={muted}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <input type="color" value={data.color || "#0984E3"} onInput={(e) => set("color", e.target.value)} style={{ width: 40, height: 30, padding: 0, border: "none", borderRadius: 6, cursor: "pointer", background: "transparent" }} />
                        <code style={{ fontSize: 12, color: muted }}>{data.color || "#0984E3"}</code>
                    </div>
                </Field>
            </div>
            {data.type === "value" && (
                <div style={row}>
                    <Field label={managedGoal ? `Meta (definida por ${MANAGED_BY[data.goalManagedBy] || data.goalManagedBy})` : "Meta"} muted={managedGoal ? warning : muted}>
                        {managedGoal
                            ? <div style={{ padding: "6px 10px", borderRadius: 6, fontSize: 13, color: muted, border: "1px dashed var(--background-modifier-border)" }}>{data.goal || "—"} {data.unit || ""}</div>
                            : <GloInput type="number" value={data.goal || ""} onChange={(v) => set("goal", Number(v) || null)} placeholder="3500" size="small" />}
                    </Field>
                    {!managedGoal && <Field label="Unidade" muted={muted}><GloInput value={data.unit || ""} onChange={(v) => set("unit", v)} placeholder="ml" size="small" /></Field>}
                    <Field label="Incremento" muted={muted}><GloInput type="number" value={data.increment || ""} onChange={(v) => set("increment", Number(v) || null)} placeholder="750" size="small" /></Field>
                </div>
            )}
            {data.type === "rating" && (
                <div style={row}><Field label="Valor máximo" muted={muted}><GloInput type="number" value={data.max || 5} onChange={(v) => set("max", Number(v) || 5)} placeholder="5" size="small" /></Field></div>
            )}
            {data.type === "value" && isTimeUnit(data.unit) && (
                <div style={row}>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12, color: muted, flex: 1, minWidth: 200 }}>
                        <input type="checkbox" checked={!!data.pomodoro} onChange={(e) => set("pomodoro", e.target.checked)} style={{ width: 16, height: 16 }} />
                        Somar o tempo de pomodoro do dia (TaskNotes)
                    </label>
                    {data.pomodoro && <Field label="Só notas com a tag (vazio = qualquer)" muted={muted}><GloInput value={data.pomodoroTag || ""} onChange={(v) => set("pomodoroTag", v.replace(/^#/, "").trim())} placeholder="academico" size="small" /></Field>}
                </div>
            )}
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12, color: muted }}>
                <input type="checkbox" checked={!!data.managed} onChange={(e) => set("managed", e.target.checked)} style={{ width: 16, height: 16 }} />
                Gerenciada por outro widget (só leitura no registro)
            </label>
        </div>
    );
}

function ActivityCard({ a, editing, draft, setDraft, onEdit, onCancel, onSave, onDelete, onToggle, colors, bg }) {
    const color = a.color || colors.primary;
    const btn = { size: "small", variant: "liquid-glass", glow: false };
    if (editing) return (
        <div style={{ padding: 14, borderRadius: 10, background: bg ? `linear-gradient(135deg, ${alpha(color, 0.13)}, ${colors.surface})` : "transparent", border: `2px solid ${color}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, fontSize: 14, fontWeight: 600, color }}>
                <Dot icon={draft.icon} color={draft.color || color} size={20} />Editando: {a.name}
            </div>
            <ActivityForm data={draft} onChange={setDraft} muted={colors.muted} warning={colors.warning} />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
                <GloButton {...btn} label="Cancelar" onClick={onCancel} />
                <GloButton {...btn} label="Salvar alterações" onClick={onSave} />
            </div>
        </div>
    );
    return (
        <div style={{ padding: "12px 14px", borderRadius: 10, background: bg ? colors.surface : "transparent", border: "1px solid var(--background-modifier-border)", opacity: a.hidden ? 0.55 : 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <Dot icon={a.icon} color={color} />
                    <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{a.name}</div>
                        <div style={{ fontSize: 11, color: colors.muted }}>campo <code style={{ fontSize: 11 }}>{a.field}</code></div>
                    </div>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <GloBadge variant="soft" size="small" color={color}>{TYPE_LABEL[a.type] || a.type}</GloBadge>
                    {a.managed && <GloBadge variant="outlined" size="small" color={colors.muted}>gerenciada</GloBadge>}
                    {a.hidden && <GloBadge variant="outlined" size="small" color={colors.error}>oculta</GloBadge>}
                </div>
            </div>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", margin: "8px 0", fontSize: 12, color: colors.muted }}>
                {a.goal && <span>Meta <strong style={{ color }}>{a.goal}</strong> {a.unit}{a.goalManagedBy && <em style={{ marginLeft: 6, fontSize: 10.5, color: colors.warning }}>(definida por {MANAGED_BY[a.goalManagedBy] || a.goalManagedBy})</em>}</span>}
                {a.max && <span>Máximo <strong style={{ color }}>{a.max}</strong></span>}
                {a.increment && <span>Incremento <strong>{a.increment}</strong></span>}
                {a.pomodoro && <span>Pomodoro <strong style={{ color }}>{a.pomodoroTag ? `#${a.pomodoroTag}` : "qualquer nota"}</strong></span>}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 11, color: colors.muted }}>{a.hidden ? "Oculta" : "Visível"}</span>
                    <GloButton {...btn} label={a.hidden ? "Mostrar" : "Ocultar"} onClick={onToggle} />
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                    <GloButton {...btn} label="Editar" onClick={onEdit} />
                    <GloButton {...btn} label="Excluir" onClick={onDelete} style={{ color: colors.error }} />
                </div>
            </div>
        </div>
    );
}

function ActivityManagerReal() {
    const { theme, settings } = useTheme();
    const bg = settings?.widgetBackgrounds !== false;
    dc.useFile(SETTINGS_PATH);
    const sFile = app.vault.getAbstractFileByPath(SETTINGS_PATH);
    const activities = (sFile && app.metadataCache.getFileCache(sFile)?.frontmatter?.activities) || [];
    const [editId, setEditId] = dc.useState(null);
    const [draft, setDraft] = dc.useState(null);
    const [adding, setAdding] = dc.useState(false);
    const [fresh, setFresh] = dc.useState({ ...DEFAULT });
    const [saving, setSaving] = dc.useState(false);

    const colors = {
        primary: theme["color-primary"] || "#7c3aed", accent: theme["color-accent"] || "#f59e0b",
        surface: theme["color-surface"] || "var(--background-secondary)", muted: theme["color-text-muted"] || "var(--text-muted)",
        warning: theme["color-warning"] || "#f59e0b", error: theme["color-red"] || "#ef4444",
    };

    // Toda operação parte do frontmatter atual: nada de lista velha regravada por cima.
    const mutate = async (fn, ok = "Atividades salvas") => {
        if (!sFile) { new Notice("Settings.md não encontrado"); return false; }
        setSaving(true);
        try {
            await app.fileManager.processFrontMatter(sFile, (fm) => { fm.activities = fn(Array.isArray(fm.activities) ? fm.activities : []); });
            new Notice(ok);
            return true;
        } catch (e) { console.error("[dc-activityManager]", e); new Notice("Falha ao salvar as atividades"); return false; }
        finally { setSaving(false); }
    };

    const startEdit = (a) => { setEditId(a.id); setDraft({ ...a }); setAdding(false); };
    const cancelEdit = () => { setEditId(null); setDraft(null); };
    const saveEdit = async () => {
        if (!draft?.id || !draft.name || !draft.field) { new Notice("ID, nome e campo são obrigatórios"); return; }
        if (await mutate(list => list.map(a => a.id === editId ? { ...draft } : a))) cancelEdit();
    };
    const remove = async (a) => { if (confirm(`Excluir a atividade "${a.name}"?`)) await mutate(list => list.filter(x => x.id !== a.id)); };
    const toggle = (a) => mutate(list => list.map(x => x.id === a.id ? { ...x, hidden: !x.hidden } : x));
    const startAdd = () => { setFresh({ ...DEFAULT, id: `activity_${Date.now()}`, color: COLORS[Math.floor(Math.random() * COLORS.length)] }); setAdding(true); cancelEdit(); };
    const saveNew = async () => {
        if (!fresh.id || !fresh.name || !fresh.field) { new Notice("ID, nome e campo são obrigatórios"); return; }
        if (activities.some(a => a.id === fresh.id)) { new Notice("Já existe uma atividade com esse ID"); return; }
        if (activities.some(a => a.field === fresh.field)) { new Notice("Já existe uma atividade com esse campo"); return; }
        const c = { ...fresh };
        if (c.type === "rating") { c.max = c.max || 5; delete c.goal; delete c.increment; }
        else if (c.type === "boolean" || c.type === "count") { delete c.goal; delete c.max; delete c.increment; delete c.unit; }
        for (const k of Object.keys(c)) if (c[k] === null || c[k] === undefined || c[k] === "") delete c[k];
        if (await mutate(list => [...list, c])) { setAdding(false); setFresh({ ...DEFAULT }); }
    };

    return (
        <div style={{ padding: 18, borderRadius: 12, position: "relative", background: bg ? colors.surface : "transparent", border: bg ? `1px solid ${alpha(colors.primary, 0.2)}` : "none" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <h3 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: colors.primary }}>Gerenciador de Atividades</h3>
                    <GloBadge variant="soft" color={colors.accent}>{activities.length} atividades</GloBadge>
                </div>
                <GloButton size="small" variant="liquid-glass" glow={false} label="+ Adicionar atividade" onClick={startAdd} disabled={adding} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {activities.map(a => (
                    <ActivityCard key={a.id} a={a} editing={editId === a.id} draft={draft} setDraft={setDraft} colors={colors} bg={bg}
                        onEdit={() => startEdit(a)} onCancel={cancelEdit} onSave={saveEdit} onDelete={() => remove(a)} onToggle={() => toggle(a)} />
                ))}
                {!activities.length && !adding && <div style={{ padding: 24, textAlign: "center", borderRadius: 8, fontSize: 14, color: colors.muted, background: alpha(colors.primary, 0.07) }}>Nenhuma atividade configurada. Use "+ Adicionar atividade".</div>}
            </div>
            {adding && (
                <div style={{ marginTop: 16, padding: 14, borderRadius: 10, background: `linear-gradient(135deg, ${alpha(colors.accent, 0.13)}, ${colors.surface})`, border: `2px solid ${colors.accent}` }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: colors.accent, marginBottom: 12 }}>Nova atividade</div>
                    <ActivityForm data={fresh} onChange={setFresh} muted={colors.muted} warning={colors.warning} />
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
                        <GloButton size="small" variant="liquid-glass" glow={false} label="Cancelar" onClick={() => { setAdding(false); setFresh({ ...DEFAULT }); }} />
                        <GloButton size="small" variant="liquid-glass" glow={false} label="Criar atividade" onClick={saveNew} disabled={saving} />
                    </div>
                </div>
            )}
            {saving && <div style={{ position: "absolute", inset: 0, display: "flex", justifyContent: "center", alignItems: "center", borderRadius: 12, zIndex: 10, background: "color-mix(in srgb, var(--background-primary) 80%, transparent)", color: colors.primary }}>Salvando...</div>}
        </div>
    );
}

const ActivityManager = gate(ActivityManagerReal);
return { Func: ActivityManager, ActivityManager };
