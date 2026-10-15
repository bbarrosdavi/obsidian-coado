// ═══════════════════════════════════════════════════════════════════════════════
// DC-ACADEMICO-INTEGRADO - o Academic Dashboard e as telas do Coado num painel só
//
// Tudo o que o Academic Dashboard já fazia (saudação e relógio, os quatro números,
// criação por template, prazos com conclusão, progresso por entregas, notas recentes,
// semestres ativos, embeds de calendário, disciplinas, kanban e de cada disciplina) mais
// as telas do Coado (planejamento por ciclo, revisões, estatísticas, histórico,
// registro de estudo). As peças vêm dos dois widgets originais, que continuam iguais.
//
// Pensado para o Obsidian com os painéis laterais abertos: grades que caem para uma
// coluna, seções de largura dupla que viram largura total, nada com largura mínima fixa.
//
// Criar e abrir fica no topo; os embeds abrem logo abaixo do painel e a página rola até eles.
// Na base, os mesmos embeds e a volta ao topo.
//
// Uso (nota System/Dashboards/Painel Academico.md):
//   const { PainelAcademico } = await dc.require(dc.fileLink("System/Scripts/Widgets/dc-academicoIntegrado.jsx"));
//   return <PainelAcademico />;
// ═══════════════════════════════════════════════════════════════════════════════

const { useTheme } = await dc.require(dc.fileLink("System/Scripts/Core/dc-themeProvider.jsx"));
const { gate } = await dc.require(dc.fileLink("System/Scripts/Core/dc-visibleGate.jsx"));
const { GloButton, alpha } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloButton.jsx"));
const { GloCard } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloCard.jsx"));
const { GloBadge } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloBadge.jsx"));
const { GloBar } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloBar.jsx"));
const A = await dc.require(dc.fileLink("System/Scripts/Widgets/dc-academicDashboard.jsx"));
const P = await dc.require(dc.fileLink("System/Scripts/Widgets/dc-coadoPainel.jsx"));
const C = await dc.require(dc.fileLink("System/Scripts/Core/dc-coadoCore.jsx"));

const ARQUIVO = "System/Dashboards/Painel Academico.md";
const DAY = 86400000;
// ── embed com rolagem ────────────────────────────────────────────────────────
// Só os botões de cima levam o início da nota ao topo da área visível, em
// rolagem contínua (ease-out, duração pela distância). O rodapé só abre o
// embed: ele já está logo acima. Rolagem nova cancela a anterior. Roda do
// mouse interrompe.
const raizAtual = { current: null };
let rolagemId = 0;
let seguirNota = 0;

const easeOut = (k) => 1 - Math.pow(1 - k, 3);
const esperar = (ms) => new Promise(r => setTimeout(r, ms));

function rolar(sc, alvo) {
    const id = ++rolagemId;
    const ini = sc.scrollTop, fim = Math.max(0, Math.min(alvo, sc.scrollHeight - sc.clientHeight)), dist = fim - ini;
    if (Math.abs(dist) < 2) return Promise.resolve(true);
    const dur = Math.min(1100, Math.max(450, Math.abs(dist) / 1.4)), t0 = performance.now();
    let parar = false;
    const interromper = () => { parar = true; seguirNota++; };
    sc.addEventListener("wheel", interromper, { once: true, passive: true });
    sc.addEventListener("touchstart", interromper, { once: true, passive: true });
    return new Promise(resolve => {
        const passo = (agora) => {
            if (parar || id !== rolagemId) {
                sc.removeEventListener("wheel", interromper);
                sc.removeEventListener("touchstart", interromper);
                return resolve(false);
            }
            const k = Math.min(1, (agora - t0) / dur);
            sc.scrollTop = ini + dist * easeOut(k);
            if (k < 1) requestAnimationFrame(passo);
            else {
                sc.removeEventListener("wheel", interromper);
                sc.removeEventListener("touchstart", interromper);
                resolve(true);
            }
        };
        requestAnimationFrame(passo);
    });
}

const rolador = (el) => el?.closest(".markdown-preview-view, .cm-scroller") || null;

function voltarAoTopo() {
    seguirNota++;
    const sc = rolador(raizAtual.current);
    if (sc) rolar(sc, 0);
}

function notaAberta(sc, alvo) {
    const nome = alvo.split("/").pop().replace(/\.md$/, "");
    const els = [...sc.querySelectorAll(".internal-embed")].filter(e => !raizAtual.current?.contains(e) && !e.parentElement?.closest(".internal-embed"));
    const casa = (e) => {
        const src = (e.getAttribute("src") || "").split("#")[0];
        return src === alvo || src === nome || src.endsWith("/" + nome) || src.endsWith("/" + nome + ".md") || src.endsWith(nome + ".md");
    };
    return els.find(casa) || (els.length === 1 ? els[0] : null);
}

function topoDaNota(sc, el) {
    return sc.scrollTop + el.getBoundingClientRect().top - sc.getBoundingClientRect().top;
}

async function alinharAoTopo(sc, alvo, seguir) {
    const t0 = performance.now();
    let el = null;
    while (seguir === seguirNota && performance.now() - t0 < 2000) {
        el = notaAberta(sc, alvo);
        if (el) break;
        await esperar(50);
    }
    if (!el || seguir !== seguirNota) return;
    for (let i = 0; i < 6 && seguir === seguirNota; i++) {
        if (Math.abs(el.getBoundingClientRect().top - sc.getBoundingClientRect().top) < 3) return;
        const ok = await rolar(sc, topoDaNota(sc, el));
        if (!ok || seguir !== seguirNota) return;
        if (Math.abs(el.getBoundingClientRect().top - sc.getBoundingClientRect().top) < 3) return;
        await esperar(160);
    }
}

async function embed(link, opts) {
    const f = app.vault.getAbstractFileByPath(ARQUIVO);
    const jaAberto = f && (await app.vault.read(f)).split("\n").some(l => l.trim() === link);
    const sc = rolador(raizAtual.current);
    const seguir = ++seguirNota;
    rolagemId++;
    await A.toggleEmbed(link, ARQUIVO);
    if (jaAberto || !opts?.ateOTopo || !sc || seguir !== seguirNota) return;
    await alinharAoTopo(sc, link.slice(3, -2).split("|")[0].split("#")[0], seguir);
}
const num = { fontVariantNumeric: "tabular-nums" };

// Sem a aba Edital: progresso por edital é lógica de concurso, não de universidade.
const PAGINAS = [["geral", "Visão geral"], ["planejamento", "Planejamento"], ["revisoes", "Revisões"],
    ["estatisticas", "Estatísticas"], ["historico", "Histórico"]];

// seção de largura dupla vira largura total (numa grade de uma coluna, span 2 criaria uma coluna extra)
// Visão geral em 12 colunas: cada coluna (--l) é uma pilha de seções, montada para as pilhas lado a lado
// terem alturas parecidas. Abaixo de 980 px de painel as pilhas ficam meio a meio; abaixo de 620 px, uma
// embaixo da outra. A consulta é pela largura do painel, não da janela.
const CSS = `.acad-int section[style*="span 2"]{grid-column:1 / -1 !important}
.acad-int{container-type:inline-size}
.acad-int .vg{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:22px 26px;align-items:start}
.acad-int .vg>.vg-c{grid-column:span var(--l,12);display:flex;flex-direction:column;gap:22px;min-width:0}
.acad-int .vg>.vg-c.vg-cheia{grid-column:1 / -1}
@container (max-width:980px){.acad-int .vg>.vg-c:not(.vg-cheia){grid-column:span 6}}
@container (max-width:620px){.acad-int .vg>.vg-c:not(.vg-cheia){grid-column:1 / -1}}`;

const Coluna = ({ l, children }) => <div className="vg-c" style={{ "--l": l }}>{children}</div>;
const Faixa = ({ children }) => <div className="vg-c vg-cheia">{children}</div>;

function Cabecalho({ dados }) {
    const { theme } = useTheme();
    const [agora, setAgora] = dc.useState(new Date());
    dc.useEffect(() => {
        let t;
        const tick = () => { t = setTimeout(() => { setAgora(new Date()); tick(); }, 60000 - (Date.now() % 60000)); };
        tick();
        return () => clearTimeout(t);
    }, []);
    const hoje = C.today();
    const primary = theme?.["color-primary"] || "#7c3aed";
    // Título centralizado no estilo dos H1 das notas (cor e fonte de título do tema); data à esquerda, relógio
    // à direita. Mesma altura do cabeçalho anterior.
    return (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto minmax(0, 1fr)", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <div style={{ fontSize: 12, opacity: .75, lineHeight: 1.35 }}>
                <div style={{ fontWeight: 600 }}>{C.DIAS_LONGOS[C.parseDate(hoje).getDay()]}</div>
                <div style={num}>{C.fmtDate(hoje)}</div>
            </div>
            <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".18em", color: primary, opacity: .85 }}>
                    Painel acadêmico{dados.ok ? ` · ${dados.semestre}` : ""}
                </div>
                <div style={{ fontSize: "clamp(20px, 4.5cqi, 26px)", lineHeight: 1.15, fontWeight: 800, letterSpacing: "-.01em", whiteSpace: "nowrap", fontFamily: "var(--h1-font, inherit)", color: "var(--h1-color, var(--text-normal))" }}>
                    {agora.getHours() < 12 ? "Bom dia" : "Bem-vindo de volta"}
                </div>
            </div>
            <div style={{ justifySelf: "end", fontSize: 26, fontFamily: "var(--font-monospace)", fontWeight: 700, color: primary, ...num }}>
                {`${String(agora.getHours()).padStart(2, "0")}:${String(agora.getMinutes()).padStart(2, "0")}`}
            </div>
        </div>
    );
}

function Numeros({ acad, dados }) {
    const { theme } = useTheme();
    const t = (k, d) => theme?.[k] || d;
    const primary = t("color-primary", "#7c3aed"), orange = t("color-orange", t("color-warning", "#f59e0b")), red = t("color-red", "#ef4444"), green = t("color-success", "#10b981");
    const sem = dados.ok ? C.totals(dados.studies.filter(s => s.date >= C.startOfWeek(C.today()) && s.date <= C.today())) : null;
    const revHoje = dados.ok ? dados.reviews.filter(r => r.status === "pendente" && r.dueDate <= C.today()).length : 0;
    const seq = dados.ok ? C.constancy(dados.studies).current : 0;
    const ankiHoje = Object.values(dados.anki || {}).reduce((s, x) => s + (x && typeof x === "object" ? x.para_hoje || 0 : 0), 0);
    const itens = [
        ["Disciplinas Ativas", acad.activeClasses.length, primary],
        ["Para Esta Semana", acad.upcomingItems.length, orange],
        ["Atrasados", acad.overdueItems.length, red],
        ["Média Geral", acad.average === null ? "—" : acad.average.toFixed(1), green],
        ...(dados.ok ? [
            ["Estudo na Semana", C.fmtHoras(sem.duration / 3600), primary, dados.meta.minutes ? `de ${C.fmtHoras(dados.meta.minutes / 60)}` : null],
            ["Revisões Hoje", revHoje, revHoje || ankiHoje ? orange : green, ankiHoje ? `+${ankiHoje} no Anki` : null],
            ["Sequência", seq, seq ? green : red, seq === 1 ? "dia" : "dias"],
        ] : []),
    ];
    // mesmo cartão do Academic Dashboard (GloCard elevated); o título quebra linha em vez de cortar
    return (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(112px, 1fr))", gap: 10, marginBottom: 20 }}>
            {itens.map(([rot, v, cor, sub]) => (
                <GloCard key={rot} variant="elevated" size="small" headerStyle={{ padding: "6px 8px" }} bodyStyle={{ padding: "4px 8px 8px" }}
                    title={<div style={{ textAlign: "center", width: "100%", whiteSpace: "normal", lineHeight: 1.2, fontSize: 12 }}>{rot}</div>}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: cor, textAlign: "center", lineHeight: 1.15, ...num }}>{v}</div>
                    {sub && <div style={{ fontSize: 11, textAlign: "center", opacity: .7 }}>{sub}</div>}
                </GloCard>
            ))}
        </div>
    );
}

function Prazo({ item, today, overdue, onDone }) {
    const { theme } = useTheme();
    const days = item.dueDate ? Math.round((item.dueDate - today) / DAY) : null;
    const red = theme?.["color-red"] || "#ef4444", green = theme?.["color-success"] || "#10b981";
    const when = overdue ? (days === -1 ? "atrasado 1 dia" : `atrasado ${-days} dias`) : days === 0 ? "hoje" : days === 1 ? "amanhã" : `em ${days} dias`;
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <input type="checkbox" style={{ transform: "scale(1.15)", cursor: "pointer", flexShrink: 0 }} onChange={() => { onDone?.(item.file.path); A.markDone(item.file.path); }} title="Marcar como concluído" />
            <GloCard variant={overdue ? "outlined" : "ghost"} size="small" borderColor={overdue ? alpha(red, 0.4) : undefined} clickable={true} onClick={() => embed(`![[${item.file.path}]]`)}
                style={{ flex: 1, minWidth: 0, ...(overdue ? {} : { background: "var(--background-secondary, rgba(255,255,255,0.02))" }) }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, overflowWrap: "anywhere" }}>{item.file.name}</div>
                    <div style={{ color: overdue ? red : green, fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>{when}</div>
                </div>
                <div style={{ fontSize: 11, opacity: .7 }}>{String(item.type)} · {item.dueDate ? item.dueDate.toLocaleDateString() : ""}</div>
            </GloCard>
        </div>
    );
}

const GRADE_PRAZOS = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: "8px 14px" };
const JANELA_CONCLUIDAS = 14;   // dias

// A lista cresce (atrasados sem limite + até 10 próximos): cartões em grade, crescendo em linhas, não em coluna.
// O que acabou de ser marcado sai na hora, sem esperar o índice do Datacore reler o arquivo.
function Prazos({ acad }) {
    const [feitos, setFeitos] = dc.useState(() => new Set());
    const marcar = (path) => setFeitos(prev => new Set(prev).add(path));
    const atrasados = acad.overdueItems.filter(it => !feitos.has(it.file.path));
    const proximos = acad.upcomingItems.filter(it => !feitos.has(it.file.path));
    const n = atrasados.length + proximos.length;
    return (
        <P.Secao titulo="Prazos" acoes={n ? <span style={{ fontSize: 12, opacity: .7 }}>{atrasados.length ? `${atrasados.length} atrasado${atrasados.length > 1 ? "s" : ""} · ` : ""}{proximos.length} nesta semana</span> : null}>
            {n ? (
                <div style={GRADE_PRAZOS}>
                    {atrasados.map(it => <Prazo key={it.file.path} item={it} today={acad.today} overdue onDone={marcar} />)}
                    {proximos.map(it => <Prazo key={it.file.path} item={it} today={acad.today} onDone={marcar} />)}
                </div>
            ) : <P.Vazio>Sem prazos esta semana.</P.Vazio>}
            <Concluidas acad={acad} />
        </P.Secao>
    );
}

/** Concluídas nos últimos dias, recolhida: abre pelo botão. Só o que tem completedDate: a data do arquivo
 *  não serve (a migração de 12/10 tocou todos). */
function Concluidas({ acad }) {
    const [aberta, setAberta] = dc.useState(false);
    const desde = acad.today.getTime() - JANELA_CONCLUIDAS * DAY;
    const itens = acad.coursework
        .filter(w => w.isCompleted && w.completedAt && w.completedAt.getTime() >= desde)
        .sort((a, b) => b.completedAt - a.completedAt);
    if (!itens.length) return null;
    const dia = (ms) => { const d = new Date(ms); return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`; };
    return (
        <div style={{ marginTop: 12 }}>
            <GloButton {...BTN} label={`${aberta ? "Ocultar" : "Ver"} concluídas nos últimos ${JANELA_CONCLUIDAS} dias (${itens.length})`} onClick={() => setAberta(a => !a)} />
            {aberta && (
                <div style={{ ...GRADE_PRAZOS, marginTop: 10 }}>
                    {itens.map(it => (
                        <GloCard key={it.file.path} variant="ghost" size="small" clickable={true} onClick={() => embed(`![[${it.file.path}]]`)}
                            style={{ minWidth: 0, opacity: .8, background: "var(--background-secondary, rgba(255,255,255,0.02))" }}>
                            <div style={{ fontWeight: 600, fontSize: 13, overflowWrap: "anywhere" }}>{it.file.name}</div>
                            <div style={{ fontSize: 11, opacity: .7 }}>{String(it.type)} · feita em {dia(it.completedAt.getTime())}</div>
                        </GloCard>
                    ))}
                </div>
            )}
        </div>
    );
}

/** Uma linha por disciplina: entregas (Academic Dashboard) e estudo (Coado). */
function Disciplinas({ acad, dados }) {
    const c = P.useCores();
    const { theme } = useTheme();
    const muted = theme?.["color-text-muted"] || "var(--text-muted)", primary = theme?.["color-primary"] || "#7c3aed";
    const porCod = new Map(acad.classProgress.map(x => [String(x.courseCode).toUpperCase(), x]));
    const linhas = dados.ok ? dados.discs : [];
    return (
        <P.Secao titulo="Disciplinas" span={2}>
            <div style={{ display: "grid", gap: 2 }}>
                {linhas.map(d => {
                    const pr = porCod.get(d.cod), t = C.totals(dados.studies.filter(s => s.subjectId === d.id));
                    return (
                        <div key={d.id} style={{ padding: "7px 0", borderTop: `1px solid ${c.line}` }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 13 }}>
                                <P.Ponto cor={d.cor} />
                                <span style={{ fontWeight: 600, cursor: "pointer" }} onClick={() => embed(`![[${d.path}]]`)} title="Abrir a disciplina abaixo do painel">{d.cod}</span>
                                <span style={{ flex: 1, minWidth: 120, overflowWrap: "anywhere", color: muted, fontSize: 12 }}>{d.titulo}</span>
                                {pr?.overdue > 0 && <GloBadge size="small" variant="soft" status="error">{pr.overdue} atrasado{pr.overdue > 1 ? "s" : ""}</GloBadge>}
                                <span style={{ fontSize: 12, ...num, opacity: .85 }} title="Tempo de estudo registrado">{C.fmtDuration(t.duration)}</span>
                                {t.questions > 0 && <span style={{ fontSize: 12, ...num }}><b style={{ color: c.ok }}>{t.hits}</b>/<b style={{ color: c.bad }}>{t.misses}</b> · {t.performance}%</span>}
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "4px 14px", marginTop: 5 }}>
                                <div style={{ fontSize: 11, opacity: .8 }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}><span>Entregas</span><span style={num}>{pr ? `${pr.completed}/${pr.total} · ${pr.percent}%` : "–"}</span></div>
                                    <P.Barra valor={pr?.percent || 0} cor={primary} altura={6} />
                                </div>
                            </div>
                        </div>
                    );
                })}
                {!linhas.length && <P.Vazio>Nenhuma disciplina no semestre ativo.</P.Vazio>}
            </div>
        </P.Secao>
    );
}

function NotasRecentes({ acad }) {
    const { theme } = useTheme();
    const green = theme?.["color-success"] || "#10b981";
    return (
        <P.Secao titulo="Notas recentes">
            {acad.recentGrades.length ? acad.recentGrades.map(g => (
                <GloCard key={g.file.path} variant="ghost" size="small" clickable={true} onClick={() => embed(`![[${g.file.path}]]`)} style={{ marginBottom: 6, background: "var(--background-secondary, rgba(255,255,255,0.02))" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, fontSize: 13 }}>
                        <span style={{ overflowWrap: "anywhere" }}>{g.file.name}</span>
                        <span style={{ fontWeight: 700, color: green }}>{String(g.grade)}</span>
                    </div>
                </GloCard>
            )) : <P.Vazio>Sem notas ainda.</P.Vazio>}
        </P.Secao>
    );
}

function Semestres({ acad }) {
    const { theme } = useTheme();
    const primary = theme?.["color-primary"] || "#7c3aed", green = theme?.["color-success"] || "#10b981";
    const fmt = (d) => d ? `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}` : "";
    return (
        <P.Secao titulo="Semestres ativos">
            {acad.activeTerms.length ? acad.activeTerms.map((term, i) => {
                const linked = acad.termClassMap[term.file.path] || [];
                return (
                    <GloCard key={i} variant="ghost" size="small" clickable={true} onClick={() => embed(`![[${term.file.path}]]`)} style={{ marginBottom: 8, background: "var(--background-secondary, rgba(255,255,255,0.02))" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                            <div style={{ fontWeight: 600, fontSize: 14 }}>{term.file.name}</div>
                            {term.isCurrent && <span style={{ background: green, color: "var(--text-on-accent)", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10 }}>ATUAL</span>}
                        </div>
                        <div style={{ fontSize: 12, opacity: .7, marginBottom: 6 }}>{fmt(term.startDate)} a {fmt(term.endDate)}</div>
                        {linked.length > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {linked.map((c, j) => <span key={j} onClick={(e) => { e.stopPropagation(); embed(`![[${c.file.path}]]`); }} style={{ background: alpha(primary, 0.13), color: primary, fontSize: 11, padding: "3px 8px", borderRadius: 8, cursor: "pointer" }}>{String(c.courseCode || c.file.name)}</span>)}
                        </div>}
                    </GloCard>
                );
            }) : <P.Vazio>Nenhum semestre ativo.</P.Vazio>}
        </P.Secao>
    );
}

const BTN = P.BTN;   // padrão da vault: liquid-glass, small, sem brilho
const LINHA = { display: "flex", flexWrap: "wrap", gap: 6 };
const ROTULO = { fontSize: 11, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", opacity: .7, marginBottom: 6 };
const GRUPOS = { display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: "14px 36px" };

function Grupo({ titulo, children }) {
    return (
        <div style={{ minWidth: 0, maxWidth: "100%" }}>
            <div style={ROTULO}>{titulo}</div>
            <div style={LINHA}>{children}</div>
        </div>
    );
}

const Visoes = ({ ateOTopo }) => (
    <Grupo titulo="Visões">
        <GloButton {...BTN} label="Calendário" onClick={() => embed("![[System/TaskNotes/Views/calendar-default.base]]", ateOTopo && { ateOTopo: true })} />
        <GloButton {...BTN} label="Todas as disciplinas" onClick={() => embed("![[Disciplinas.base]]", ateOTopo && { ateOTopo: true })} />
        <GloButton {...BTN} label="Kanban" onClick={() => embed("![[System/TaskNotes/Views/kanban-academico.base#Kanban Acadêmico]]", ateOTopo && { ateOTopo: true })} />
    </Grupo>
);

/** Rótulo do botão: curto o bastante para identificar, sem o título oficial. */
function nomeCurto(nome) {
    const s = nome.replace(/[,_]/g, " ").replace(/\s+/g, " ").trim();
    if (/\bTCC\b/.test(s)) return "TCC";
    const num = s.match(/\b([IVX]+|\d+)$/);
    if (/^oficina\b/i.test(s)) return num ? `Oficina ${num[1]}` : "Oficina";
    let t = s.replace(/^(fundamentos|introdução|introducao|análise|analise|metodologia|gerência|gerencia)\b(\s+(de|da|do|das|dos|ao|à|a))?/i, "").trim();
    t = t.replace(/^(de|da|do|das|dos|aplicada|aplicado)\s+(ao|à|a|de|da|do)?\s*/i, "").trim();
    const words = t.split(" ").filter(w => w && !/^(de|da|do|das|dos|e|a|o|ao|à|em|para)$/i.test(w));
    if (!words.length) return s.split(" ")[0];
    const par = words.slice(0, 2).join(" ");
    return par.length <= 18 ? par : words[0];
}

const DisciplinasBotoes = ({ acad, ateOTopo }) => (
    <Grupo titulo="Disciplinas">
        {acad.activeClasses.length ? acad.activeClasses.map((c, i) => {
            const cod = String(c.courseCode || c.file.name);
            const nome = String(c.courseName || "").trim();
            const curto = nome ? nomeCurto(nome) : "";
            return (
                <GloButton key={i} {...BTN}
                    label={(
                        <span style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1, lineHeight: 1.15 }}>
                            <span style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{cod}</span>
                            {curto ? <span title={nome} style={{ fontSize: 9, fontWeight: 400, opacity: .7, whiteSpace: "nowrap" }}>{curto}</span> : null}
                        </span>
                    )}
                    style={{ height: "auto" }}
                    onClick={() => embed(`![[${c.file.path}]]`, ateOTopo && { ateOTopo: true })} />
            );
        }) : <span style={{ fontSize: 13, opacity: .7, fontStyle: "italic" }}>Nenhuma disciplina ativa.</span>}
    </Grupo>
);

/** Topo: criar por template e abrir visões e disciplinas (que rolam até o fim da página). */
function CriarEAbrir({ acad }) {
    return (
        <div style={{ ...GRUPOS, marginBottom: 20 }}>
            <Grupo titulo="Criar">
                <GloButton {...BTN} label="Nova disciplina" onClick={() => A.createNote("System/Templates/Disciplina Template.md", "Disciplina-{{DATE}}")} />
                <GloButton {...BTN} label="Novo semestre" onClick={() => A.createNote("System/Templates/Semestre Template.md", "Semestre-{{DATE}}")} />
                <GloButton {...BTN} label="Nota de aula" onClick={() => A.createNote("System/Templates/Notas de Aula Template.md", "Aula-{{DATE}}")} />
                <GloButton {...BTN} label="Novo trabalho" onClick={() => A.createNote("System/Templates/Trabalho Template.md", "Trabalho-{{DATE}}")} />
                <GloButton {...BTN} label="Novo projeto" onClick={() => A.createNote("System/Templates/Trabalho Template.md", "Projeto-{{DATE}}")} />
                <GloButton {...BTN} label="Nova nota" onClick={() => A.createNote("System/Templates/Nota Generica Template.md", "NotaGlobal")} />
            </Grupo>
            <Visoes ateOTopo />
            <DisciplinasBotoes acad={acad} ateOTopo />
        </div>
    );
}

/** Base: as mesmas visões e disciplinas, logo acima de onde abrem, e a volta ao topo. */
function Rodape({ acad }) {
    const { theme } = useTheme();
    const primary = theme?.["color-primary"] || "#7c3aed";
    return (
        <div style={{ marginTop: 26, paddingTop: 16, borderTop: `1px solid ${alpha(primary, 0.2)}`, ...GRUPOS }}>
            <Visoes />
            <DisciplinasBotoes acad={acad} />
            <div style={{ marginLeft: "auto", alignSelf: "flex-end" }}>
                <GloButton {...BTN} label="Voltar ao topo" onClick={voltarAoTopo} />
            </div>
        </div>
    );
}

// Disciplina clicada nos painéis do Coado abre embaixo do painel, como os botões de disciplina.
const abrirDisciplina = (d) => embed(`![[${d.path}]]`);

// Ordem por impacto: o hábito e as avaliações no topo; os prazos numa faixa inteira (a lista cresce);
// depois o que fazer hoje e a semana; por último o acompanhamento por disciplina e a consulta.
function VisaoGeral({ acad, dados, abrirRegistro }) {
    const ok = dados.ok;
    return (
        <div className="vg">
            <Coluna l={7}>
                {ok && <P.Constancia studies={dados.studies} destaque />}
                {ok && <P.Metas dados={dados} />}
            </Coluna>
            <Coluna l={5}>
                {ok && <P.ProximasAvaliacoes dados={dados} limite={5} />}
            </Coluna>
            <Faixa><Prazos acad={acad} /></Faixa>
            <Coluna l={7}>
                {ok && <P.ProximasSessoes dados={dados} iniciar={abrirRegistro} abrirDisciplina={abrirDisciplina} />}
                {ok && <P.EstudoSemanal studies={dados.studies} />}
            </Coluna>
            <Coluna l={5}>
                {ok && <P.RevisoesHoje dados={dados} abrirRegistro={abrirRegistro} />}
                {ok && <P.AnkiPainel dados={dados} />}
                {ok && <P.TempoPorDisciplina dados={dados} />}
            </Coluna>
            <Coluna l={7}>
                <Disciplinas acad={acad} dados={dados} />
                <NotasRecentes acad={acad} />
            </Coluna>
            <Coluna l={5}>
                {ok && <P.Historico dados={dados} limite={6} titulo="Últimos estudos" />}
                <Semestres acad={acad} />
            </Coluna>
        </div>
    );
}

function PainelAcademicoReal() {
    const acad = A.useAcademicData();
    const dados = C.useEstudo();
    const [pagina, setPagina] = dc.useState(() => { try { return localStorage.getItem("painel-academico-pagina") || "geral"; } catch { return "geral"; } });
    const [registro, setRegistro] = dc.useState(null);
    const ir = (p) => { setPagina(p); try { localStorage.setItem("painel-academico-pagina", p); } catch { } };
    const abrir = (r) => setRegistro(r || {});
    const props = { dados, abrirRegistro: abrir };
    const pg = dados.ok && PAGINAS.some(([k]) => k === pagina) ? pagina : "geral";
    // Sem cartão de fundo, como o Academic Dashboard e os outros dashboards: o painel fica direto na nota.
    return (
        <div style={{ padding: 10 }}>
          <div className="acad-int" ref={(el) => { raizAtual.current = el; }}>
            <style>{CSS}</style>
            <Cabecalho dados={dados} />
            <CriarEAbrir acad={acad} />
            <Numeros acad={acad} dados={dados} />
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
                {PAGINAS.filter(([k]) => dados.ok || k === "geral").map(([k, n]) => <GloButton key={k} {...BTN} label={n} active={pg === k} onClick={() => ir(k)} />)}
                <span style={{ flex: 1 }} />
                {dados.ok && <GloButton {...BTN} label="Registrar estudo" active={!!registro} onClick={() => setRegistro(registro ? null : {})} />}
            </div>
            {registro && dados.ok && <P.Registro key={JSON.stringify(registro)} dados={dados} rascunho={registro} fechar={() => setRegistro(null)} />}
            {pg === "geral" && <VisaoGeral acad={acad} dados={dados} abrirRegistro={abrir} />}
            {pg === "planejamento" && <P.Planejamento {...props} abrirDisciplina={abrirDisciplina} />}
            {pg === "revisoes" && <P.Revisoes {...props} />}
            {pg === "estatisticas" && <P.Estatisticas dados={dados} />}
            {pg === "historico" && <P.Historico dados={dados} />}
            <Rodape acad={acad} />
          </div>
        </div>
    );
}

const PainelAcademico = gate(PainelAcademicoReal);
return { PainelAcademico };
