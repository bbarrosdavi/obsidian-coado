// ═══════════════════════════════════════════════════════════════════════════════
// DC-POMODORO-TIME - tempo registrado nas tarefas, por dia e tag
//
// Fonte: `timeEntries` das próprias notas (o TaskNotes grava ali cada sessão de
// pomodoro, "Work session", e também o tempo cronometrado à mão). Confere com o
// `pomodoroHistory` do plugin: as mesmas sessões, com os mesmos trechos ativos.
//
// Uso numa atividade do Settings (só faz sentido com unidade de tempo):
//   pomodoro: true          soma o tempo do dia nas tarefas ao campo
//   pomodoroTag: academico  só notas com essa tag (vazio = qualquer nota)
// O registro de atividades grava `<field>` += minutos novos (convertidos para a
// unidade) e guarda em `<field>-pomodoro` os minutos já somados, para nunca contar
// duas vezes; o que foi lançado à mão continua no campo.
// ═══════════════════════════════════════════════════════════════════════════════

const HOURS = /^(h|hr|hrs|hora|horas|hour|hours)$/i;
const MINUTES = /^(m|min|mins|minuto|minutos|minute|minutes)$/i;

/** Unidade de tempo? (horas ou minutos) */
const isTimeUnit = (unit) => HOURS.test(String(unit || "").trim()) || MINUTES.test(String(unit || "").trim());
/** Minutos convertidos para a unidade da atividade. */
const toUnit = (minutes, unit) => HOURS.test(String(unit || "").trim()) ? minutes / 60 : minutes;
const norm = (t) => String(t || "").trim().replace(/^#/, "").toLowerCase();
/** A nota tem a tag (frontmatter ou no texto; aceita subtags: academico/x)? */
function hasTag(file, tag) {
    if (!tag) return true;
    const want = norm(tag), cache = app.metadataCache.getFileCache(file);
    if (!cache) return false;
    const fmTags = cache.frontmatter?.tags;
    const all = [...(Array.isArray(fmTags) ? fmTags : fmTags ? String(fmTags).split(/[,\s]+/) : []), ...(cache.tags || []).map(t => t.tag)];
    return all.some(t => { const n = norm(t); return n === want || n.startsWith(want + "/"); });
}

/** Minutos registrados no dia local `dateStr` nas notas com a tag `tag`. */
function minutesOn(dateStr, tag = "") {
    const [y, m, d] = dateStr.split("-").map(Number);
    const a = new Date(y, m - 1, d).getTime(), b = new Date(y, m - 1, d + 1).getTime();
    let ms = 0;
    for (const f of app.vault.getMarkdownFiles()) {
        const entries = app.metadataCache.getFileCache(f)?.frontmatter?.timeEntries;
        if (!Array.isArray(entries) || !hasTag(f, tag)) continue;
        for (const e of entries) {
            const st = Date.parse(e?.startTime), en = Date.parse(e?.endTime);
            if (!st || !en || en <= st) continue;          // cronômetro ainda rodando: entra quando parar
            ms += Math.max(0, Math.min(en, b) - Math.max(st, a));
        }
    }
    return Math.round(ms / 60000);
}

/** Chama `onChange` quando muda uma nota com alguma das tags (vazio = qualquer). */
function useTimeChanges(tags, onChange) {
    const ref = dc.useRef(onChange); ref.current = onChange;
    const key = tags.join("|");
    dc.useEffect(() => {
        if (!tags.length) return;
        let t = null;
        const evt = app.metadataCache.on("changed", (file) => {
            if (!tags.some(tag => hasTag(file, tag))) return;
            clearTimeout(t); t = setTimeout(() => ref.current(), 800);
        });
        return () => { clearTimeout(t); app.metadataCache.offref(evt); };
    }, [key]);
}

return { isTimeUnit, toUnit, hasTag, minutesOn, useTimeChanges };
