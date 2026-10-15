// ═══════════════════════════════════════════════════════════════════════════════
// SEMANA (razão de tempo da secretária)
// Por área: orçamento, feito e saldo da semana (segunda a domingo), banco de horas
// e as duas bordas do dia (primeira e última atividade) dos sete dias.
// Só leitura. Fontes (gravadas por ~/.hermes/profiles/secretaria/scripts/secretaria.py):
//   System/Periodicos/<dia>.md → horas_trabalho (daise_ponto), horas_estudo,
//     horas_projetos, horas_misto, primeira_atividade, ultima_atividade
//   System/Planos/Orcamento Semanal.md → orcamento {area: {min, max}}, sono, banco_inicio
//   Projetos_Pessoais/Experimentos/**  → experimento com fases (status: ativo)
// O dia vai das 05:00 às 05:00: última atividade antes das 05:00 é madrugada.
// ═══════════════════════════════════════════════════════════════════════════════

const { useTheme } = await dc.require(dc.fileLink("System/Scripts/Core/dc-themeProvider.jsx"));
const { gate } = await dc.require(dc.fileLink("System/Scripts/Core/dc-visibleGate.jsx"));
const { GloButton, alpha } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloButton.jsx"));
const { GloBar } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloBar.jsx"));

const AREAS = [["trabalho", "horas_trabalho"], ["estudo", "horas_estudo"], ["projetos", "horas_projetos"], ["misto", "horas_misto"]];
const ORCAMENTO = "System/Planos/Orcamento Semanal.md";
const EXPERIMENTOS = "Projetos_Pessoais/Experimentos/";
const DIAS = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];
const CORTE = 5;
const DAY = 86400000;

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const diaLogico = () => new Date(Date.now() - CORTE * 3600000);
const segundaDe = (d) => { const x = new Date(d); x.setHours(12, 0, 0, 0); x.setTime(x.getTime() - ((x.getDay() + 6) % 7) * DAY); return x; };
const num = (v) => { const n = Number(v); return v === null || v === undefined || v === "" || isNaN(n) ? null : n; };
const fmtH = (h) => h === null ? "–" : `${h.toFixed(1).replace(".", ",")}h`;
const fm = (path) => { const f = app.vault.getFileByPath(path); return (f && app.metadataCache.getFileCache(f)?.frontmatter) || null; };
// Minutos desde o início do dia lógico; madrugada vale 24h em diante.
const minutos = (s) => { if (!s) return null; const m = String(s).match(/^(\d{1,2}):(\d{2})/); if (!m) return null; const h = +m[1]; return (h < CORTE ? h + 24 : h) * 60 + +m[2]; };

function experimentoAtivo(hojeIso) {
    for (const f of app.vault.getMarkdownFiles()) {
        if (!f.path.startsWith(EXPERIMENTOS)) continue;
        const m = app.metadataCache.getFileCache(f)?.frontmatter;
        if (!m?.experimento || !["ativo", "em-andamento"].includes(String(m.status || "").toLowerCase())) continue;
        for (const fase of m.fases || []) {
            const a = String(fase.inicio), b = String(fase.fim);
            if (a <= hojeIso && hojeIso <= b) {
                const dia = Math.round((Date.parse(hojeIso) - Date.parse(a)) / DAY) + 1, total = Math.round((Date.parse(b) - Date.parse(a)) / DAY) + 1;
                return { id: m.experimento, fase: fase.fase, dia, total, intervencao: !!fase.intervencao, path: f.path };
            }
        }
    }
    return null;
}

function SemanaReal({ embutido = false } = {}) {
    const { theme } = useTheme();
    const [desloc, setDesloc] = dc.useState(0);   // 0 = esta semana, -1 = anterior...
    const [tick, setTick] = dc.useState(0);
    dc.useEffect(() => {
        const ref = app.metadataCache.on("changed", (f) => { if (f.path.startsWith("System/Periodicos/") || f.path === ORCAMENTO) setTick(t => t + 1); });
        return () => app.metadataCache.offref(ref);
    }, []);
    const primary = theme["color-primary"] || "#7c3aed", muted = theme["color-text-muted"] || "var(--text-muted)";
    const green = theme["color-success"] || theme["color-green"] || "#10b981", warn = theme["color-warning"] || theme["color-orange"] || "#f59e0b";

    const dados = dc.useMemo(() => {
        const hoje = diaLogico(), hojeIso = iso(hoje);
        const seg = segundaDe(new Date(segundaDe(hoje).getTime() + desloc * 7 * DAY));
        const orc = fm(ORCAMENTO) || {};
        const areasOrc = orc.orcamento || {};
        const limiteSono = String(orc.sono?.deitar_ate || "00:00");
        const dias = DIAS.map((rot, i) => {
            const d = new Date(seg.getTime() + i * DAY), k = iso(d);
            const m = fm(`System/Periodicos/${k}.md`) || {};
            const v = {};
            for (const [a, campo] of AREAS) v[a] = num(m[campo]);
            return { rot, k, futuro: k > hojeIso, hoje: k === hojeIso, v, primeira: m.primeira_atividade || null, ultima: m.ultima_atividade || null };
        });
        const feito = {};
        for (const [a] of AREAS) feito[a] = dias.reduce((s, d) => s + (d.v[a] || 0), 0);
        // Banco: semanas completas desde banco_inicio, até a semana anterior à exibida.
        const banco = {};
        const ini = orc.banco_inicio ? segundaDe(new Date(`${orc.banco_inicio}T12:00:00`)) : null;
        if (ini) for (let s = ini.getTime(); s < seg.getTime(); s += 7 * DAY) {
            for (const [a, campo] of AREAS) {
                const o = areasOrc[a] || {}, alvo = num(o.min) ?? num(o.max);
                if (alvo === null) continue;
                let tot = 0;
                for (let i = 0; i < 7; i++) tot += num((fm(`System/Periodicos/${iso(new Date(s + i * DAY))}.md`) || {})[campo]) || 0;
                banco[a] = (banco[a] || 0) + tot - alvo;
            }
        }
        const limMin = minutos(limiteSono);
        const tarde = dias.filter(d => !d.futuro && minutos(d.ultima) !== null && minutos(d.ultima) > limMin).length;
        return { seg, dias, feito, areasOrc, banco, limiteSono, tarde, fechados: dias.filter(d => !d.futuro).length, exp: experimentoAtivo(hojeIso) };
    }, [desloc, tick]);

    const lbl = { fontSize: 11, textTransform: "uppercase", color: muted, fontWeight: 700 };
    const big = { fontSize: 24, fontWeight: 800, fontVariantNumeric: "tabular-nums" };
    const sep = { borderLeft: `1px solid ${alpha(primary, 0.2)}`, paddingLeft: 20 };
    const h3 = { borderBottom: `2px solid ${alpha(primary, 0.27)}`, paddingBottom: 10, marginBottom: 12, marginTop: 24 };
    const btn = { size: "small", variant: "liquid-glass", glow: false };
    const cell = { padding: "6px 10px", fontVariantNumeric: "tabular-nums", textAlign: "right" };
    const fim = new Date(dados.seg.getTime() + 6 * DAY);
    const titulo = `${String(dados.seg.getDate()).padStart(2, "0")}/${String(dados.seg.getMonth() + 1).padStart(2, "0")} a ${String(fim.getDate()).padStart(2, "0")}/${String(fim.getMonth() + 1).padStart(2, "0")}`;

    const statusArea = (a) => {
        const o = dados.areasOrc[a] || {}, f = dados.feito[a], min = num(o.min), max = num(o.max);
        if (min !== null && f < min) return { txt: `faltam ${fmtH(min - f)} para o piso`, cor: undefined };
        if (max !== null && f > max) return { txt: `${fmtH(f - max)} acima do teto`, cor: warn };
        if (min !== null || max !== null) return { txt: max !== null ? `${fmtH(max - f)} até o teto` : "piso cumprido", cor: green };
        return { txt: "sem orçamento", cor: undefined };
    };

    return (
        <div style={{ padding: 10 }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <div style={{ display: "flex", gap: 6 }}>
                    <GloButton {...btn} label="Semana anterior" onClick={() => setDesloc(desloc - 1)} />
                    <GloButton {...btn} label="Esta semana" active={desloc === 0} onClick={() => setDesloc(0)} />
                    <GloButton {...btn} label="Próxima" onClick={() => setDesloc(Math.min(0, desloc + 1))} />
                </div>
                <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{titulo}</span>
                {!embutido && <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                    <GloButton {...btn} label="Orçamento" onClick={() => app.workspace.openLinkText(ORCAMENTO, "", true)} />
                    {dados.exp && <GloButton {...btn} label={`Protocolo ${dados.exp.id}`} onClick={() => app.workspace.openLinkText(dados.exp.path, "", true)} />}
                </div>}
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 20, padding: 15, background: alpha(primary, 0.1), borderRadius: 12, border: `1px solid ${alpha(primary, 0.2)}` }}>
                {AREAS.map(([a], i) => {
                    const o = dados.areasOrc[a] || {}, st = statusArea(a);
                    const lim = [num(o.min) !== null ? `piso ${o.min}h` : null, num(o.max) !== null ? `teto ${o.max}h` : null].filter(Boolean).join(" · ");
                    return (
                        <div key={a} style={i ? sep : undefined}>
                            <div style={lbl}>{a}</div>
                            <div style={big}>{fmtH(dados.feito[a])}</div>
                            <div style={{ fontSize: 11, color: muted }}>{lim || "sem orçamento"}</div>
                            <div style={{ fontSize: 11, color: st.cor || muted }}>{st.txt}</div>
                        </div>
                    );
                })}
                <div style={sep}>
                    <div style={lbl}>Noites depois de {dados.limiteSono}</div>
                    <div style={big}>{dados.tarde}</div>
                    <div style={{ fontSize: 11, color: muted }}>de {dados.fechados} dias</div>
                </div>
            </div>

            <h3 style={h3}>Orçamento</h3>
            {AREAS.map(([a]) => {
                const o = dados.areasOrc[a] || {}, alvo = num(o.max) ?? num(o.min);
                if (alvo === null) return null;
                const pct = Math.min(100, Math.round(dados.feito[a] / alvo * 100));
                const passou = num(o.max) !== null && dados.feito[a] > num(o.max);
                return (
                    <div key={a} style={{ marginBottom: 14 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, fontSize: 13, marginBottom: 4 }}>
                            <span style={{ fontWeight: 600 }}>{a}</span>
                            <span style={{ color: muted, fontVariantNumeric: "tabular-nums" }}>
                                {fmtH(dados.feito[a])} de {num(o.max) !== null ? `teto ${o.max}h` : `piso ${o.min}h`}
                                {a in dados.banco ? ` · banco ${dados.banco[a] >= 0 ? "+" : ""}${fmtH(dados.banco[a])}` : ""}
                            </span>
                        </div>
                        <GloBar value={pct} max={100} height="8px" fillGradient={`linear-gradient(90deg, ${passou ? warn : primary}, ${passou ? warn : primary}88)`} showSprite={false} showValue={false} borderRadius="4px" />
                    </div>
                );
            })}

            <h3 style={h3}>Dias</h3>
            <table className="semana-tabela" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead><tr style={{ color: muted, fontSize: 11, textTransform: "uppercase" }}>
                    <th style={{ ...cell, textAlign: "left" }}>Dia</th>
                    {AREAS.map(([a]) => <th key={a} style={cell}>{a}</th>)}
                    <th style={cell}>Primeira</th><th style={cell}>Última</th>
                </tr></thead>
                <tbody>{dados.dias.map(d => {
                    const tarde = minutos(d.ultima) !== null && minutos(d.ultima) > minutos(dados.limiteSono);
                    return (
                        <tr key={d.k} style={{ borderTop: `1px solid ${alpha(primary, 0.1)}`, opacity: d.futuro ? 0.45 : 1 }}>
                            <td style={{ ...cell, textAlign: "left", fontWeight: d.hoje ? 800 : 600, whiteSpace: "nowrap" }}>{d.rot} {d.k.slice(8, 10)}/{d.k.slice(5, 7)}</td>
                            {AREAS.map(([a]) => <td key={a} style={cell}>{d.futuro ? "" : fmtH(d.v[a])}</td>)}
                            <td style={cell}>{d.primeira || ""}</td>
                            <td style={{ ...cell, color: tarde ? warn : undefined, fontWeight: tarde ? 700 : undefined }}>{d.ultima || ""}</td>
                        </tr>
                    );
                })}</tbody>
            </table>
            <style>{`.semana-tabela, .semana-tabela th, .semana-tabela td { border: none !important; background: transparent !important; } .semana-tabela th { font-size: 11px !important; font-weight: 700; } .semana-tabela td { font-size: 13px !important; }`}</style>
            <div style={{ fontSize: 11, color: muted, marginTop: 8 }}>
                Atenção medida, não esforço: uma hora conta quando houve pedido nela. O dia vai das 05:00 às 05:00. Misto são sessões abertas no home.
            </div>

            {dados.exp && !embutido && <>
                <h3 style={h3}>Experimento</h3>
                <div style={{ fontSize: 13 }}>
                    <b>{dados.exp.id}</b>, fase {dados.exp.fase}, dia {dados.exp.dia} de {dados.exp.total} · {dados.exp.intervencao ? "intervenção ligada" : "sem intervenção"}
                </div>
            </>}
        </div>
    );
}

const Semana = gate(SemanaReal);
return { Func: Semana, Semana };
