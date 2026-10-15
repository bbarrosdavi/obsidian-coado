// ═══════════════════════════════════════════════════════════════════════════════
// SECRETÁRIA (painel da Hina secretária)
// Tudo o que a secretária mede e faz, numa dashboard própria (fora do Home):
//   Agora     → trecho de tempo aberto, capturas a triar, lembretes, mensagens
//               proativas do dia contra o teto, experimento em curso
//   Semana    → o widget dc-semana (orçamento, feito, saldo, banco, bordas)
//   Hoje      → capturas numeradas e lembretes agendados
//   E1        → última atividade por dia, com as fases do protocolo
//   Rituais   → os jobs secretaria-* do cron do Hermes: último disparo e próximo
//   Conversa  → falas recentes nas duas pontas (Hina e perfil secretaria do Hermes)
// Fontes: o que está na vault vem do metadataCache (diários, protocolo); o que
// está fora (estado, lembretes, cron, conversa) vem de `secretaria.py painel`,
// rodado ao abrir e no botão Atualizar (~0,3 s). Só leitura.
// ═══════════════════════════════════════════════════════════════════════════════

const { useTheme } = await dc.require(dc.fileLink("System/Scripts/Core/dc-themeProvider.jsx"));
const { gate } = await dc.require(dc.fileLink("System/Scripts/Core/dc-visibleGate.jsx"));
const { GloButton, alpha } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloButton.jsx"));
const semanaMod = await dc.require(dc.fileLink("System/Scripts/Widgets/dc-semana.jsx"));

const PYTHON = "/home/davi/.hermes/hermes-agent/venv/bin/python";
const SCRIPT = "/home/davi/.hermes/profiles/secretaria/scripts/secretaria.py";
const EXPERIMENTOS = "Projetos_Pessoais/Experimentos/";
const ORCAMENTO = "System/Planos/Orcamento Semanal.md";
const CORTE = 5;
const DAY = 86400000;

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const hhmm = (s) => (s ? String(s).slice(11, 16) : "");
const ddmm = (s) => (s ? `${String(s).slice(8, 10)}/${String(s).slice(5, 7)}` : "");
const fm = (path) => { const f = app.vault.getFileByPath(path); return (f && app.metadataCache.getFileCache(f)?.frontmatter) || null; };
// Minutos desde 18:00 do dia lógico; madrugada (antes das 05:00) continua o mesmo dia.
const minutos = (s) => { const m = String(s || "").match(/^(\d{1,2}):(\d{2})/); if (!m) return null; const h = +m[1]; return ((h < CORTE ? h + 24 : h) - 18) * 60 + +m[2]; };
const rotulo = (min) => { const h = (18 + Math.floor(min / 60)) % 24; return `${String(h).padStart(2, "0")}:00`; };

function rodarPainel() {
    return new Promise((resolve) => {
        try {
            const cp = window.require("child_process");
            cp.execFile(PYTHON, [SCRIPT, "painel"], { timeout: 15000, maxBuffer: 2 * 1024 * 1024 }, (err, out) => {
                if (err) return resolve({ erro: String(err.message || err).split("\n")[0] });
                try { resolve(JSON.parse(out)); } catch (e) { resolve({ erro: "saída inválida do secretaria.py" }); }
            });
        } catch (e) { resolve({ erro: String(e) }); }
    });
}

function experimento() {
    for (const f of app.vault.getMarkdownFiles()) {
        if (!f.path.startsWith(EXPERIMENTOS)) continue;
        const m = app.metadataCache.getFileCache(f)?.frontmatter;
        if (m?.experimento && Array.isArray(m.fases) && ["ativo", "em-andamento"].includes(String(m.status || "").toLowerCase())) {
            return { id: m.experimento, metrica: m.metrica, fases: m.fases.map(x => ({ fase: x.fase, inicio: String(x.inicio), fim: String(x.fim), intervencao: !!x.intervencao })), path: f.path };
        }
    }
    return null;
}

function GraficoE1({ exp, theme }) {
    const primary = theme["color-primary"] || "#7c3aed", muted = theme["color-text-muted"] || "#888";
    const warn = theme["color-warning"] || theme["color-orange"] || "#f59e0b";
    const ini = new Date(`${exp.fases[0].inicio}T12:00:00`), fim = new Date(`${exp.fases[exp.fases.length - 1].fim}T12:00:00`);
    const n = Math.round((fim - ini) / DAY) + 1;
    const hoje = iso(new Date(Date.now() - CORTE * 3600000));
    const dias = Array.from({ length: n }, (_, i) => {
        const k = iso(new Date(ini.getTime() + i * DAY));
        return { k, v: k <= hoje ? minutos((fm(`System/Periodicos/${k}.md`) || {}).ultima_atividade) : null };
    });
    const W = 560, H = 190, L = 44, R = 8, T = 18, B = 26;
    const yMin = 2 * 60, yMax = 11 * 60;   // 20:00 a 05:00
    const x = (i) => L + (i + 0.5) * ((W - L - R) / n);
    const y = (v) => T + (1 - (Math.min(Math.max(v, yMin), yMax) - yMin) / (yMax - yMin)) * (H - T - B);
    const idx = (k) => Math.round((new Date(`${k}T12:00:00`) - ini) / DAY);
    const mediana = (arr) => { const a = arr.filter(v => v !== null).sort((p, q) => p - q); return a.length ? (a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2) : null; };
    const pts = dias.map((d, i) => d.v === null ? null : [x(i), y(d.v)]);
    let caminho = "", aberto = false;
    pts.forEach(p => { if (!p) { aberto = false; return; } caminho += `${aberto ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)} `; aberto = true; });
    return (
        <svg width={W} height={H} style={{ display: "block", maxWidth: "none" }}>
            {exp.fases.map(f => {
                const a = idx(f.inicio), b = idx(f.fim);
                const med = mediana(dias.slice(a, b + 1).map(d => d.v));
                return (
                    <g key={f.fase}>
                        <rect x={L + a * ((W - L - R) / n)} y={T} width={(b - a + 1) * ((W - L - R) / n)} height={H - T - B} fill={alpha(primary, f.intervencao ? 0.13 : 0.05)} />
                        <text x={L + a * ((W - L - R) / n) + 4} y={T - 5} fontSize="10" fill={muted}>{f.fase}{f.intervencao ? " (intervenção)" : ""}{med !== null ? ` · mediana ${rotulo(med).slice(0, 2)}:${String(Math.round(med % 60)).padStart(2, "0")}` : ""}</text>
                        {med !== null && <line x1={x(a) - 6} x2={x(b) + 6} y1={y(med)} y2={y(med)} stroke={primary} strokeDasharray="4 3" strokeWidth="1.5" />}
                    </g>
                );
            })}
            {[2, 4, 6, 8, 10].map(hh => (
                <g key={hh}>
                    <line x1={L} x2={W - R} y1={y(hh * 60)} y2={y(hh * 60)} stroke={alpha(primary, hh === 6 ? 0.45 : 0.12)} strokeWidth={hh === 6 ? 1.2 : 1} />
                    <text x={L - 6} y={y(hh * 60) + 3} fontSize="10" fill={muted} textAnchor="end">{rotulo(hh * 60)}</text>
                </g>
            ))}
            <path d={caminho} fill="none" stroke={primary} strokeWidth="1.8" />
            {dias.map((d, i) => d.v === null ? null : (
                <circle key={d.k} cx={x(i)} cy={y(d.v)} r="3.5" fill={d.v > 6 * 60 ? warn : primary}><title>{`${ddmm(d.k + "T")} ${rotulo(d.v).slice(0, 2)}:${String(d.v % 60).padStart(2, "0")}`}</title></circle>
            ))}
            {dias.map((d, i) => (i % 2 === 0 ? <text key={"t" + d.k} x={x(i)} y={H - 8} fontSize="9" fill={muted} textAnchor="middle">{d.k.slice(8, 10)}/{d.k.slice(5, 7)}</text> : null))}
        </svg>
    );
}

function SecretariaReal() {
    const { theme } = useTheme();
    const [dados, setDados] = dc.useState(null);
    const [carregando, setCarregando] = dc.useState(false);
    const [tick, setTick] = dc.useState(0);
    const atualizar = async () => { setCarregando(true); setDados(await rodarPainel()); setCarregando(false); };
    dc.useEffect(() => { atualizar(); }, []);
    dc.useEffect(() => {
        const ref = app.metadataCache.on("changed", (f) => { if (f.path.startsWith("System/Periodicos/") || f.path.startsWith(EXPERIMENTOS)) setTick(t => t + 1); });
        return () => app.metadataCache.offref(ref);
    }, []);
    const exp = dc.useMemo(() => experimento(), [tick]);

    const primary = theme["color-primary"] || "#7c3aed", muted = theme["color-text-muted"] || "var(--text-muted)";
    const green = theme["color-success"] || theme["color-green"] || "#10b981", warn = theme["color-warning"] || theme["color-orange"] || "#f59e0b";
    const lbl = { fontSize: 11, textTransform: "uppercase", color: muted, fontWeight: 700 };
    const big = { fontSize: 24, fontWeight: 800, fontVariantNumeric: "tabular-nums" };
    const sep = { borderLeft: `1px solid ${alpha(primary, 0.2)}`, paddingLeft: 20 };
    const h3 = { borderBottom: `2px solid ${alpha(primary, 0.27)}`, paddingBottom: 10, marginBottom: 12, marginTop: 24 };
    const btn = { size: "small", variant: "liquid-glass", glow: false };
    const cell = { padding: "5px 8px", fontVariantNumeric: "tabular-nums", textAlign: "left", fontSize: 13 };
    const abrir = (p) => app.workspace.openLinkText(p, "", true);

    const d = dados || {};
    const trecho = d.trecho;
    const minTrecho = trecho ? Math.round((Date.now() - Date.parse(trecho.quando)) / 60000) : 0;
    const proxLemb = (d.lembretes || [])[0];
    const hojeIso = iso(new Date(Date.now() - CORTE * 3600000));
    const fase = exp?.fases.find(f => f.inicio <= hojeIso && hojeIso <= f.fim);
    const semanaRev = (() => { const t = new Date(); const dd = new Date(Date.UTC(t.getFullYear(), t.getMonth(), t.getDate())); const day = dd.getUTCDay() || 7; dd.setUTCDate(dd.getUTCDate() + 4 - day); const y0 = new Date(Date.UTC(dd.getUTCFullYear(), 0, 1)); return `${dd.getUTCFullYear()}-W${String(Math.ceil(((dd - y0) / DAY + 1) / 7)).padStart(2, "0")}`; })();

    return (
        <div style={{ padding: 10, containerType: "inline-size" }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <GloButton {...btn} label={carregando ? "Atualizando" : "Atualizar"} onClick={atualizar} />
                    <GloButton {...btn} label="Orçamento" onClick={() => abrir(ORCAMENTO)} />
                    {exp && <GloButton {...btn} label={`Protocolo ${exp.id}`} onClick={() => abrir(exp.path)} />}
                    <GloButton {...btn} label="Revisão da semana" onClick={() => abrir(`System/Planos/Semanais/${semanaRev} Revisao.md`)} />
                </div>
                <span style={{ marginLeft: "auto", fontSize: 11, color: muted }}>{d.erro ? `erro: ${d.erro}` : d.gerado ? `lido às ${hhmm(d.gerado)}` : ""}</span>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 20, padding: 15, background: alpha(primary, 0.1), borderRadius: 12, border: `1px solid ${alpha(primary, 0.2)}` }}>
                <div>
                    <div style={lbl}>Agora</div>
                    <div style={big}>{trecho ? trecho.area : "livre"}</div>
                    <div style={{ fontSize: 11, color: muted }}>{trecho ? `desde ${hhmm(trecho.quando)} (${Math.floor(minTrecho / 60)}h${String(minTrecho % 60).padStart(2, "0")})` : "nenhum trecho aberto"}</div>
                    {trecho?.texto && <div style={{ fontSize: 11, color: muted }}>{trecho.texto}</div>}
                </div>
                <div style={sep}>
                    <div style={lbl}>Capturas a triar</div>
                    <div style={big}>{(d.capturas || []).length}</div>
                </div>
                <div style={sep}>
                    <div style={lbl}>Lembretes</div>
                    <div style={big}>{(d.lembretes || []).length}</div>
                    <div style={{ fontSize: 11, color: muted }}>{proxLemb ? `próximo ${ddmm(proxLemb.quando)} ${hhmm(proxLemb.quando)}` : "nenhum agendado"}</div>
                </div>
                <div style={sep}>
                    <div style={lbl}>Mensagens hoje</div>
                    <div style={big}>{d.enviadas_hoje ?? 0}</div>
                    <div style={{ fontSize: 11, color: muted }}>teto {d.teto ?? 4} por dia</div>
                </div>
                {exp && <div style={sep}>
                    <div style={lbl}>Experimento {exp.id}</div>
                    <div style={big}>{fase ? fase.fase : "fora das fases"}</div>
                    <div style={{ fontSize: 11, color: fase?.intervencao ? green : muted }}>{fase ? (fase.intervencao ? "intervenção ligada" : "sem intervenção") : ""}</div>
                </div>}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(12, minmax(0, 1fr))", columnGap: 24 }}>
                <div style={{ gridColumn: "span 12" }} className="sec-col-7">
                    <h3 style={h3}>Semana</h3>
                    <semanaMod.Semana embutido />
                </div>
                <div style={{ gridColumn: "span 12" }} className="sec-col-5">
                    <h3 style={h3}>Hoje</h3>
                    <div style={lbl}>Capturas</div>
                    {(d.capturas || []).length ? (d.capturas || []).map(c => (
                        <div key={c.n} style={{ fontSize: 13, padding: "4px 0", borderBottom: `1px solid ${alpha(primary, 0.1)}` }}><b style={{ fontVariantNumeric: "tabular-nums" }}>{c.n})</b> {c.texto}</div>
                    )) : <div style={{ fontSize: 13, color: muted, fontStyle: "italic", padding: "4px 0" }}>nada para triar</div>}
                    <div style={{ ...lbl, marginTop: 14 }}>Lembretes</div>
                    {(d.lembretes || []).length ? (d.lembretes || []).map((l, i) => (
                        <div key={i} style={{ fontSize: 13, padding: "4px 0", borderBottom: `1px solid ${alpha(primary, 0.1)}` }}><span style={{ fontVariantNumeric: "tabular-nums", color: muted }}>{ddmm(l.quando)} {hhmm(l.quando)}</span> {l.texto}</div>
                    )) : <div style={{ fontSize: 13, color: muted, fontStyle: "italic", padding: "4px 0" }}>nenhum agendado</div>}
                    {d.ultimo_ritual && <>
                        <div style={{ ...lbl, marginTop: 14 }}>Última mensagem proativa ({d.ultimo_ritual.tipo}, {ddmm(d.ultimo_ritual.quando)} {hhmm(d.ultimo_ritual.quando)})</div>
                        <div style={{ fontSize: 13, whiteSpace: "pre-wrap", padding: "4px 0" }}>{d.ultimo_ritual.texto}</div>
                    </>}
                </div>

                {exp && <div style={{ gridColumn: "span 12" }} className="sec-col-7">
                    <h3 style={h3}>{exp.id}: última atividade por dia</h3>
                    <div style={{ overflowX: "auto" }}><GraficoE1 exp={exp} theme={theme} /></div>
                    <div style={{ fontSize: 11, color: muted, marginTop: 6 }}>Linha forte em 00:00; ponto em destaque passou da meia-noite. Tracejado é a mediana da fase. Dia lógico das 05:00 às 05:00.</div>
                </div>}
                <div style={{ gridColumn: "span 12" }} className="sec-col-5">
                    <h3 style={h3}>Rituais</h3>
                    <table className="semana-tabela" style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead><tr style={{ color: muted, fontSize: 11, textTransform: "uppercase" }}>
                            <th style={cell}>Job</th><th style={cell}>Último</th><th style={cell}>Próximo</th>
                        </tr></thead>
                        <tbody>{(d.jobs || []).map(j => (
                            <tr key={j.nome} style={{ borderTop: `1px solid ${alpha(primary, 0.1)}`, opacity: j.ligado ? 1 : 0.5 }}>
                                <td style={cell}>{j.nome.replace("secretaria-", "")}</td>
                                <td style={{ ...cell, color: j.status && j.status !== "ok" ? warn : undefined }}>{j.ultimo ? `${ddmm(j.ultimo)} ${hhmm(j.ultimo)}` : "ainda não"}{j.status && j.status !== "ok" ? ` (${j.status})` : ""}</td>
                                <td style={cell}>{j.proximo ? `${ddmm(j.proximo)} ${hhmm(j.proximo)}` : ""}</td>
                            </tr>
                        ))}</tbody>
                    </table>
                </div>

                <div style={{ gridColumn: "span 12" }}>
                    <h3 style={h3}>Conversa recente (Hina e Hermes)</h3>
                    {(d.conversa || []).length ? (d.conversa || []).map((l, i) => {
                        const m = l.match(/^(\d{2}:\d{2}) ([^(]+) \(([^)]+)\): (.*)$/) || [null, "", "", "", l];
                        return (
                            <div key={i} style={{ display: "flex", gap: 10, fontSize: 13, padding: "4px 0", borderBottom: `1px solid ${alpha(primary, 0.08)}` }}>
                                <span style={{ color: muted, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{m[1]}</span>
                                <span style={{ fontWeight: 700, whiteSpace: "nowrap", color: m[2].trim() === "Davi" ? undefined : primary }}>{m[2].trim()}</span>
                                <span style={{ color: muted, whiteSpace: "nowrap" }}>{m[3]}</span>
                                <span>{m[4]}</span>
                            </div>
                        );
                    }) : <div style={{ fontSize: 13, color: muted, fontStyle: "italic" }}>{dados ? "nada nas últimas 24 horas" : "lendo"}</div>}
                </div>
            </div>
            <style>{`@container (min-width: 900px) { .sec-col-7 { grid-column: span 7 !important; } .sec-col-5 { grid-column: span 5 !important; } }`}</style>
        </div>
    );
}

const Secretaria = gate(SecretariaReal);
return { Func: Secretaria, Secretaria };
