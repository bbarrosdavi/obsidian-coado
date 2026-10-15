// ═══════════════════════════════════════════════════════════════════════════════
// DC-COADO-PAINEL - as telas do Coado dentro da vault, sobre os mesmos dados
//
// Início · Planejamento · Revisões · Estatísticas · Edital · Histórico, e o registro de
// estudo. Tudo lê e grava na vault (dc-coadoCore.jsx); a ponte com o Coado leva e traz.
// Gráficos em SVG próprio, cores do tema (acerto, erro, destaque) e as cores das
// disciplinas da nota de estado.
//
// Uso:
//   const { PainelEstudo } = await dc.require(dc.fileLink("System/Scripts/Widgets/dc-coadoPainel.jsx"));
//   return <PainelEstudo />;
// ═══════════════════════════════════════════════════════════════════════════════

const { useTheme } = await dc.require(dc.fileLink("System/Scripts/Core/dc-themeProvider.jsx"));
const { gate } = await dc.require(dc.fileLink("System/Scripts/Core/dc-visibleGate.jsx"));
const { GloButton, alpha } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloButton.jsx"));
const { GloBar } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloBar.jsx"));
const { GloSelect } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloSelect.jsx"));
const { GloInput } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloInput.jsx"));
const C = await dc.require(dc.fileLink("System/Scripts/Core/dc-coadoCore.jsx"));

const PAGINAS = [["inicio", "Início"], ["planejamento", "Planejamento"], ["revisoes", "Revisões"],
    ["estatisticas", "Estatísticas"], ["edital", "Edital"], ["historico", "Histórico"]];

// ───────────────────────── peças visuais ─────────────────────────
// Botões, seletores, campos e barras são os componentes Glo* no padrão da vault
// (liquid-glass, small, sem brilho), e os títulos de seção, o h3 do Academic Dashboard.

const BTN = { size: "small", variant: "liquid-glass", glow: false };

function useCores() {
    const { theme } = useTheme();
    const t = (k, d) => theme[k] || d;
    return {
        ok: t("color-success", "#10b981"), bad: t("color-error", "#ef4444"), brand: t("color-accent", "#7c3aed"),
        muted: t("color-text-muted", "var(--text-muted)"), line: t("color-border", "var(--background-modifier-border)"),
        text: t("color-text", "var(--text-normal)"),
    };
}

const rotulo = { fontSize: 11, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", opacity: .7 };
const num = { fontVariantNumeric: "tabular-nums" };

function Secao({ titulo, acoes = null, children, span = 1, style = {} }) {
    const { theme } = useTheme();
    const primary = theme?.["color-primary"] || "#7c3aed";
    return (
        <section style={{ gridColumn: `span ${span}`, minWidth: 0, ...style }}>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 8, flexWrap: "wrap",
                borderBottom: `2px solid ${alpha(primary, 0.27)}`, paddingBottom: 8, marginBottom: 12 }}>
                <h3 style={{ margin: 0 }}>{titulo}</h3>
                {acoes && <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>{acoes}</div>}
            </div>
            {children}
        </section>
    );
}

function Grade({ children, min = 300 }) {
    return <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${min}px, 1fr))`, gap: "18px 22px" }}>{children}</div>;
}

function Barra({ valor, cor = null, altura = 6 }) {
    const { theme } = useTheme();
    const c0 = cor || theme?.["color-primary"] || "#7c3aed";
    return <GloBar value={Math.max(0, Math.min(100, valor || 0))} max={100} height={`${altura}px`} fillGradient={`linear-gradient(90deg, ${c0}, ${c0}88)`}
        showSprite={false} showValue={false} borderRadius={`${Math.max(3, Math.round(altura / 2))}px`} />;
}

const Ponto = ({ cor, tam = 9 }) => <span style={{ display: "inline-block", width: tam, height: tam, borderRadius: "50%", background: cor, flex: "none" }} />;

function Botao({ children, onClick, ativo = false, titulo = null }) {
    const label = Array.isArray(children) ? children.join("") : String(children ?? "");
    const b = <GloButton {...BTN} label={label} active={ativo} onClick={onClick} />;
    return titulo ? <span title={titulo} style={{ display: "inline-flex" }}>{b}</span> : b;
}

/** Arcos de rosca a partir de [{valor, cor}]. */
function Rosca({ fatias, tamanho = 120, espessura = 14, centro = null, vazio = null }) {
    const c = useCores();
    const total = fatias.reduce((a, f) => a + f.valor, 0);
    const r = tamanho / 2 - espessura / 2, cx = tamanho / 2;
    let ang = -Math.PI / 2;
    const arcos = total ? fatias.filter(f => f.valor > 0).map((f, i) => {
        const a0 = ang, frac = f.valor / total, a1 = ang + frac * Math.PI * 2 - (fatias.length > 1 ? 0.012 : 0);
        ang += frac * Math.PI * 2;
        if (frac >= 0.9999) return <circle key={i} cx={cx} cy={cx} r={r} fill="none" stroke={f.cor} strokeWidth={espessura} />;
        const large = a1 - a0 > Math.PI ? 1 : 0;
        const p = (a) => `${cx + r * Math.cos(a)} ${cx + r * Math.sin(a)}`;
        return <path key={i} d={`M ${p(a0)} A ${r} ${r} 0 ${large} 1 ${p(a1)}`} fill="none" stroke={f.cor} strokeWidth={espessura} />;
    }) : [<circle key="v" cx={cx} cy={cx} r={r} fill="none" stroke={`color-mix(in srgb, ${c.muted} 20%, transparent)`} strokeWidth={espessura} />];
    return (
        <div style={{ position: "relative", width: tamanho, height: tamanho, flex: "none" }}>
            <svg width={tamanho} height={tamanho}>{arcos}</svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
                {total ? centro : vazio}
            </div>
        </div>
    );
}

/** Colunas empilhadas: dados = [{rotulo, partes:[{v, cor}], dica}], mais linha opcional em % (0-100). */
function Colunas({ dados, altura = 170, formato = (v) => String(v), linha = null, inteiro = false }) {
    const c = useCores();
    // Desenha na largura real do contêiner, em pixels: texto e altura não crescem com a largura.
    const caixa = dc.useRef(null);
    const [W, setW] = dc.useState(640);
    dc.useEffect(() => {
        const el = caixa.current;
        if (!el) return;
        const medir = () => { const w = Math.round(el.clientWidth); if (w > 0) setW(w); };
        medir();
        const ro = new ResizeObserver(medir);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);
    const H = altura, padL = 34, padB = 20, padT = 8, padR = linha ? 30 : 6;
    const max = Math.max(1, ...dados.map(d => d.partes.reduce((a, p) => a + p.v, 0)));
    const passo = (() => { const bruto = max / 4, e = Math.pow(10, Math.floor(Math.log10(bruto))); const n = bruto / e; const p = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * e; return inteiro ? Math.max(1, Math.round(p)) : p; })();
    const topo = Math.ceil(max / passo) * passo;
    const y = (v) => padT + (H - padT - padB) * (1 - v / topo);
    const largura = (W - padL - padR) / Math.max(1, dados.length), barra = Math.min(38, largura * 0.62);
    const salto = Math.max(1, Math.ceil(dados.length / 12));
    const ticks = []; for (let v = 0; v <= topo + 1e-9; v += passo) ticks.push(v);
    const pts = linha ? dados.map((d, i) => d.linha == null ? null : [padL + largura * i + largura / 2, padT + (H - padT - padB) * (1 - d.linha / 100)]) : [];
    return (
        <div ref={caixa} style={{ width: "100%" }}>
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ display: "block", maxWidth: "100%" }}>
            {ticks.map(v => <g key={v}>
                <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke={c.line} strokeDasharray="3 3" />
                <text x={padL - 5} y={y(v) + 3.5} fontSize="10" textAnchor="end" fill={c.muted}>{formato(v)}</text>
            </g>)}
            {dados.map((d, i) => {
                let acc = 0;
                const x = padL + largura * i + (largura - barra) / 2;
                return <g key={i}>
                    <title>{d.dica || d.rotulo}</title>
                    {d.partes.map((p, j) => { const y0 = y(acc), y1 = y(acc + p.v); acc += p.v; return p.v > 0 ? <rect key={j} x={x} y={y1} width={barra} height={Math.max(0, y0 - y1)} rx={j === d.partes.length - 1 ? 4 : 0} fill={p.cor} /> : null; })}
                    {(i % salto === 0) && <text x={x + barra / 2} y={H - 6} fontSize="10" textAnchor="middle" fill={c.muted}>{d.rotulo}</text>}
                </g>;
            })}
            {linha && <>
                <polyline fill="none" stroke={linha} strokeWidth="2" points={pts.filter(Boolean).map(p => p.join(",")).join(" ")} />
                {pts.filter(Boolean).map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="2.6" fill={linha} />)}
                {[0, 50, 100].map(v => <text key={v} x={W - padR + 4} y={padT + (H - padT - padB) * (1 - v / 100) + 3.5} fontSize="10" fill={c.muted}>{v}%</text>)}
            </>}
        </svg>
        </div>
    );
}

/** Barras horizontais: dados = [{rotulo, v, cor, texto}]. */
function Horizontais({ dados }) {
    const max = Math.max(1, ...dados.map(d => d.v));
    return (
        <div style={{ display: "grid", gap: 6 }}>
            {dados.map((d, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "minmax(90px, 34%) 1fr auto", gap: 8, alignItems: "center", fontSize: 12 }}>
                    <span style={{ overflowWrap: "anywhere" }} title={d.rotulo}>{d.rotulo}</span>
                    <Barra valor={(d.v / max) * 100} cor={d.cor} altura={10} />
                    <span style={{ ...num, opacity: .8 }}>{d.texto}</span>
                </div>
            ))}
        </div>
    );
}

const Vazio = ({ children }) => <p style={{ fontSize: 13, opacity: .65, margin: "10px 0" }}>{children}</p>;

// ───────────────────────── registro de estudo ─────────────────────────

function Registro({ dados, rascunho, fechar }) {
    const c = useCores();
    const agora = new Date();
    const [f, setF] = dc.useState(() => ({
        subjectId: rascunho.subjectId || dados.discs[0]?.id || "", topicId: rascunho.topicId || "",
        categoryId: rascunho.categoryId || "teoria", date: C.today(), fim: `${C.pad(agora.getHours())}:${C.pad(agora.getMinutes())}`,
        minutos: rascunho.minutos || 50, hits: 0, misses: 0, countInPlanning: true,
        agendar: !rascunho.reviewId, intervalos: dados.intervalos, finishTopic: false,
    }));
    const set = (k, v) => setF(p => ({ ...p, [k]: v }));
    const disc = dados.porId.get(f.subjectId);
    const [salvando, setSalvando] = dc.useState(false);
    const salvar = async () => {
        if (!f.subjectId || !(+f.minutos > 0)) { new Notice("Escolha a disciplina e o tempo."); return; }
        // quem registra pensa em "terminei às": o início é o término menos a duração (como o relógio grava)
        const [y, m, dd] = f.date.split("-").map(Number), [hh, mm] = f.fim.split(":").map(Number);
        const ini = new Date(y, m - 1, dd, hh, mm - Math.round(+f.minutos));
        setSalvando(true);
        try {
            await C.registrarEstudo(dados, { subjectId: f.subjectId, topicId: f.topicId || null, categoryId: f.categoryId,
                date: C.toDateStr(ini), time: `${C.pad(ini.getHours())}:${C.pad(ini.getMinutes())}`,
                duration: Math.round(+f.minutos * 60), hits: +f.hits || 0, misses: +f.misses || 0, countInPlanning: f.countInPlanning,
                reviewIntervals: f.agendar ? f.intervalos : [], finishTopic: f.finishTopic, reviewId: rascunho.reviewId || null });
            new Notice("Estudo registrado.");
            fechar();
        } finally { setSalvando(false); }
    };
    const campo = { display: "grid", gap: 4, fontSize: 12 };
    return (
        <div style={{ padding: "12px 0 16px", borderBottom: `1px solid ${c.line}`, marginBottom: 16 }}>
            <div style={{ ...rotulo, marginBottom: 10 }}>Registrar estudo</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 10 }}>
                <div style={campo}>Disciplina
                    <GloSelect size="small" value={f.subjectId} options={dados.discs.map(d => ({ value: d.id, label: `${d.cod} ${d.titulo}` }))}
                        onChange={v => setF(p => ({ ...p, subjectId: v, topicId: "" }))} /></div>
                <div style={campo}>Tópico
                    <GloSelect size="small" searchable searchPlaceholder="Buscar tópico..." value={f.topicId}
                        options={[{ value: "", label: "sem tópico" }, ...(disc?.topicos || []).map(t => ({ value: t.id, label: `${t.aula ? `${t.aula}. ` : ""}${t.nome}` }))]}
                        onChange={v => set("topicId", v)} /></div>
                <div style={campo}>Categoria
                    <GloSelect size="small" value={f.categoryId} options={C.CATEGORIAS.map(k => ({ value: k.id, label: k.nome }))} onChange={v => set("categoryId", v)} /></div>
                <div style={campo}>Data<GloInput size="small" type="date" value={f.date} max={C.today()} onChange={v => set("date", v)} /></div>
                <div style={campo}>Terminou às<GloInput size="small" type="time" value={f.fim} onChange={v => set("fim", v)} /></div>
                <div style={campo}>Minutos<GloInput size="small" type="number" min={1} value={f.minutos} onChange={v => set("minutos", v)} /></div>
                <div style={campo}>Acertos<GloInput size="small" type="number" min={0} value={f.hits} onChange={v => set("hits", v)} /></div>
                <div style={campo}>Erros<GloInput size="small" type="number" min={0} value={f.misses} onChange={v => set("misses", v)} /></div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center", marginTop: 10, fontSize: 12 }}>
                <label><input type="checkbox" checked={f.countInPlanning} onChange={e => set("countInPlanning", e.target.checked)} /> conta no ciclo</label>
                {f.topicId && <label><input type="checkbox" checked={f.finishTopic} onChange={e => set("finishTopic", e.target.checked)} /> concluir tópico</label>}
                <label><input type="checkbox" checked={f.agendar} onChange={e => set("agendar", e.target.checked)} /> agendar revisões ({f.intervalos.join(", ")} dias)</label>
                <span style={{ flex: 1 }} />
                <Botao onClick={fechar}>Cancelar</Botao>
                <Botao ativo onClick={salvar}>{salvando ? "Salvando…" : "Salvar"}</Botao>
            </div>
        </div>
    );
}

// ───────────────────────── Início ─────────────────────────

/** destaque: sequência em número grande e dias maiores (topo do painel integrado). */
function Constancia({ studies, destaque = false }) {
    const c = useCores();
    const [offset, setOffset] = dc.useState(0);
    const ref = C.today(), k = C.constancy(studies, ref);
    const inicio = C.addDays(ref, offset * 14 - (14 - 1 - 3));
    const dias = C.dateRange(inicio, C.addDays(inicio, 13));
    const msg = k.daysSinceLast === null ? "Nenhum estudo registrado ainda."
        : k.current > 0 ? `Sequência atual: ${C.plural(k.current, "dia")}${k.daysSinceLast > 0 ? ". Estude hoje para não perder a sequência" : ""}. Recorde: ${C.plural(k.record, "dia")} seguidos.`
        : `${C.plural(k.daysSinceLast, "dia")} sem estudar. Recorde: ${C.plural(k.record, "dia")} seguidos.`;
    return (
        <Secao titulo="Constância nos estudos" span={2} acoes={<>
            <Botao onClick={() => setOffset(o => o - 1)} titulo="Período anterior">‹</Botao>
            <span style={{ fontSize: 11, ...num, opacity: .7 }}>{C.fmtDayMonth(dias[0])} ~ {C.fmtDayMonth(dias[13])}</span>
            <Botao onClick={() => setOffset(o => Math.min(0, o + 1))} titulo="Próximo período">›</Botao>
        </>}>
            {destaque && k.daysSinceLast !== null ? (
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 32, fontWeight: 800, ...num, color: k.current > 0 ? c.ok : c.bad }}>{k.current > 0 ? k.current : k.daysSinceLast}</span>
                    <span style={{ fontSize: 13 }}>
                        {k.current > 0 ? `${k.current === 1 ? "dia seguido" : "dias seguidos"}${k.daysSinceLast > 0 ? ". Estude hoje para não perder a sequência" : ""}` : `${k.daysSinceLast === 1 ? "dia" : "dias"} sem estudar`}
                        <span style={{ opacity: .65 }}> · recorde {C.plural(k.record, "dia")}</span>
                    </span>
                </div>
            ) : <p style={{ fontSize: 13, margin: "0 0 10px", color: k.current === 0 && k.daysSinceLast ? c.bad : "inherit" }}>{msg}</p>}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(14, 1fr)", gap: 5 }}>
                {dias.map(d => {
                    const estudou = k.studiedDays.has(d), futuro = d > ref, hoje = d === ref;
                    const fundo = estudou ? `color-mix(in srgb, ${c.ok} 22%, transparent)` : futuro ? `color-mix(in srgb, ${c.muted} 10%, transparent)`
                        : hoje ? "transparent" : `color-mix(in srgb, ${c.bad} 14%, transparent)`;
                    return (
                        <div key={d} title={C.fmtDate(d)} style={{ display: "grid", justifyItems: "center", gap: 3, opacity: futuro ? .45 : 1 }}>
                            <span style={{ fontSize: 9, fontWeight: 600, color: hoje ? c.brand : c.muted }}>{C.weekdayShort(d)}</span>
                            <div style={{ width: "100%", maxWidth: destaque ? 44 : 34, aspectRatio: "1", borderRadius: 8, background: fundo, display: "grid", placeItems: "center",
                                border: hoje && !estudou ? `1px dashed ${c.brand}` : "none", color: estudou ? c.ok : c.bad, fontSize: destaque ? 15 : 13, fontWeight: 700 }}>
                                {estudou ? "✓" : !futuro && !hoje ? "×" : ""}
                            </div>
                            <span style={{ fontSize: 10, ...num, opacity: .7 }}>{d.slice(8)}</span>
                        </div>
                    );
                })}
            </div>
        </Secao>
    );
}

function DataProva({ dados }) {
    const c = useCores();
    const [editando, setEditando] = dc.useState(false);
    const [valor, setValor] = dc.useState(dados.dataProva || "");
    const d = dados.dataProva;
    const dias = d ? C.diffDays(d, C.today()) : null;
    return (
        <Secao titulo="Data da prova" acoes={<Botao onClick={() => { setValor(d || ""); setEditando(!editando); }}>{d ? "editar" : "definir"}</Botao>}>
            {editando ? (
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <GloInput size="small" type="date" value={valor} onChange={setValor} style={{ width: 170 }} />
                    <Botao ativo onClick={async () => { await C.salvarDataProva(dados, valor); setEditando(false); }}>Salvar</Botao>
                    {d && <Botao onClick={async () => { await C.salvarDataProva(dados, null); setEditando(false); }}>Remover</Botao>}
                </div>
            ) : d ? (
                <div style={{ textAlign: "center", padding: "4px 0" }}>
                    {dias > 0 ? <><div style={{ fontSize: 12, opacity: .7 }}>{dias === 1 ? "falta" : "faltam"}</div>
                        <div style={{ fontSize: 40, fontWeight: 700, color: c.brand, lineHeight: 1.1, ...num }}>{dias}</div>
                        <div style={{ fontSize: 12 }}>{dias === 1 ? "dia" : "dias"}</div></>
                        : <div style={{ fontSize: 16, fontWeight: 600 }}>{dias === 0 ? "A prova é hoje" : `A prova foi há ${C.plural(-dias, "dia")}`}</div>}
                    <div style={{ fontSize: 12, opacity: .7, marginTop: 6 }}>{C.DIAS_LONGOS[C.parseDate(d).getDay()]}, {C.fmtDate(d)}</div>
                </div>
            ) : <Vazio>Defina a data da próxima prova para a contagem regressiva.</Vazio>}
        </Secao>
    );
}

/** Várias avaliações por disciplina (P1, P2, substitutiva, entregas com prazo): a próxima em destaque e a lista. */
function ProximasAvaliacoes({ dados, limite = 8 }) {
    const c = useCores();
    const lista = C.useAvaliacoes(dados);
    const [todas, setTodas] = dc.useState(false);
    const hoje = C.today();
    const futuras = lista.filter(a => a.data >= hoje);
    const prox = futuras[0];
    const mostrar = todas ? lista : futuras.slice(0, limite);
    const quando = (d) => { const n = C.diffDays(d, hoje); return n === 0 ? "hoje" : n === 1 ? "amanhã" : n < 0 ? `há ${C.plural(-n, "dia")}` : `em ${n} dias`; };
    return (
        <Secao titulo="Próximas avaliações" acoes={<Botao ativo={todas} onClick={() => setTodas(!todas)}>{todas ? "só as próximas" : `todas (${lista.length})`}</Botao>}>
            {!lista.length ? <Vazio>Nenhuma data de avaliação nas notas de disciplina (seção "Avaliações").</Vazio> : <>
                {prox && <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 32, fontWeight: 800, color: c.brand, ...num }}>{Math.max(0, C.diffDays(prox.data, hoje))}</span>
                    <span style={{ fontSize: 13 }}>{C.diffDays(prox.data, hoje) === 1 ? "dia" : "dias"} para <b>{prox.cod} {prox.nome}</b>{prox.peso ? ` (${prox.peso})` : ""}, {C.DIAS_LONGOS[C.parseDate(prox.data).getDay()].toLowerCase()} {C.fmtDayMonth(prox.data)}</span>
                </div>}
                <div style={{ display: "grid", gap: 2 }}>
                    {mostrar.map((a, i) => { const passou = a.data < hoje; return (
                        <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", padding: "5px 0", borderTop: `1px solid ${c.line}`, fontSize: 13, opacity: passou ? .5 : 1, cursor: "pointer" }}
                            onClick={(e) => C.abrirNota(a.path, e)} title={a.detalhe || undefined}>
                            <span style={{ width: 66, fontSize: 12, ...num, opacity: .8 }}>{a.ate ? "até " : ""}{C.fmtDayMonth(a.data)}</span>
                            <Ponto cor={a.cor} />
                            <span style={{ flex: 1, minWidth: 0 }}><b>{a.cod}</b> {a.nome}{a.peso ? <span style={{ opacity: .65 }}> · {a.peso}</span> : ""}
                                {a.detalhe ? <span style={{ display: "block", fontSize: 11, opacity: .6, overflowWrap: "anywhere" }}>{a.detalhe}</span> : null}</span>
                            <span style={{ fontSize: 12, ...num, color: !passou && C.diffDays(a.data, hoje) <= 7 ? c.bad : "inherit", whiteSpace: "nowrap" }}>{quando(a.data)}</span>
                        </div>); })}
                </div>
            </>}
        </Secao>
    );
}

/** Anki: resumo por baralho (lido da coleção pela ponte), revisar, abrir e sincronizar; completo = notas de cards e de resolução. */
function AnkiPainel({ dados, completo = false, span = 1 }) {
    const c = useCores();
    const a = dados.anki;
    const linhas = dados.discs.filter(d => a?.[d.cod]).map(d => ({ d, r: a[d.cod] }));
    const cel = { padding: "5px 5px", textAlign: "right", ...num, fontSize: 12 };
    const th = { ...rotulo, fontSize: 10, padding: "0 5px 6px", textAlign: "right", verticalAlign: "bottom", whiteSpace: "normal", border: "none" };
    const acoes = <><Botao onClick={() => C.abrirAnki()}>Abrir o Anki</Botao><Botao onClick={() => C.sincronizarCards()}>Sincronizar cards</Botao></>;
    return (
        <Secao titulo="Anki" span={span} acoes={acoes}>
            {!a ? <Vazio>A ponte ainda não leu a coleção do Anki.</Vazio> : !linhas.length ? <Vazio>Nenhum baralho com o código de uma disciplina do semestre.</Vazio> : (
                <div className="anki-tab" style={{ overflowX: "auto" }}>
                    {/* em coluna estreita o Revisar desce para baixo do baralho, liberando a última coluna */}
                    <style>{`.anki-tab{container-type:inline-size}.anki-tab .rev-linha{display:none}@container (max-width:420px){.anki-tab .rev-col{display:none}.anki-tab .rev-linha{display:block;margin-top:4px}}`}</style>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                        <thead><tr><th style={{ ...th, textAlign: "left", paddingLeft: 0 }}>Baralho</th><th style={th}>Cards</th><th style={th}>Novos</th><th style={th}>Para hoje</th><th style={th}>Hoje</th><th style={th}>Retenção 30d</th><th className="rev-col" style={th}></th></tr></thead>
                        <tbody>{linhas.map(({ d, r }) => (
                            <tr key={d.id} style={{ borderTop: `1px solid ${c.line}` }}>
                                <td style={{ padding: "5px 5px 5px 0" }}><span style={{ display: "flex", gap: 7, alignItems: "baseline" }}><Ponto cor={d.cor} /><span style={{ minWidth: 0 }}><b>{d.cod}</b><span style={{ display: "block", opacity: .6, fontSize: 10, overflowWrap: "anywhere" }}>{r.baralho}</span><span className="rev-linha"><Botao onClick={() => C.revisarNoAnki(r.baralho)}>Revisar</Botao></span></span></span></td>
                                <td style={cel}>{r.cards}</td><td style={cel}>{r.novos}</td>
                                <td style={{ ...cel, color: r.para_hoje ? c.bad : "inherit", fontWeight: r.para_hoje ? 700 : 400 }}>{r.para_hoje}</td>
                                <td style={cel}>{r.revisados_hoje}</td>
                                <td style={cel}>{r.revisoes_30d ? `${C.pct(r.acertos_30d, r.revisoes_30d)}%` : "–"}</td>
                                <td className="rev-col" style={{ ...cel, paddingRight: 0 }}><Botao onClick={() => C.revisarNoAnki(r.baralho)}>Revisar</Botao></td>
                            </tr>))}</tbody>
                    </table>
                    <div style={{ fontSize: 11, opacity: .55, marginTop: 6 }}>Lido da coleção às {String(a.atualizado || "").slice(11, 16)}; as sessões de revisão entram no histórico como estudo.</div>
                </div>
            )}
            {completo && dados.discs.map(d => { const n = dados.notasCards[d.id]; if (!n || (!n.cards.length && !n.resolucoes.length)) return null; return (
                <div key={d.id} style={{ marginTop: 14 }}>
                    <div style={{ ...rotulo, fontSize: 10, marginBottom: 4 }}>{d.cod} · notas de cards e de resolução</div>
                    {n.cards.map(x => { const falta = Math.max(0, x.cards - x.sincronizados); return (
                        <div key={x.path} style={{ display: "flex", gap: 8, alignItems: "center", padding: "4px 0", borderTop: `1px solid ${c.line}`, fontSize: 12 }}>
                            <a href="#" onClick={(e) => C.abrirNota(x.path, e)} style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>{x.nome}</a>
                            <span style={{ opacity: .7 }}>{C.plural(x.cards, "card")}</span>
                            {falta > 0 && <span style={{ color: c.bad, fontWeight: 600 }}>{falta} a enviar</span>}
                            <span style={{ opacity: .6, width: 80, textAlign: "right" }}>{x.status || ""}</span>
                        </div>); })}
                    {n.resolucoes.map(x => (
                        <div key={x.path} style={{ display: "flex", gap: 8, alignItems: "center", padding: "4px 0", borderTop: `1px solid ${c.line}`, fontSize: 12 }}>
                            <a href="#" onClick={(e) => C.abrirNota(x.path, e)} style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>{x.nome}</a>
                            <span style={{ opacity: .6 }}>resolução</span>
                            <span style={{ opacity: .6, width: 80, textAlign: "right" }}>{x.status || ""}</span>
                        </div>))}
                </div>); })}
        </Secao>
    );
}

function Painel({ dados }) {
    const c = useCores();
    const linhas = dados.discs.map(d => ({ d, t: C.totals(dados.studies.filter(s => s.subjectId === d.id)) }));
    const all = C.totals(dados.studies);
    const cel = { padding: "6px 6px", textAlign: "right", ...num };
    const perf = (t) => t.questions ? `${t.performance}%` : "–";
    return (
        <Secao titulo="Painel por disciplina" span={2}>
            <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
                    <thead><tr style={{ ...rotulo, fontSize: 10 }}>
                        <th style={{ textAlign: "left", padding: "0 6px 6px 0" }}>Disciplina</th><th style={cel}>Tempo</th>
                        <th style={{ ...cel, color: c.ok }}>Acertos</th><th style={{ ...cel, color: c.bad }}>Erros</th><th style={cel}>Total</th><th style={cel}>%</th>
                    </tr></thead>
                    <tbody>{linhas.map(({ d, t }) => <tr key={d.id} style={{ borderTop: `1px solid ${c.line}` }}>
                        <td style={{ padding: "6px 6px 6px 0" }}><span style={{ display: "flex", gap: 7, alignItems: "center" }}><Ponto cor={d.cor} /><a href="#" onClick={(e) => C.abrirNota(d.path, e)}>{d.cod}</a> <span style={{ opacity: .75, overflowWrap: "anywhere" }}>{d.titulo}</span></span></td>
                        <td style={cel}>{C.fmtDuration(t.duration)}</td><td style={{ ...cel, color: c.ok }}>{t.hits}</td><td style={{ ...cel, color: c.bad }}>{t.misses}</td>
                        <td style={cel}>{t.questions}</td><td style={{ ...cel, fontWeight: 600 }}>{perf(t)}</td>
                    </tr>)}</tbody>
                    <tfoot><tr style={{ borderTop: `2px solid ${c.line}`, fontWeight: 600 }}>
                        <td style={{ padding: "6px 0" }}>Total</td><td style={cel}>{C.fmtDuration(all.duration)}</td><td style={{ ...cel, color: c.ok }}>{all.hits}</td>
                        <td style={{ ...cel, color: c.bad }}>{all.misses}</td><td style={cel}>{all.questions}</td><td style={cel}>{perf(all)}</td>
                    </tr></tfoot>
                </table>
            </div>
        </Secao>
    );
}

function Metas({ dados }) {
    const c = useCores();
    const [ed, setEd] = dc.useState(false);
    const [horasTxt, setHorasTxt] = dc.useState(String(dados.meta.minutes / 60));
    const [q, setQ] = dc.useState(String(dados.meta.questions));
    const sem = C.startOfWeek(C.today());
    const t = C.totals(dados.studies.filter(s => s.date >= sem && s.date <= C.today()));
    const linha = (rot, atual, alvo, valor) => (
        <div style={{ display: "grid", gap: 4, marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span><b style={num}>{atual}</b><span style={{ opacity: .65 }}> / {alvo}</span></span><span style={{ fontSize: 11, opacity: .65 }}>{rot}</span></div>
            <Barra valor={valor} cor={valor >= 100 ? c.ok : c.brand} />
        </div>
    );
    return (
        <Secao titulo="Metas da semana" acoes={<Botao onClick={() => { setHorasTxt(String(dados.meta.minutes / 60)); setQ(String(dados.meta.questions)); setEd(!ed); }}>editar</Botao>}>
            {ed ? <div style={{ display: "flex", gap: 8, alignItems: "end", flexWrap: "wrap", fontSize: 12 }}>
                <div style={{ display: "grid", gap: 3 }}>Horas<GloInput size="small" type="number" min={0} value={horasTxt} onChange={setHorasTxt} style={{ width: 90 }} /></div>
                <div style={{ display: "grid", gap: 3 }}>Questões<GloInput size="small" type="number" min={0} value={q} onChange={setQ} style={{ width: 90 }} /></div>
                <Botao ativo onClick={async () => { await C.salvarMeta(dados, Math.round((parseFloat(String(horasTxt).replace(",", ".")) || 0) * 60), Math.round(+q || 0)); setEd(false); }}>Salvar</Botao>
            </div> : <>
                {linha("Horas de estudo", C.fmtHoras(t.duration / 3600), C.fmtHoras(dados.meta.minutes / 60), C.pct(t.duration, dados.meta.minutes * 60))}
                {linha("Questões", t.questions, dados.meta.questions, C.pct(t.questions, dados.meta.questions))}
            </>}
        </Secao>
    );
}

function RevisoesHoje({ dados, abrirRegistro }) {
    const c = useCores();
    const ref = C.today();
    const due = dados.reviews.filter(r => r.status === "pendente" && r.dueDate <= ref).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const nomeTop = (r) => dados.porId.get(r.subjectId)?.topicos.find(t => t.id === r.topicId)?.nome;
    const anki = Object.values(dados.anki || {}).filter(x => x && typeof x === "object" && x.para_hoje > 0);
    return (
        <Secao titulo="Revisões de hoje">
            {anki.map(x => (
                <div key={x.baralho} style={{ display: "flex", gap: 8, alignItems: "center", padding: "6px 0", fontSize: 13 }}>
                    <span style={{ flex: 1 }}>Anki · {x.baralho}: <b>{C.plural(x.para_hoje, "card")}</b> para hoje</span>
                    <Botao onClick={() => C.revisarNoAnki(x.baralho)}>Revisar</Botao>
                </div>))}
            {due.length === 0 ? (!anki.length && <Vazio>Nenhuma revisão para hoje.</Vazio>) : <div style={{ display: "grid", gap: 2, maxHeight: 300, overflowY: "auto" }}>
                {due.map(r => { const d = dados.porId.get(r.subjectId); return (
                    <div key={r.id} style={{ display: "flex", gap: 8, alignItems: "center", padding: "6px 0", borderTop: `1px solid ${c.line}` }}>
                        <Ponto cor={d?.cor || "#999"} />
                        <div style={{ flex: 1, minWidth: 0, fontSize: 13 }}>
                            <div>{d?.cod}{nomeTop(r) ? <span style={{ opacity: .7 }}> · {nomeTop(r)}</span> : ""}</div>
                            <div style={{ fontSize: 11, opacity: .65 }}>revisão de {C.plural(r.interval, "dia")}{r.dueDate < ref && <b style={{ color: c.bad }}> · atrasada</b>}</div>
                        </div>
                        <Botao onClick={() => abrirRegistro({ subjectId: r.subjectId, topicId: r.topicId, categoryId: "revisao", reviewId: r.id, minutos: 25 })}>Registrar</Botao>
                        <Botao onClick={() => C.statusRevisao(dados, r.id, "feita")}>Concluir</Botao>
                    </div>); })}
            </div>}
        </Secao>
    );
}

function EstudoSemanal({ studies }) {
    const c = useCores();
    const [offset, setOffset] = dc.useState(0);
    const [modo, setModo] = dc.useState("tempo");
    const ini = C.addDays(C.startOfWeek(C.today()), offset * 7), fim = C.addDays(ini, 6);
    const sem = studies.filter(s => s.date >= ini && s.date <= fim);
    const dados = C.dateRange(ini, fim).map(d => {
        const t = C.totals(sem.filter(s => s.date === d));
        return modo === "tempo" ? { rotulo: C.weekdayShort(d), partes: [{ v: t.duration / 3600, cor: c.brand }], dica: `${C.DIAS_LONGOS[C.parseDate(d).getDay()]}, ${C.fmtDayMonth(d)}: ${C.fmtDuration(t.duration)}` }
            : { rotulo: C.weekdayShort(d), partes: [{ v: t.hits, cor: c.ok }, { v: t.misses, cor: c.bad }], dica: `${C.fmtDayMonth(d)}: ${t.hits} acertos, ${t.misses} erros` };
    });
    const t = C.totals(sem);
    return (
        <Secao titulo="Estudo semanal" span={2} acoes={<>
            <Botao ativo={modo === "tempo"} onClick={() => setModo("tempo")}>Tempo</Botao>
            <Botao ativo={modo === "questoes"} onClick={() => setModo("questoes")}>Questões</Botao>
            <Botao onClick={() => setOffset(o => o - 1)} titulo="Semana anterior">‹</Botao>
            <span style={{ fontSize: 11, ...num, opacity: .7 }}>{C.fmtDayMonth(ini)} ~ {C.fmtDayMonth(fim)}</span>
            <Botao onClick={() => setOffset(o => Math.min(0, o + 1))} titulo="Próxima semana">›</Botao>
        </>}>
            <div style={{ fontSize: 12, opacity: .75, marginBottom: 4 }}>Total: <b>{modo === "tempo" ? C.fmtDuration(t.duration) : `${t.questions} questões`}</b></div>
            <Colunas dados={dados} inteiro={modo !== "tempo"} formato={(v) => modo === "tempo" ? `${Math.round(v * 10) / 10}h` : String(Math.round(v))} />
        </Secao>
    );
}

const abrirNotaDisciplina = (d, e) => C.abrirNota(d.path, e);

function ProximasSessoes({ dados, iniciar, abrirDisciplina = abrirNotaDisciplina }) {
    const c = useCores();
    const items = C.cycleProgress(dados.planning, dados.studies);
    const pendentes = items.filter(i => !i.done);
    const feitos = items.filter(i => i.done).length, prox = pendentes.slice(0, 5);
    return (
        <Secao titulo="Planejamento" acoes={pendentes.length > 1 ? <Botao titulo="Passar a primeira sessão para o fim da fila" onClick={() => C.pularSessaoCiclo(dados, pendentes[0].id)}>Pular 1ª</Botao> : null}>
            <div style={{ fontSize: 12, opacity: .7, marginBottom: 8 }}>Ciclo {dados.planning.completedCycles + 1} · {feitos} de {items.length} sessões concluídas</div>
            {prox.length === 0 ? <Vazio>Ciclo concluído. Recomece em Planejamento.</Vazio> : prox.map(it => { const d = dados.porId.get(it.subjectId); return (
                <div key={it.id} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 6, fontSize: 13, marginBottom: 3 }}>
                            <span style={{ display: "flex", gap: 6, alignItems: "center", minWidth: 0 }}><Ponto cor={d?.cor || "#999"} />{d ? <span style={{ overflowWrap: "anywhere", cursor: "pointer" }} title="Abrir a disciplina" onClick={(e) => abrirDisciplina(d, e)}>{d.cod} {d.titulo}</span> : <span>Disciplina removida</span>}</span>
                            <span style={{ fontSize: 11, ...num, opacity: .7, flex: "none" }}>{C.fmtDuration(it.studied)} / {C.fmtMinutes(it.duration)}</span>
                        </div>
                        <Barra valor={(it.studied / (it.duration * 60)) * 100} cor={d?.cor} />
                    </div>
                    {pendentes.length > 1 && <Botao titulo="Passar esta sessão para o fim da fila (não estudar agora)" onClick={() => C.pularSessaoCiclo(dados, it.id)}>↷</Botao>}
                    <Botao titulo="Registrar estudo desta sessão" onClick={() => iniciar({ subjectId: it.subjectId, minutos: Math.max(1, Math.round((it.duration * 60 - it.studied) / 60)) })}>+</Botao>
                </div>); })}
        </Secao>
    );
}

function TempoPorDisciplina({ dados }) {
    const [faixa, setFaixa] = dc.useState("semana");
    const ref = C.today();
    const de = { hoje: ref, semana: C.startOfWeek(ref), mes: C.startOfMonth(ref), total: "" }[faixa];
    const f = dados.studies.filter(s => s.date >= de && s.date <= ref);
    const linhas = dados.discs.map(d => ({ d, s: f.filter(x => x.subjectId === d.id).reduce((a, x) => a + x.duration, 0) })).filter(x => x.s > 0).sort((a, b) => b.s - a.s);
    return (
        <Secao titulo="Tempo por disciplina" acoes={[["hoje", "Hoje"], ["semana", "Semana"], ["mes", "Mês"], ["total", "Total"]].map(([k, n]) => <Botao key={k} ativo={faixa === k} onClick={() => setFaixa(k)}>{n}</Botao>)}>
            {linhas.length === 0 ? <Vazio>Nada registrado no período.</Vazio> : <Horizontais dados={linhas.map(({ d, s }) => ({ rotulo: d.cod, v: s, cor: d.cor, texto: C.fmtDuration(s) }))} />}
        </Secao>
    );
}

function Inicio({ dados, abrirRegistro }) {
    const c = useCores();
    const t = C.totals(dados.studies);
    const topicos = dados.discs.flatMap(d => d.topicos);
    const feitos = topicos.filter(x => dados.topicosConcluidos.has(x.id)).length, prog = C.pct(feitos, topicos.length);
    const grande = { fontSize: 28, fontWeight: 650, ...num, lineHeight: 1.2 };
    return (
        <Grade>
            <Secao titulo="Tempo de estudo"><div style={grande}>{C.fmtDuration(t.duration)}</div><div style={{ fontSize: 12, opacity: .7 }}>{C.plural(t.days, "dia estudado", "dias estudados")}</div></Secao>
            <Secao titulo="Desempenho">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ fontSize: 13 }}><div><b style={{ color: c.ok, ...num }}>{t.hits}</b> acertos</div><div><b style={{ color: c.bad, ...num }}>{t.misses}</b> erros</div><div style={{ fontSize: 11, opacity: .65 }}>{C.plural(t.questions, "questão", "questões")}</div></div>
                    <Rosca tamanho={86} espessura={10} fatias={[{ valor: t.hits, cor: c.ok }, { valor: t.misses, cor: c.bad }]}
                        centro={<b style={{ fontSize: 15, ...num }}>{t.performance}%</b>} vazio={<span style={{ fontSize: 11, opacity: .6 }}>sem questões</span>} />
                </div>
            </Secao>
            <Secao titulo="Progresso no edital"><div style={grande}>{prog}%</div><Barra valor={prog} /><div style={{ fontSize: 12, opacity: .7, marginTop: 6 }}>{feitos} de {C.plural(topicos.length, "tópico concluído", "tópicos concluídos")}</div></Secao>
            <Constancia studies={dados.studies} />
            <ProximasAvaliacoes dados={dados} />
            <Painel dados={dados} />
            <Metas dados={dados} />
            <RevisoesHoje dados={dados} abrirRegistro={abrirRegistro} />
            <AnkiPainel dados={dados} span={2} />
            <EstudoSemanal studies={dados.studies} />
            <ProximasSessoes dados={dados} iniciar={abrirRegistro} />
            <TempoPorDisciplina dados={dados} />
            <Historico dados={dados} limite={6} titulo="Últimos estudos" />
        </Grade>
    );
}

// ───────────────────────── Planejamento ─────────────────────────

function RoscaCiclo({ dados }) {
    const cyc = dados.planning.cycle, total = cyc.reduce((a, x) => a + x.duration, 0);
    const legenda = [...cyc.reduce((m, x) => m.set(x.subjectId, (m.get(x.subjectId) || 0) + x.duration), new Map())].sort((a, b) => b[1] - a[1]);
    return (
        <div style={{ display: "flex", gap: 22, alignItems: "center", flexWrap: "wrap" }}>
            <Rosca tamanho={190} espessura={30} fatias={cyc.map(x => ({ valor: x.duration, cor: dados.porId.get(x.subjectId)?.cor || "#999" }))}
                centro={<><span style={{ ...rotulo, fontSize: 10 }}>Total</span><b style={{ fontSize: 20, ...num }}>{C.fmtMinutes(total)}</b></>} vazio={<span>ciclo vazio</span>} />
            <div style={{ display: "grid", gap: 6, flex: 1, minWidth: 200 }}>
                {legenda.map(([id, min]) => { const d = dados.porId.get(id); return (
                    <div key={id} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
                        <Ponto cor={d?.cor || "#999"} /><span style={{ flex: 1 }}>{d?.cod}</span>
                        <span style={{ ...num, opacity: .7 }}>{C.fmtMinutes(min)}</span><b style={{ ...num, width: 38, textAlign: "right" }}>{C.pct(min, total)}%</b>
                    </div>); })}
            </div>
        </div>
    );
}

function EditorPlanejamento({ dados, fechar }) {
    const p = dados.planning;
    const [tipo, setTipo] = dc.useState(p.type);
    const [horas, setHoras] = dc.useState(String(p.config.weeklyMinutes / 60));
    const [dias, setDias] = dc.useState(p.config.days);
    const [mn, setMn] = dc.useState(p.config.minSession);
    const [mx, setMx] = dc.useState(p.config.maxSession);
    const [pesos, setPesos] = dc.useState(() => Object.fromEntries(dados.discs.map(d => {
        const s = p.config.subjects.find(x => x.subjectId === d.id); return [d.id, { importance: s?.importance ?? 1, knowledge: s?.knowledge ?? 3, on: !!s }];
    })));
    const ativos = dados.discs.filter(d => pesos[d.id].on);
    const soma = ativos.reduce((a, d) => a + C.subjectWeight(pesos[d.id].importance, pesos[d.id].knowledge), 0);
    const salvar = async () => {
        const config = { weeklyMinutes: Math.round((parseFloat(String(horas).replace(",", ".")) || 0) * 60), days: dias, minSession: +mn, maxSession: Math.max(+mn, +mx),
            subjects: ativos.map(d => ({ subjectId: d.id, importance: pesos[d.id].importance, knowledge: pesos[d.id].knowledge })) };
        await C.salvarPlanejamento(dados, { ...p, type: tipo, config, cycle: C.generateCycle(config) });
        fechar();
    };
    const opc = (de, ate) => { const o = []; for (let v = de; v <= ate; v += 15) o.push(v); return o; };
    return (
        <div style={{ display: "grid", gap: 14, fontSize: 13 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Botao ativo={tipo === "cycle"} onClick={() => setTipo("cycle")}>Ciclo de estudos (sem dias fixos)</Botao>
                <Botao ativo={tipo === "weekly"} onClick={() => setTipo("weekly")}>Planejamento semanal (por dia)</Botao>
            </div>
            <div style={{ display: "grid", gap: 6 }}>
                <span style={rotulo}>Relevância: mais importância e menos conhecimento recebem mais tempo</span>
                {dados.discs.map(d => { const w = pesos[d.id]; const share = w.on && soma ? C.subjectWeight(w.importance, w.knowledge) / soma * 100 : 0;
                    const setW = (k, v) => setPesos(o => ({ ...o, [d.id]: { ...o[d.id], [k]: v } }));
                    return (
                        <div key={d.id} style={{ display: "grid", gridTemplateColumns: "minmax(120px, 1.1fr) 1fr 1fr 52px", gap: 10, alignItems: "center", opacity: w.on ? 1 : .5 }}>
                            <label style={{ display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" checked={w.on} onChange={e => setW("on", e.target.checked)} /><Ponto cor={d.cor} />{d.cod}</label>
                            <div style={{ display: "grid", gap: 3, fontSize: 11 }}>Importância {w.importance.toFixed(1).replace(".", ",")}<GloBar value={w.importance} max={5} step={0.5} draggable showSprite={false} showValue={false} height="10px" onChange={v => setW("importance", Math.max(0.5, v))} /></div>
                            <div style={{ display: "grid", gap: 3, fontSize: 11 }}>Conhecimento {w.knowledge.toFixed(1).replace(".", ",")}<GloBar value={w.knowledge} max={5} step={0.5} draggable showSprite={false} showValue={false} height="10px" onChange={v => setW("knowledge", v)} /></div>
                            <b style={{ ...num, textAlign: "right" }}>{share.toFixed(1).replace(".", ",")}%</b>
                        </div>); })}
            </div>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "end" }}>
                <div style={{ display: "grid", gap: 3 }}>Horas por semana<GloInput size="small" type="number" min={0.5} value={horas} onChange={setHoras} style={{ width: 110 }} /></div>
                <div style={{ display: "grid", gap: 3 }}>Sessão mínima<GloSelect size="small" value={mn} options={opc(15, 180).map(v => ({ value: v, label: C.fmtMinutes(v) }))} onChange={v => setMn(+v)} style={{ width: 130 }} /></div>
                <div style={{ display: "grid", gap: 3 }}>Sessão máxima<GloSelect size="small" value={mx} options={opc(30, 240).map(v => ({ value: v, label: C.fmtMinutes(v) }))} onChange={v => setMx(+v)} style={{ width: 130 }} /></div>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{C.DIAS_LONGOS.map((n, i) => <Botao key={n} ativo={dias[i]} onClick={() => setDias(dias.map((v, j) => j === i ? !v : v))}>{n}</Botao>)}</div>
            <div style={{ display: "flex", gap: 8 }}><Botao onClick={fechar}>Cancelar</Botao><Botao ativo onClick={salvar}>Gerar ciclo e salvar</Botao></div>
        </div>
    );
}

function Planejamento({ dados, abrirRegistro, abrirDisciplina = abrirNotaDisciplina }) {
    const c = useCores();
    const [editar, setEditar] = dc.useState(false);
    const [verFeitos, setVerFeitos] = dc.useState(false);
    const [novaDisc, setNovaDisc] = dc.useState(dados.discs[0]?.id || "");
    const [novaMin, setNovaMin] = dc.useState(60);
    const p = dados.planning, items = C.cycleProgress(p, dados.studies);
    const pendentes = items.filter(i => !i.done);
    const planejado = items.reduce((a, i) => a + i.duration * 60, 0), estudado = items.reduce((a, i) => a + Math.min(i.studied, i.duration * 60), 0);
    const todos = items.length > 0 && items.every(i => i.done);
    const recomecar = () => { if (confirm("Recomeçar o ciclo? O progresso atual zera e o ciclo conta como completo.")) C.recomecarCiclo(dados); };
    const visiveis = items.map((it, i) => ({ it, pos: i + 1, idx: i })).filter(({ it }) => verFeitos || !it.done);
    const duas = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "18px 22px", marginBottom: 18 };
    return (
        <div>
          <div style={duas}>
            {todos && <Secao titulo="Ciclo concluído" style={{ gridColumn: "1 / -1" }}><div style={{ display: "flex", gap: 10, alignItems: "center" }}><span style={{ flex: 1, fontSize: 13 }}>Todas as sessões foram feitas. Recomece para uma nova volta.</span><Botao ativo onClick={recomecar}>Recomeçar ciclo</Botao></div></Secao>}
            <Secao titulo="Ciclos completos"><div style={{ fontSize: 28, fontWeight: 650, ...num }}>{p.completedCycles}</div><div style={{ fontSize: 12, opacity: .7 }}>{p.type === "cycle" ? "Ciclo de estudos" : "Planejamento semanal"} · desde {C.fmtDayMonth(p.cycleStartedAt)}</div></Secao>
            <Secao titulo="Progresso" acoes={<><Botao onClick={recomecar}>Recomeçar ciclo</Botao><Botao ativo={editar} onClick={() => setEditar(!editar)}>Replanejar</Botao></>}>
                <div style={{ fontSize: 22, fontWeight: 650, ...num }}>{C.fmtDuration(estudado)} <span style={{ fontSize: 14, opacity: .6, fontWeight: 400 }}>/ {C.fmtDuration(planejado)}</span></div>
                <Barra valor={C.pct(estudado, planejado)} /><div style={{ fontSize: 12, opacity: .7, marginTop: 5 }}>{items.filter(i => i.done).length} de {items.length} sessões concluídas · {C.pct(estudado, planejado)}%</div>
            </Secao>
          </div>
            {editar && <div style={{ marginBottom: 18 }}><Secao titulo="Replanejar"><EditorPlanejamento dados={dados} fechar={() => setEditar(false)} /></Secao></div>}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 460px), 1fr))", gap: "18px 28px", alignItems: "start" }}>
            {p.type === "cycle" ? <>
                <Secao titulo="Sequência dos estudos" acoes={<>
                    {pendentes.length > 1 && <Botao titulo="Passar a primeira sessão pendente para o fim da fila" onClick={() => C.pularSessaoCiclo(dados, pendentes[0].id)}>Pular 1ª</Botao>}
                    <Botao onClick={() => setVerFeitos(!verFeitos)}>{verFeitos ? "ocultar finalizados" : `ver finalizados (${items.filter(i => i.done).length})`}</Botao>
                </>}>
                    {visiveis.length === 0 ? <Vazio>Todas as sessões foram finalizadas.</Vazio> : visiveis.map(({ it, pos, idx }) => { const d = dados.porId.get(it.subjectId); const pr = C.pct(it.studied, it.duration * 60); return (
                        <div key={it.id} style={{ display: "flex", gap: 6, alignItems: "center", padding: "6px 0", borderTop: `1px solid ${c.line}`, opacity: it.done ? .55 : 1 }}>
                            <span style={{ width: 20, textAlign: "right", fontSize: 11, ...num, opacity: .6 }}>{pos}</span>
                            {it.done ? <span style={{ color: c.ok, fontWeight: 700, width: 9 }}>✓</span> : <Ponto cor={d?.cor || "#999"} />}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 3 }}><span style={{ textDecoration: it.done ? "line-through" : "none", cursor: d ? "pointer" : "default" }} title={d ? "Abrir a disciplina" : undefined} onClick={d ? (e) => abrirDisciplina(d, e) : undefined}>{d ? `${d.cod} ${d.titulo}` : "Disciplina removida"}</span><span style={{ fontSize: 11, ...num, opacity: .7 }}>{C.fmtDuration(it.studied)} / {C.fmtMinutes(it.duration)} · <b>{pr}%</b></span></div>
                                <Barra valor={pr} cor={d?.cor} altura={5} />
                            </div>
                            {!it.done && pendentes.length > 1 && <Botao titulo="Passar para o fim da fila" onClick={() => C.pularSessaoCiclo(dados, it.id)}>↷</Botao>}
                            <Botao titulo="Subir na fila" disabled={idx === 0} onClick={() => C.moverSessaoCiclo(dados, it.id, -1)}>↑</Botao>
                            <Botao titulo="Descer na fila" disabled={idx === items.length - 1} onClick={() => C.moverSessaoCiclo(dados, it.id, 1)}>↓</Botao>
                            <Botao titulo="Remover sessão do ciclo" onClick={() => C.removerSessaoCiclo(dados, it.id)}>×</Botao>
                            <Botao titulo="Registrar estudo" onClick={() => abrirRegistro({ subjectId: it.subjectId, minutos: Math.max(1, Math.round((it.duration * 60 - it.studied) / 60)) })}>+</Botao>
                        </div>); })}
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginTop: 10, paddingTop: 10, borderTop: `1px solid ${c.line}` }}>
                        <GloSelect size="small" value={novaDisc} options={dados.discs.map(d => ({ value: d.id, label: `${d.cod} · ${d.titulo}` }))} onChange={setNovaDisc} style={{ flex: 1, minWidth: 160 }} />
                        <GloSelect size="small" value={novaMin} options={[30, 45, 60, 75, 90, 120].map(v => ({ value: v, label: C.fmtMinutes(v) }))} onChange={v => setNovaMin(+v)} style={{ width: 95 }} />
                        <Botao onClick={() => novaDisc && C.adicionarSessaoCiclo(dados, novaDisc, novaMin)}>+ Sessão</Botao>
                    </div>
                </Secao>
                <Secao titulo="Ciclo"><RoscaCiclo dados={dados} /></Secao>
            </> : <>
                <Secao titulo="Semana" span={2}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 10 }}>
                        {C.weeklySchedule(p).map(b => { const hoje = b.day === C.parseDate(C.today()).getDay(), on = p.config.days[b.day]; const prog = new Map(items.map(i => [i.id, i])); return (
                            <div key={b.day} style={{ padding: 8, borderRadius: 10, border: `1px solid ${hoje ? c.brand : c.line}`, opacity: on ? 1 : .55 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 600, marginBottom: 6 }}><span style={{ color: hoje ? c.brand : "inherit" }}>{C.DIAS_LONGOS[b.day]}</span>{on && <span style={{ ...num, opacity: .6, fontWeight: 400 }}>{C.fmtMinutes(b.minutes)}</span>}</div>
                                {!on ? <div style={{ fontSize: 12, opacity: .6 }}>Folga</div> : b.items.map(it => { const d = dados.porId.get(it.subjectId); const feito = prog.get(it.id)?.done; return (
                                    <div key={it.id} style={{ display: "flex", gap: 5, alignItems: "center", fontSize: 12, padding: "2px 0", opacity: feito ? .55 : 1 }}><Ponto cor={d?.cor || "#999"} tam={7} /><span style={{ flex: 1, textDecoration: feito ? "line-through" : "none" }}>{d?.cod}</span><span style={{ ...num, opacity: .7 }}>{C.fmtMinutes(it.duration)}</span></div>); })}
                            </div>); })}
                    </div>
                </Secao>
                <Secao titulo="Distribuição semanal" span={2}><RoscaCiclo dados={dados} /></Secao>
            </>}
          </div>
        </div>
    );
}

// ───────────────────────── Revisões ─────────────────────────

function Revisoes({ dados, abrirRegistro }) {
    const c = useCores();
    const [aba, setAba] = dc.useState("programadas");
    const [disc, setDisc] = dc.useState("");
    const ref = C.today();
    const grupos = {
        programadas: dados.reviews.filter(r => r.status === "pendente" && r.dueDate >= ref),
        atrasadas: dados.reviews.filter(r => r.status === "pendente" && r.dueDate < ref),
        ignoradas: dados.reviews.filter(r => r.status === "ignorada"),
        concluidas: dados.reviews.filter(r => r.status === "feita"),
    };
    const lista = grupos[aba].filter(r => !disc || r.subjectId === disc).sort((a, b) => aba === "programadas" ? a.dueDate.localeCompare(b.dueDate) : b.dueDate.localeCompare(a.dueDate));
    const porDia = lista.reduce((acc, r) => { const g = acc[acc.length - 1]; if (g?.data === r.dueDate) g.itens.push(r); else acc.push({ data: r.dueDate, itens: [r] }); return acc; }, []);
    const nomeDia = (d) => d === ref ? "Hoje" : d === C.addDays(ref, 1) ? "Amanhã" : d === C.addDays(ref, -1) ? "Ontem" : `${C.fmtDate(d)} · ${C.DIAS_LONGOS[C.parseDate(d).getDay()]}`;
    return (
        <div>
            <div style={{ marginBottom: 18 }}><AnkiPainel dados={dados} completo /></div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
                {[["programadas", "Programadas"], ["atrasadas", "Atrasadas"], ["ignoradas", "Ignoradas"], ["concluidas", "Concluídas"]].map(([k, n]) =>
                    <Botao key={k} ativo={aba === k} onClick={() => setAba(k)}>{n} ({grupos[k].length})</Botao>)}
                <span style={{ flex: 1 }} />
                <GloSelect size="small" value={disc} options={[{ value: "", label: "Todas as disciplinas" }, ...dados.discs.map(d => ({ value: d.id, label: d.cod }))]} onChange={setDisc} style={{ width: 200 }} />
            </div>
            {porDia.length === 0 ? <Vazio>Nenhuma revisão aqui.</Vazio> : porDia.map(g => (
                <div key={g.data} style={{ marginBottom: 12 }}>
                    <div style={{ ...rotulo, fontSize: 10, color: g.data < ref && aba === "atrasadas" ? c.bad : "inherit" }}>{nomeDia(g.data)}</div>
                    {g.itens.map(r => { const d = dados.porId.get(r.subjectId); const top = d?.topicos.find(t => t.id === r.topicId); return (
                        <div key={r.id} style={{ display: "flex", gap: 8, alignItems: "center", padding: "6px 0", borderTop: `1px solid ${c.line}`, fontSize: 13 }}>
                            <Ponto cor={d?.cor || "#999"} />
                            <span style={{ flex: 1, minWidth: 0 }}>{d?.cod}{top ? <span style={{ opacity: .7 }}> · {top.nome}</span> : ""} <span style={{ fontSize: 11, opacity: .6 }}>· {r.interval === 1 ? "24h" : `${r.interval} dias`}</span></span>
                            {r.status === "pendente" ? <>
                                <Botao onClick={() => abrirRegistro({ subjectId: r.subjectId, topicId: r.topicId, categoryId: "revisao", reviewId: r.id, minutos: 25 })}>Registrar</Botao>
                                <Botao onClick={() => C.statusRevisao(dados, r.id, "feita")}>Concluir</Botao>
                                <Botao onClick={() => C.statusRevisao(dados, r.id, "ignorada")}>Ignorar</Botao>
                            </> : <Botao onClick={() => C.statusRevisao(dados, r.id, "pendente")}>Reabrir</Botao>}
                        </div>); })}
                </div>))}
        </div>
    );
}

// ───────────────────────── Estatísticas ─────────────────────────

function Estatisticas({ dados }) {
    const c = useCores();
    const [periodo, setPeriodo] = dc.useState(30);
    const [disc, setDisc] = dc.useState("");
    const ref = C.today(), de = periodo ? C.addDays(ref, -(periodo - 1)) : (dados.studies[dados.studies.length - 1]?.date || ref);
    const f = dados.studies.filter(s => s.date >= de && s.date <= ref && (!disc || s.subjectId === disc));
    const t = C.totals(f);
    const dias = C.dateRange(de, ref);
    const semanal = dias.length > 45;
    const baldes = semanal ? [...new Set(dias.map(C.startOfWeek))] : dias;
    const evol = baldes.map(b => { const fim = semanal ? C.addDays(b, 6) : b; const x = C.totals(f.filter(s => s.date >= b && s.date <= fim)); return { b, x }; });
    const topicos = dados.discs.flatMap(d => d.topicos), feitos = topicos.filter(x => dados.topicosConcluidos.has(x.id)).length;
    const estudados = new Set(f.map(s => s.date)).size;
    const porDisc = dados.discs.map(d => ({ d, x: C.totals(f.filter(s => s.subjectId === d.id)) })).filter(r => r.x.duration > 0);
    const porCat = C.CATEGORIAS.map(k => ({ k, s: f.filter(s => s.categoryId === k.id).reduce((a, s) => a + s.duration, 0) })).filter(r => r.s > 0);
    const stat = (rot, v) => <div style={{ minWidth: 120 }}><div style={rotulo}>{rot}</div><div style={{ fontSize: 22, fontWeight: 650, ...num }}>{v}</div></div>;
    return (
        <div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
                {[[7, "7 dias"], [30, "30 dias"], [90, "90 dias"], [0, "Tudo"]].map(([k, n]) => <Botao key={k} ativo={periodo === k} onClick={() => setPeriodo(k)}>{n}</Botao>)}
                <span style={{ flex: 1 }} />
                <GloSelect size="small" value={disc} options={[{ value: "", label: "Todas as disciplinas" }, ...dados.discs.map(d => ({ value: d.id, label: d.cod }))]} onChange={setDisc} style={{ width: 200 }} />
            </div>
            <div style={{ display: "flex", gap: 22, flexWrap: "wrap", marginBottom: 18 }}>
                {stat("Tempo de estudo", C.fmtDuration(t.duration))}{stat("Questões", t.questions)}{stat("Desempenho", t.questions ? `${t.performance}%` : "–")}
                {stat("Constância", `${C.pct(estudados, dias.length)}%`)}{stat("Progresso no edital", `${C.pct(feitos, topicos.length)}%`)}
            </div>
            {f.length === 0 ? <Vazio>Sem estudos no período.</Vazio> : <Grade min={340}>
                <Secao titulo={`Evolução no tempo (${semanal ? "por semana" : "por dia"})`} span={2}>
                    <Colunas dados={evol.map(({ b, x }) => ({ rotulo: C.fmtDayMonth(b), partes: [{ v: x.hits, cor: c.ok }, { v: x.misses, cor: c.bad }], linha: x.questions ? x.performance : null, dica: `${C.fmtDayMonth(b)}: ${x.hits} acertos, ${x.misses} erros` }))} linha={c.brand} inteiro />
                </Secao>
                <Secao titulo={`Horas de estudo (${semanal ? "por semana" : "por dia"})`} span={2}>
                    <Colunas dados={evol.map(({ b, x }) => ({ rotulo: C.fmtDayMonth(b), partes: [{ v: x.duration / 3600, cor: c.brand }], dica: `${C.fmtDayMonth(b)}: ${C.fmtDuration(x.duration)}` }))} formato={(v) => `${Math.round(v * 10) / 10}h`} />
                </Secao>
                <Secao titulo="Disciplinas × horas"><Horizontais dados={porDisc.sort((a, b) => b.x.duration - a.x.duration).map(({ d, x }) => ({ rotulo: d.cod, v: x.duration, cor: d.cor, texto: C.fmtDuration(x.duration) }))} /></Secao>
                <Secao titulo="Categorias × horas"><Horizontais dados={porCat.map(({ k, s }) => ({ rotulo: k.nome, v: s, cor: c.brand, texto: C.fmtDuration(s) }))} /></Secao>
                <Secao titulo="Disciplinas × desempenho" span={2}>
                    {porDisc.some(r => r.x.questions) ? <Colunas dados={porDisc.map(({ d, x }) => ({ rotulo: d.cod, partes: [{ v: x.questions, cor: d.cor }], linha: x.questions ? x.performance : null, dica: `${d.cod}: ${x.questions} questões, ${x.performance}%` }))} linha={c.brand} inteiro />
                        : <Vazio>Nenhuma questão registrada no período.</Vazio>}
                </Secao>
            </Grade>}
        </div>
    );
}

// ───────────────────────── Edital ─────────────────────────

function Edital({ dados, abrirRegistro }) {
    const c = useCores();
    const [ocultar, setOcultar] = dc.useState(false);
    const topicos = dados.discs.flatMap(d => d.topicos), feitos = topicos.filter(x => dados.topicosConcluidos.has(x.id)).length;
    const porTopico = new Map();
    for (const s of dados.studies) if (s.topicId) { const x = porTopico.get(s.topicId) || { hits: 0, misses: 0, dur: 0 }; x.hits += s.hits; x.misses += s.misses; x.dur += s.duration; porTopico.set(s.topicId, x); }
    const cel = { padding: "5px 6px", textAlign: "center", ...num, fontSize: 12 };
    return (
        <div>
            <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 16 }}>
                <div style={{ flex: 1 }}><div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}><span>Progresso no edital</span><b style={num}>{feitos} / {topicos.length} · {C.pct(feitos, topicos.length)}%</b></div><Barra valor={C.pct(feitos, topicos.length)} altura={8} /></div>
                <Botao onClick={() => setOcultar(!ocultar)}>{ocultar ? "mostrar concluídos" : "ocultar concluídos"}</Botao>
            </div>
            <Grade min={420}>
                {dados.discs.map(d => { const fd = d.topicos.filter(t => dados.topicosConcluidos.has(t.id)).length; const vis = d.topicos.filter(t => !ocultar || !dados.topicosConcluidos.has(t.id)); return (
                    <Secao key={d.id} titulo={`${d.cod} ${d.titulo}`} acoes={<span style={{ fontSize: 11, ...num, opacity: .7 }}>{fd}/{d.topicos.length}</span>}>
                        <Barra valor={C.pct(fd, d.topicos.length)} cor={d.cor} altura={5} />
                        {d.natureza === "execucao" && <div style={{ fontSize: 11, opacity: .6, marginTop: 4 }}>Disciplina de execução: os itens são entregáveis.</div>}
                        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 6 }}>
                            <thead><tr style={{ ...rotulo, fontSize: 9 }}><th style={{ textAlign: "left", padding: "4px 0" }}>Tópico</th><th style={{ ...cel, color: c.ok }}>A</th><th style={{ ...cel, color: c.bad }}>E</th><th style={cel}>%</th><th style={cel}></th></tr></thead>
                            <tbody>{vis.map(t => { const fin = dados.topicosConcluidos.has(t.id), x = porTopico.get(t.id), q = x ? x.hits + x.misses : 0; return (
                                <tr key={t.id} style={{ borderTop: `1px solid ${c.line}` }}>
                                    <td style={{ padding: "5px 0", fontSize: 12 }}><label style={{ display: "flex", gap: 6, alignItems: "flex-start", cursor: "pointer" }}>
                                        <input type="checkbox" checked={fin} onChange={() => C.alternarTopico(dados, t.id)} />
                                        <span style={{ textDecoration: fin ? "line-through" : "none", opacity: fin ? .6 : 1 }}>{t.aula ? `${t.aula}. ` : ""}{t.nome}{x?.dur ? <span style={{ opacity: .55 }}> · {C.fmtDuration(x.dur)}</span> : ""}</span></label></td>
                                    <td style={{ ...cel, color: c.ok }}>{x?.hits || 0}</td><td style={{ ...cel, color: c.bad }}>{x?.misses || 0}</td>
                                    <td style={{ ...cel, fontWeight: 600 }}>{q ? `${C.pct(x.hits, q)}%` : "–"}</td>
                                    <td style={cel}><Botao titulo="Registrar estudo deste tópico" onClick={() => abrirRegistro({ subjectId: d.id, topicId: t.id })}>+</Botao></td>
                                </tr>); })}</tbody>
                        </table>
                    </Secao>); })}
            </Grade>
        </div>
    );
}

// ───────────────────────── Histórico ─────────────────────────

function Historico({ dados, limite = 0, titulo = null }) {
    const c = useCores();
    const [disc, setDisc] = dc.useState("");
    const lista = dados.studies.filter(s => !disc || s.subjectId === disc).slice(0, limite || undefined);
    const porDia = lista.reduce((acc, s) => { const g = acc[acc.length - 1]; if (g?.data === s.date) g.itens.push(s); else acc.push({ data: s.date, itens: [s] }); return acc; }, []);
    const corpo = lista.length === 0 ? <Vazio>Nenhum estudo registrado.</Vazio> : porDia.map(g => (
        <div key={g.data} style={{ marginBottom: 8 }}>
            <div style={{ ...rotulo, fontSize: 10 }}>{C.fmtDate(g.data)} · {C.DIAS_LONGOS[C.parseDate(g.data).getDay()]} · {C.fmtDuration(g.itens.reduce((a, s) => a + s.duration, 0))}</div>
            {g.itens.map(s => { const d = dados.porId.get(s.subjectId); const top = d?.topicos.find(t => t.id === s.topicId); return (
                <div key={s.id} style={{ display: "flex", gap: 8, alignItems: "center", padding: "5px 0", borderTop: `1px solid ${c.line}`, fontSize: 13 }}>
                    <span style={{ fontSize: 11, ...num, opacity: .6, width: 38 }}>{s.time}</span><Ponto cor={d?.cor || "#999"} />
                    <span style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>{d?.cod} · {C.nomeCategoria(s.categoryId)}{top ? <span style={{ opacity: .7 }}> · {top.nome}</span> : ""}</span>
                    {(s.hits || s.misses) ? <span style={{ fontSize: 11, ...num }}><b style={{ color: c.ok }}>{s.hits}</b>/<b style={{ color: c.bad }}>{s.misses}</b></span> : null}
                    <b style={{ ...num, fontSize: 12 }}>{C.fmtDuration(s.duration)}</b>
                    <a href="#" onClick={(e) => C.abrirNota(s.path, e)} style={{ fontSize: 11 }} title="Abrir a nota onde o estudo está">nota</a>
                </div>); })}
        </div>));
    if (titulo) return <Secao titulo={titulo}>{corpo}</Secao>;
    return (
        <div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
                <GloSelect size="small" value={disc} options={[{ value: "", label: "Todas as disciplinas" }, ...dados.discs.map(d => ({ value: d.id, label: d.cod }))]} onChange={setDisc} style={{ width: 200 }} />
            </div>
            {corpo}
        </div>
    );
}

// ───────────────────────── painel ─────────────────────────

function PainelEstudoReal() {
    const dados = C.useEstudo();
    const [pagina, setPagina] = dc.useState(() => { try { return localStorage.getItem("coado-painel-pagina") || "inicio"; } catch { return "inicio"; } });
    const [registro, setRegistro] = dc.useState(null);
    const ir = (p) => { setPagina(p); try { localStorage.setItem("coado-painel-pagina", p); } catch { } };
    if (!dados.ok) return <div style={{ padding: 10 }}><Vazio>Nota de estado do semestre não encontrada (System/Academico/Semestres/&lt;semestre&gt; Estudo.md).</Vazio></div>;
    const abrir = (r) => setRegistro(r || {});
    const props = { dados, abrirRegistro: abrir };
    return (
        <div style={{ padding: 10 }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
                {PAGINAS.map(([k, n]) => <GloButton key={k} {...BTN} label={n} active={pagina === k} onClick={() => ir(k)} />)}
                <span style={{ flex: 1 }} />
                <span style={{ fontSize: 11, opacity: .6 }}>Semestre {dados.semestre}</span>
                <GloButton {...BTN} label="Registrar estudo" active={!!registro} onClick={() => setRegistro(registro ? null : {})} />
            </div>
            {registro && <Registro key={JSON.stringify(registro)} dados={dados} rascunho={registro} fechar={() => setRegistro(null)} />}
            {pagina === "inicio" && <Inicio {...props} />}
            {pagina === "planejamento" && <Planejamento {...props} />}
            {pagina === "revisoes" && <Revisoes {...props} />}
            {pagina === "estatisticas" && <Estatisticas {...props} />}
            {pagina === "edital" && <Edital {...props} />}
            {pagina === "historico" && <Historico {...props} />}
        </div>
    );
}

const PainelEstudo = gate(PainelEstudoReal);

// Peças reaproveitadas pelo painel integrado (dc-academicoIntegrado.jsx).
return { PainelEstudo, BTN, useCores, rotulo, Secao, Grade, Barra, Ponto, Botao, Rosca, Vazio, Registro,
    Constancia, DataProva, ProximasAvaliacoes, AnkiPainel, Metas, RevisoesHoje, EstudoSemanal, ProximasSessoes, TempoPorDisciplina,
    Planejamento, Revisoes, Estatisticas, Edital, Historico };
