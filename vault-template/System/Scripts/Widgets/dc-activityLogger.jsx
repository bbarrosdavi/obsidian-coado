// ═══════════════════════════════════════════════════════════════════════════════
// ACTIVITY LOGGER v3 (Atividades de hoje) - versão única (antes: dc-activityLogger
// e dc-activityLoggerV5)
// Uma linha por atividade visível do Settings (activities), por tipo:
//   value   barra arrastável + botões ± (increment)
//   rating  marcadores 1..max
//   boolean botão feito / pendente
//   count   contador (contado por outro widget)
//   managed barra somente leitura (gerida por outro widget, ex.: sono, refeições)
//
// Grava na nota do dia o campo `field` de cada atividade (mesmo formato).
// Correções: booleanas gravavam na nota ATIVA (na Home, a própria Home.md:
// por isso ela tem `meditar: false`); arrastar uma atividade gerenciada mexia
// a barra sem salvar; o timer único descartava mudanças seguidas.
// Atividades de tempo com `pomodoro: true` recebem o tempo de pomodoro do dia
// (Core/dc-pomodoroTime, pelos timeEntries das notas): o Estudo soma o tempo
// registrado nas notas com a tag academico.
// ═══════════════════════════════════════════════════════════════════════════════

const { useTheme } = await dc.require(dc.fileLink("System/Scripts/Core/dc-themeProvider.jsx"));
const { resolveDateStr, useDayFrontmatter, getActivities } = await dc.require(dc.fileLink("System/Scripts/Core/dc-dateContext.jsx"));
const { GloButton, alpha } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloButton.jsx"));
const { GloBar } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloBar.jsx"));
const { GloCard } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloCard.jsx"));
const { GloBadge } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloBadge.jsx"));
const { GloRating } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloRating.jsx"));
const Pomo = await dc.require(dc.fileLink("System/Scripts/Core/dc-pomodoroTime.jsx"));

const isImage = (icon) => typeof icon === "string" && /^(https?:|data:image\/)/.test(icon);
const visible = (a) => !a.hidden && a.type !== "mood" && a.id !== "sleep-quality" && a.id !== "sleep";

// Forma da avaliação por atividade (sem emoji): humor em carinha, energia em raio, sono em estrela, noite em lua.
const RATING_SHAPE = { mood: "face", energy: "bolt", "sleep-quality": "star", "mood-evening": "moon" };

function Row({ activity: a, value, onSave, theme }) {
    const primary = theme["color-primary"] || "#7c3aed";
    const success = theme["color-success"] || "#10b981";
    const muted = theme["color-text-muted"] || "var(--text-muted)";
    const color = a.color || primary;
    const v = a.type === "boolean" ? !!value : (Number(value) || 0);
    let progress = 0, done = false;
    if (a.type === "boolean") { progress = v ? 100 : 0; done = v; }
    else if (a.type === "rating") { const max = a.max || 5; progress = (v / max) * 100; done = v >= max; }
    else if (a.goal) { progress = Math.min((v / a.goal) * 100, 100); done = v >= a.goal; }
    const fmt = a.type === "boolean" ? (v ? "feito" : "pendente")
        : a.type === "rating" ? `${v} / ${a.max || 5}`
        : a.goal ? `${v} / ${a.goal} ${a.unit || ""}` : `${v} ${a.unit || ""}`;
    const sprite = theme["bar-sprite"] || null;
    const step = (dir) => onSave(Math.max(0, Number((v + dir * a.increment).toFixed(2))), true);

    let control;
    if (a.managed) {
        control = (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ flex: 1 }}><GloBar value={v} max={a.type === "rating" ? (a.max || 5) : (a.goal || 100)} showValue={false} showSprite={!!sprite} sprite={sprite}
                    fillGradient={`linear-gradient(90deg, ${color}, ${color}aa)`} trackBg={theme["bar-track-bg"] || alpha(color, 0.15)} height="10px" /></div>
                <GloBadge variant="outlined" size="small" status="neutral">gerenciado</GloBadge>
            </div>
        );
    } else if (a.type === "boolean") {
        control = <GloButton size="small" variant="liquid-glass" glow={false} active={v} label={v ? "Feito" : "Marcar feito"} onClick={() => onSave(!v, true)} />;
    } else if (a.type === "rating") {
        control = <GloRating value={v} max={a.max || 5} color={color} shape={RATING_SHAPE[a.id] || "star"} showValue={false} onChange={(x) => onSave(x, true)} />;
    } else if (a.type === "count") {
        control = <span style={{ fontSize: 11, color: muted }}>contado automaticamente</span>;
    } else {
        control = (
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ flex: 1, minWidth: 70 }}>
                    <GloBar value={v} max={(a.goal || 100) * 1.5} draggable showValue={false} showSprite sprite={sprite}
                        spriteWidth={theme["bar-sprite-width"] || 34} spriteHeight={theme["bar-sprite-height"] || 21}
                        fillGradient={`linear-gradient(90deg, ${color}, ${color}aa)`} trackBg={theme["bar-track-bg"] || alpha(color, 0.15)} height="10px"
                        onChange={(x) => onSave(x, false)} onDragEnd={() => onSave(undefined, true)} />
                </div>
                {a.increment ? (
                    <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                        {[-1, 1].map(d => (
                            <GloButton key={d} label={`${d < 0 ? "-" : "+"}${a.increment}`} size="small" variant="liquid-glass" glow={false} onClick={() => step(d)}
                                style={{ padding: "0 5px", height: 18, minHeight: 18, fontSize: 10, lineHeight: 1, borderRadius: 4 }} />
                        ))}
                    </div>
                ) : null}
            </div>
        );
    }

    return (
        <GloCard variant="liquid-glass" size="small" style={{ borderRadius: 8 }} bodyStyle={{ padding: "4px 8px", display: "flex", flexDirection: "column", gap: 3 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                    {isImage(a.icon)
                        ? <img src={a.icon} alt="" style={{ width: 14, height: 14, objectFit: "contain", borderRadius: 3 }} />
                        : <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />}
                    <span style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.name || a.label || a.id}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                    <span style={{ fontSize: 11, color: muted, fontVariantNumeric: "tabular-nums" }}>{fmt}</span>
                    {a.type !== "count" && <span style={{ fontSize: 12, fontWeight: 700, color: done ? success : color, minWidth: 26, textAlign: "right" }}>{done ? "ok" : `${Math.round(progress)}%`}</span>}
                </div>
            </div>
            {control}
        </GloCard>
    );
}

function ActivityLogger({ targetDate, compact = true }) {
    const { theme, settings } = useTheme();
    const dateStr = resolveDateStr(targetDate);
    const { fm, save, flush, exists } = useDayFrontmatter(dateStr, 600);
    const acts = getActivities().filter(visible);
    const primary = theme["color-primary"] || "#7c3aed";
    const muted = theme["color-text-muted"] || "var(--text-muted)";
    const bg = settings?.widgetBackgrounds !== false;

    // Tempo de pomodoro nas atividades com `pomodoro: true` (ver Core/dc-pomodoroTime):
    // soma ao campo só a diferença desde a última sincronização (<field>-pomodoro).
    const fmRef = dc.useRef(fm); fmRef.current = fm;
    const sync = async () => {
        if (!exists) return;
        const timed = getActivities().filter(a => a.pomodoro && a.field && Pomo.isTimeUnit(a.unit) && !a.managed);
        if (!timed.length) return;
        const cur = fmRef.current, up = {};
        for (const a of timed) {
            const key = `${a.field}-pomodoro`;
            const now = Pomo.minutesOn(dateStr, a.pomodoroTag || "");
            const before = Number(cur[key]) || 0;
            if (now === before) continue;
            up[a.field] = Math.max(0, Number(((Number(cur[a.field]) || 0) + Pomo.toUnit(now - before, a.unit)).toFixed(2)));
            up[key] = now;
        }
        if (Object.keys(up).length) save(up, true);
    };
    dc.useEffect(() => { sync(); }, [dateStr, exists]);
    Pomo.useTimeChanges(getActivities().filter(a => a.pomodoro && Pomo.isTimeUnit(a.unit)).map(a => a.pomodoroTag || ""), sync);

    const onSave = (a) => (val, immediate) => {
        if (a.managed) return;
        if (val === undefined) { if (immediate) flush(); return; }
        save({ [a.field]: val }, immediate);
    };

    return (
        <div style={{
            background: bg ? (theme["color-surface"] || "var(--background-secondary)") : "transparent",
            border: bg ? `1px solid ${alpha(primary, 0.2)}` : "none", borderRadius: 16, padding: "10px 12px", boxSizing: "border-box",
            display: "flex", flexDirection: "column",
        }}>
            {compact && <div style={{ height: 52, flexShrink: 0 }} />}
            <h4 style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700, color: primary }}>Atividades de hoje</h4>
            {!acts.length && <div style={{ padding: 12, textAlign: "center", color: muted, fontSize: 12 }}>Nenhuma atividade configurada.</div>}
            {acts.length > 0 && !exists && <div style={{ padding: 8, color: muted, fontSize: 12, fontStyle: "italic" }}>Sem nota do dia para registrar.</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {exists && acts.map(a => <Row key={a.id} activity={a} value={fm[a.field]} onSave={onSave(a)} theme={theme} />)}
            </div>
        </div>
    );
}

return { Func: ActivityLogger, ActivityLogger };
