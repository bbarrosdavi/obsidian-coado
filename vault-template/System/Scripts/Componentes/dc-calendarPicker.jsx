// ═══════════════════════════════════════════════════════════════════════════════
// DC-CALENDAR-PICKER v2 - Mini calendário do wrapper diário
// Navegação por mês, ponto nos dias com nota, dias sem nota esmaecidos (mas
// selecionáveis), hoje destacado, dia escolhido preenchido, botões Hoje/Fechar.
// CalendarPopup: abre/fecha com clique fora.
// Mudanças: nomes em pt-BR; hover por CSS (antes, estilo escrito no elemento
// a cada mouseenter/leave, e o hover sobre o número apagava o fundo errado);
// dias do mês com nota memorizados por mês.
// ═══════════════════════════════════════════════════════════════════════════════

const { useTheme } = await dc.require(dc.fileLink("System/Scripts/Core/dc-themeProvider.jsx"));
const { GloButton, alpha } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloButton.jsx"));
const { getTodayDateStr, parseDateStr, getCalendarGrid, getDatesWithNotes } = await dc.require(dc.fileLink("System/Scripts/Core/dc-dateContext.jsx"));

const MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const MONTH_NAMES_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const DAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const DAY_NAMES_SHORT = ["D", "S", "T", "Q", "Q", "S", "S"];

const CSS_ID = "dc-calendar-css";
const CSS = `
.dcg-cal-nav:not(#dcg){background:transparent;border:none;box-shadow:none;color:var(--cal-muted);font-size:18px;cursor:pointer;padding:4px 10px;border-radius:6px;transition:color .2s}
.dcg-cal-nav:not(#dcg):hover{color:var(--cal-primary)}
.dcg-cal-day:not(#dcg){position:relative;width:36px;height:36px;display:flex;align-items:center;justify-content:center;background:var(--cal-bg,transparent);border:2px solid var(--cal-border,transparent);border-radius:8px;color:var(--cal-fg);font-size:13px;cursor:pointer;box-shadow:none;padding:0;transition:background .15s}
.dcg-cal-day:not(#dcg):not([data-sel]):hover{background:var(--cal-hover)}
`;
function ensureCSS() {
    if (document.getElementById(CSS_ID)) return;
    const s = document.createElement("style"); s.id = CSS_ID; s.textContent = CSS; document.head.appendChild(s);
}

function CalendarPicker({ selectedDate, onSelectDate, onClose, showCloseButton = true, inline = false }) {
    const { theme } = useTheme();
    ensureCSS();
    const todayStr = getTodayDateStr();
    const start = parseDateStr(selectedDate) || parseDateStr(todayStr);
    const [view, setView] = dc.useState({ y: start?.year || new Date().getFullYear(), m: start?.month || new Date().getMonth() + 1 });
    const withNotes = dc.useMemo(() => getDatesWithNotes(view.y, view.m), [view.y, view.m]);
    const grid = dc.useMemo(() => getCalendarGrid(view.y, view.m), [view.y, view.m]);

    const primary = theme["color-primary"] || "#7c3aed", accent = theme["color-accent"] || "#f59e0b";
    const muted = theme["color-text-muted"] || "#a0a0b0", success = theme["color-success"] || "#10b981";
    const text = theme["color-text"] || "var(--text-normal)";
    const step = (d) => setView(v => { const m = v.m + d; return m < 1 ? { y: v.y - 1, m: 12 } : m > 12 ? { y: v.y + 1, m: 1 } : { y: v.y, m }; });
    const goToday = () => { const t = parseDateStr(todayStr); if (t) { setView({ y: t.year, m: t.month }); onSelectDate(todayStr); } };

    return (
        <div style={{
            background: theme["color-surface"] || "var(--background-secondary)", border: `1px solid ${alpha(primary, 0.2)}`, borderRadius: 12, padding: 12, minWidth: 280,
            boxShadow: inline ? "none" : `0 8px 32px ${alpha(primary, 0.2)}`, color: text, fontFamily: "var(--font-interface)",
            "--cal-muted": muted, "--cal-primary": primary, "--cal-hover": alpha(primary, 0.2),
        }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, paddingBottom: 8, borderBottom: `1px solid ${alpha(muted, 0.13)}` }}>
                <button className="dcg-cal-nav" onClick={() => step(-1)} aria-label="Mês anterior">‹</button>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{MONTH_NAMES[view.m - 1]} {view.y}</span>
                <button className="dcg-cal-nav" onClick={() => step(1)} aria-label="Próximo mês">›</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4 }}>
                {DAY_NAMES_SHORT.map((d, i) => <div key={i} style={{ textAlign: "center", fontSize: 10, fontWeight: 600, color: muted, padding: "4px 0", textTransform: "uppercase" }}>{d}</div>)}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, justifyItems: "center" }}>
                {grid.flat().map(({ day, dateStr, isCurrentMonth }) => {
                    const has = withNotes.has(dateStr), isT = dateStr === todayStr, sel = dateStr === selectedDate;
                    let fg = isCurrentMonth ? text : alpha(muted, 0.4);
                    if (sel) fg = "var(--text-on-accent)";
                    else if (isT) fg = accent;
                    else if (!has && isCurrentMonth) fg = alpha(muted, 0.53);
                    return (
                        <button key={dateStr} className="dcg-cal-day" data-sel={sel ? "" : undefined} onClick={() => onSelectDate(dateStr)}
                            style={{ "--cal-bg": sel ? primary : "transparent", "--cal-border": !sel && isT ? accent : "transparent", "--cal-fg": fg, fontWeight: sel || isT ? 600 : 400 }}>
                            {day}
                            {has && !sel && <span style={{ position: "absolute", bottom: 3, left: "50%", transform: "translateX(-50%)", width: 4, height: 4, borderRadius: "50%", background: isT ? accent : success }} />}
                        </button>
                    );
                })}
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10, paddingTop: 8, borderTop: `1px solid ${alpha(muted, 0.13)}` }}>
                <GloButton label="Hoje" size="small" variant="liquid-glass" glow={false} onClick={goToday} />
                {showCloseButton && onClose && <GloButton label="Fechar" size="small" variant="liquid-glass" glow={false} onClick={onClose} />}
            </div>
        </div>
    );
}

function CalendarPopup({ isOpen, selectedDate, onSelectDate, onClose, style = {} }) {
    const ref = dc.useRef(null);
    dc.useEffect(() => {
        if (!isOpen) return;
        const out = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
        const t = setTimeout(() => document.addEventListener("mousedown", out), 100);   // evita fechar no próprio clique de abrir
        return () => { clearTimeout(t); document.removeEventListener("mousedown", out); };
    }, [isOpen, onClose]);
    if (!isOpen) return null;
    return (
        <div ref={ref} style={{ position: "absolute", zIndex: 1000, ...style }}>
            <CalendarPicker selectedDate={selectedDate} onSelectDate={(d) => { onSelectDate(d); onClose(); }} onClose={onClose} showCloseButton={true} />
        </div>
    );
}

return { CalendarPicker, CalendarPopup, MONTH_NAMES, MONTH_NAMES_SHORT, DAY_NAMES, DAY_NAMES_SHORT };
