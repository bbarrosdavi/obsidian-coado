// ═══════════════════════════════════════════════════════════════════════════════
// WEEKLY JOURNAL CARDS
// Journals diários de uma semana ISO (segunda a domingo), um card por dia com o
// texto inteiro visível, renderizado pelo Markdown nativo do Obsidian.
//
// Semana: prop `week` ou `targetDate` ("YYYY-Www", o formato de weekStrForDate
// da Home V5) ou, sem prop, o nome da nota atual ("YYYY-Www Diario"). Assim o
// mesmo bloco funciona dentro do journal semanal e dentro da Home V5.
//
// Datacore e não Bases: o Bases não exibe o corpo das notas, só propriedades.
// v2: portão de visibilidade (a cópia oculta do editor não monta nem lê arquivos).
// ═══════════════════════════════════════════════════════════════════════════════

let useTheme = () => ({ theme: {}, isLoading: false, settings: {} });
try {
    const tp = await dc.require(dc.fileLink("System/Scripts/Core/dc-themeProvider.jsx"));
    if (tp?.useTheme) useTheme = tp.useTheme;
} catch (e) { console.error("[dc-weeklyJournalCards] Theme load error:", e); }

const { gate } = await dc.require(dc.fileLink("System/Scripts/Core/dc-visibleGate.jsx"));

let GloCard = ({ children }) => <div>{children}</div>;
try {
    const gc = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloCard.jsx"));
    if (gc?.GloCard) GloCard = gc.GloCard;
} catch (e) { console.error("[dc-weeklyJournalCards] GloCard load error:", e); }

const DAILY_JOURNAL_FOLDER = "System/Periodicos/Journals/Diarios";
const WEEK_RE = /^(\d{4}-W\d{2})/;

// Segunda a domingo da semana ISO. O formato casa com weekStrForDate/getTodayWeekStr.
function weekDays(week) {
    const monday = window.moment(week, "YYYY-[W]WW").isoWeekday(1);
    return Array.from({ length: 7 }, (_, i) => monday.clone().add(i, "days"));
}

// Corpo do journal sem o frontmatter e sem o título "# Diário de ..." do template.
function journalBody(raw) {
    return raw
        .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "")
        .replace(/^\s*#{1,6}\s+Di[aá]rio de .*(\r?\n|$)/, "")
        .trim();
}

function WeeklyJournalCardsReal({ week: weekProp, targetDate } = {}) {
    const { theme } = useTheme();
    const currentFile = dc.useCurrentFile();

    const textMuted = theme?.["color-text-muted"] || "var(--text-muted)";
    const primary = theme?.["color-primary"] || "#7c3aed";

    const week = [weekProp, targetDate, currentFile?.$name]
        .map(s => (typeof s === "string" ? s.match(WEEK_RE)?.[1] : null))
        .find(Boolean) || null;

    // Query restrita à pasta dos diários: só uma edição num diário re-executa.
    const pages = dc.useQuery(`@page and path("${DAILY_JOURNAL_FOLDER}")`);
    const days = dc.useMemo(() => (week ? weekDays(week) : []), [week]);

    const targets = dc.useMemo(() => {
        const byPath = new Map((pages || []).map(p => [p.$path, p]));
        return days
            .map(d => {
                const path = `${DAILY_JOURNAL_FOLDER}/${d.format("YYYY-MM-DD")} Diario.md`;
                const page = byPath.get(path);
                return page ? { path, date: d, revision: page.$revision } : null;
            })
            .filter(Boolean);
    }, [pages, days]);

    // Relê o texto só quando um dos diários da semana muda (path + revisão).
    const signature = targets.map(t => `${t.path}@${t.revision}`).join("|");
    const [entries, setEntries] = dc.useState(null);
    dc.useEffect(() => {
        let cancelled = false;
        (async () => {
            const loaded = await Promise.all(targets.map(async t => {
                const file = app.vault.getFileByPath(t.path);
                const raw = file ? await app.vault.cachedRead(file) : "";
                return { ...t, body: journalBody(raw) };
            }));
            if (!cancelled) setEntries(loaded);
        })();
        return () => { cancelled = true; };
    }, [signature]);

    if (!week) {
        return <div style={{ fontSize: 12, color: textMuted, fontStyle: "italic" }}>Semana não identificada: use num journal semanal (YYYY-Www Diario) ou passe a prop week.</div>;
    }

    const rangeLabel = days.length ? `${days[0].format("DD/MM")} a ${days[6].format("DD/MM")}` : "";

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, margin: "6px 0" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: primary, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Journals diários da semana {week} <span style={{ color: textMuted, fontWeight: 400, textTransform: "none" }}>({rangeLabel})</span>
            </div>

            {entries === null ? (
                <div style={{ fontSize: 12, color: textMuted }}>Carregando...</div>
            ) : entries.length === 0 ? (
                <div style={{ fontSize: 12, color: textMuted, fontStyle: "italic" }}>Nenhum journal diário nesta semana.</div>
            ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 8, alignItems: "start" }}>
                    {entries.map(entry => {
                        const weekday = entry.date.format("dddd");
                        return (
                            <GloCard
                                key={entry.path}
                                variant="glass"
                                hover={false}
                                title={`${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${entry.date.format("DD/MM")}`}
                                actions={
                                    <span
                                        onClick={() => app.workspace.openLinkText(entry.path, "", false)}
                                        style={{ fontSize: 11, color: textMuted, cursor: "pointer" }}
                                        title="Abrir o journal"
                                    >
                                        Abrir
                                    </span>
                                }
                                headerStyle={{ padding: "8px 12px" }}
                                bodyStyle={{ padding: "4px 12px 10px", fontSize: 13 }}
                            >
                                {entry.body
                                    ? <dc.Markdown content={entry.body} sourcePath={entry.path} inline={false} />
                                    : <div style={{ fontSize: 12, color: textMuted, fontStyle: "italic" }}>Sem texto.</div>}
                            </GloCard>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

const WeeklyJournalCards = gate(WeeklyJournalCardsReal);
return { WeeklyJournalCards, Func: WeeklyJournalCards };
