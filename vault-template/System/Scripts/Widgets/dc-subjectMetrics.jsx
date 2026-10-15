/* ==================================================================
   SUBJECT METRICS — visualizadores da disciplina (Mecha-Tutor)

   Tudo que é observável de uma matéria: cobertura do programa, mastery
   por conceito, analítica das sessões guiadas e métricas do SRS.
   Composto no `SubjectDashboard` (abas, view-switch — não colapso).

   REGRA DURA DESTE ARQUIVO — programa não é conteúdo produzido.
   `conteudo_programatico[]` (a ementa) existe desde a ingestão do plano
   de aulas, mesmo sem uma única sessão. Renderizar a ementa como se
   fosse registro faz sistema vazio parecer cheio. Então:
     · o ÍNDICE mostra só o que foi produzido (dc-subjectIndex.jsx);
     · a ementa aparece na aba "Programa", rotulada como programa, com
       o não-estudado explicitamente marcado como não-estudado;
     · toda view sem dado diz que não há dado, e o que falta para haver.

   - Usage:
       const { SubjectDashboard } = await dc.require(dc.fileLink("System/Scripts/Widgets/dc-subjectMetrics.jsx"));
       return <SubjectDashboard />;
   ================================================================== */

const { useTheme } = await dc.require(dc.fileLink("System/Scripts/Core/dc-themeProvider.jsx"));
const { GloBadge, GloBadgeGroup } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloBadge.jsx"));
const { useSubjectData, LIMIAR_CRITICO, DIAS_FRIO } = await dc.require(dc.fileLink("System/Scripts/Core/dc-subjectData.jsx"));
const { gate } = await dc.require(dc.fileLink("System/Scripts/Core/dc-visibleGate.jsx"));
const { SubjectIndex } = await dc.require(dc.fileLink("System/Scripts/Widgets/dc-subjectIndex.jsx"));
const { GloButton, alpha } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloButton.jsx"));
const { GloBar } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloBar.jsx"));
const C = await dc.require(dc.fileLink("System/Scripts/Core/dc-coadoCore.jsx"));

const abrir = (path) => { if (path) app.workspace.openLinkText(path, "", false); };
const corMastery = (theme, m) =>
    m === null || m === undefined ? (theme?.["color-text-muted"] || "var(--text-muted)")
        : m < LIMIAR_CRITICO ? (theme?.["color-error"] || "#c0392b")
            : m < 8 ? (theme?.["color-warning"] || "#d68910")
                : (theme?.["color-success"] || "#27ae60");

// ── primitivas ───────────────────────────────────────────────────────────────
function Vazio({ titulo, children }) {
    return (
        <div style={{ padding: "14px 2px", fontSize: 12.5, lineHeight: 1.65, opacity: 0.72 }}>
            {titulo && <div style={{ fontWeight: 600, marginBottom: 4, opacity: 0.9 }}>{titulo}</div>}
            {children}
        </div>
    );
}

function DistBars({ rows, emptyText = "sem dados", labelWidth = "96px" }) {
    if (!rows || !rows.length) return <div style={{ opacity: 0.5, fontSize: "0.85em" }}>{emptyText}</div>;
    const max = Math.max(1, ...rows.map(r => r.value));
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {rows.map((r, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.82em" }}>
                    <span style={{ flex: `0 0 ${labelWidth}`, textAlign: "right", opacity: 0.75, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.label}>{r.label}</span>
                    <div style={{ flex: 1, height: 10, background: "var(--background-modifier-border)", borderRadius: 5, overflow: "hidden" }}>
                        <div style={{ width: `${(r.value / max) * 100}%`, height: "100%", background: r.color, borderRadius: 5, transition: "width .35s ease" }} />
                    </div>
                    <span style={{ flex: "0 0 auto", opacity: 0.6, minWidth: 22, textAlign: "right" }}>{r.value}</span>
                </div>
            ))}
        </div>
    );
}

// Série temporal dos scores das sessões (0–10). SVG inline: sem dependência,
// acompanha o tema, e a faixa de reprovação (<6) fica marcada no fundo.
function SerieScores({ pontos, theme, altura = 96 }) {
    const accent = theme?.["color-accent"] || "var(--interactive-accent)";
    const erro = theme?.["color-error"] || "#c0392b";
    if (!pontos.length) return <div style={{ opacity: 0.5, fontSize: "0.85em" }}>Sem sessão pontuada ainda.</div>;
    const W = 100, H = 40, pad = 3;
    const n = pontos.length;
    const x = (i) => n === 1 ? W / 2 : pad + (i * (W - 2 * pad)) / (n - 1);
    const y = (v) => H - pad - (Math.max(0, Math.min(10, v)) / 10) * (H - 2 * pad);
    const linha = pontos.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(2)},${y(p.score).toFixed(2)}`).join(" ");
    return (
        <div>
            <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: altura, display: "block" }}>
                <rect x="0" y={y(LIMIAR_CRITICO)} width={W} height={H - y(LIMIAR_CRITICO)} fill={erro} opacity="0.07" />
                <line x1="0" y1={y(LIMIAR_CRITICO)} x2={W} y2={y(LIMIAR_CRITICO)} stroke={erro} strokeWidth="0.3" strokeDasharray="1.5 1.5" opacity="0.55" />
                {n > 1 && <path d={linha} fill="none" stroke={accent} strokeWidth="0.8" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />}
                {pontos.map((p, i) => (
                    <circle key={i} cx={x(i)} cy={y(p.score)} r="1.1" fill={corMastery(theme, p.score)} />
                ))}
            </svg>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, opacity: 0.55, marginTop: 2 }}>
                <span>{pontos[0].data}</span>
                <span>linha tracejada = limiar {LIMIAR_CRITICO.toFixed(1)}</span>
                <span>{pontos[n - 1].data}</span>
            </div>
        </div>
    );
}

// ── Coado: o que foi estudado nesta disciplina, venha de onde vier ───────────
// Um conceito conta como estudado com qualquer evidência: sessão guiada (de qualquer agente), estudo no
// Coado com o tópico dele, tópico concluído, ou prática/card ligado a ele. O tópico no Coado é <codigo>_<id>.
function useCoadoDaDisciplina(codigo) {
    const dados = C.useEstudo();
    const avals = C.useAvaliacoes(dados);
    return dc.useMemo(() => {
        if (!dados.ok || !codigo) return null;
        const disc = dados.discs.find(x => x.cod === codigo);
        if (!disc) return null;
        const hoje = C.today(), semana = C.startOfWeek(hoje);
        const estudos = dados.studies.filter(x => x.subjectId === disc.id)
            .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
        const porTopico = new Map();
        for (const x of estudos) if (x.topicId) porTopico.set(x.topicId, (porTopico.get(x.topicId) || 0) + x.duration);
        const revisoes = dados.reviews.filter(r => r.subjectId === disc.id && r.status === "pendente")
            .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
        return {
            disc, estudos, porTopico, concluidos: dados.topicosConcluidos,
            tot: C.totals(estudos), semana: C.totals(estudos.filter(x => x.date >= semana)),
            revisoes, revisoesHoje: revisoes.filter(r => r.dueDate <= hoje).length,
            ciclo: C.cycleProgress(dados.planning, dados.studies).filter(i => i.subjectId === disc.id && !i.done),
            provas: avals.filter(a => a.cod === codigo && a.data >= hoje),
            anki: dados.anki?.[codigo] || null,
            nomeTopico: new Map(disc.topicos.map(t => [t.id, t.nome])),
        };
    }, [dados, avals, codigo]);
}

function cobertura(d, co) {
    const pre = d.codigo ? `${d.codigo.toLowerCase()}_` : "";
    const conceitos = d.conceitos.map(k => {
        const tid = pre + k.id;
        const tempo = co?.porTopico.get(tid) || 0, concluido = !!co?.concluidos.has(tid);
        return { ...k, tempo, concluido, comEvidencia: k.estudado || tempo > 0 || concluido || k.itens.length > 0 };
    });
    const estudados = conceitos.filter(k => k.comEvidencia).length;
    return { conceitos, estudados, total: conceitos.length, pct: conceitos.length ? Math.round(100 * estudados / conceitos.length) : 0 };
}

// ── faixa de números, no padrão do ClassView ─────────────────────────────────
function FaixaNumeros({ d, co, cob, theme }) {
    const primary = theme?.["color-primary"] || "#7c3aed";
    const muted = theme?.["color-text-muted"] || "var(--text-muted)";
    const erro = theme?.["color-error"] || "#ef4444", ok = theme?.["color-success"] || "#10b981";
    const lbl = { fontSize: 10.5, textTransform: "uppercase", color: muted, fontWeight: 700, letterSpacing: ".03em" };
    const big = { fontSize: 22, fontWeight: 800, fontVariantNumeric: "tabular-nums", lineHeight: 1.2 };
    const sub = { fontSize: 11, color: muted };
    const sep = { borderLeft: `1px solid ${alpha(primary, 0.2)}`, paddingLeft: 16 };
    const prova = co?.provas?.[0], dias = prova ? C.diffDays(prova.data, C.today()) : null;
    const itens = [
        { l: "Conceitos", v: `${cob.estudados}/${cob.total}`, s: `${cob.pct}% do programa` },
        { l: "Estudo", v: co ? C.fmtDuration(co.tot.duration) : "—", s: co ? `${C.fmtDuration(co.semana.duration)} nesta semana` : "sem o Coado" },
        { l: "Questões", v: co?.tot.questions ? <><span style={{ color: ok }}>{co.tot.hits}</span>/<span style={{ color: erro }}>{co.tot.misses}</span></> : "—",
          s: co?.tot.questions ? `${co.tot.performance}% de acerto` : "nenhuma ainda" },
        { l: "Próxima avaliação", v: prova ? `${dias}d` : "—", s: prova ? `${prova.nome}${prova.peso ? ` · ${prova.peso}` : ""} · ${C.fmtDayMonth(prova.data)}` : "nenhuma marcada", cor: dias !== null && dias <= 7 ? erro : null },
        { l: "Revisões", v: co ? co.revisoesHoje : "—", s: co ? `${co.revisoes.length} pendentes` : "", cor: co?.revisoesHoje ? erro : null },
        { l: "Anki", v: co?.anki ? co.anki.para_hoje : "—", s: co?.anki ? `${co.anki.cards} cards · para hoje` : "sem baralho", cor: co?.anki?.para_hoje ? erro : null },
        { l: "Sessões", v: d.estudo.sessoes, s: d.estudo.scoreMedio === null ? "sem medição" : `score médio ${d.estudo.scoreMedio.toFixed(1)}` },
        { l: `Críticos (<${LIMIAR_CRITICO})`, v: d.cobertura.criticos, s: "domínio medido", cor: d.cobertura.criticos ? erro : null },
    ];
    return (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 16px", padding: "10px 15px", marginBottom: 12, background: alpha(primary, 0.1), borderRadius: 12, border: `1px solid ${alpha(primary, 0.2)}` }}>
            {itens.map((x, i) => (
                <div key={x.l} style={{ ...(i ? sep : {}), minWidth: 0 }}>
                    <div style={lbl}>{x.l}</div>
                    <div style={{ ...big, color: x.cor || undefined }}>{x.v}</div>
                    <div style={sub}>{x.s}</div>
                </div>
            ))}
        </div>
    );
}

// ── aba: PROGRAMA em grade (cabe numa tela) ──────────────────────────────────
function ProgramaGrade({ d, cob, theme }) {
    const muted = theme?.["color-text-muted"] || "var(--text-muted)";
    const primary = theme?.["color-primary"] || "#7c3aed";
    const ok = theme?.["color-success"] || "#10b981";
    if (!d.ementa.length) {
        return (
            <Vazio titulo="Sem programa ingerido">
                Solte o plano de ensino e o plano de aulas em <code>System/Academico/_Inbox-Tutor/</code>; a ingestão
                preenche <code>conteudo_programatico[]</code>.
            </Vazio>
        );
    }
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12 }}>
                <span style={{ opacity: .8, flex: "none" }}>{cob.total} conceitos do plano de aulas · <strong>{cob.estudados} com estudo registrado</strong></span>
                <div style={{ flex: 1 }}><GloBar value={cob.pct} max={100} height="6px" showSprite={false} showValue={false} borderRadius="3px" /></div>
                <span style={{ opacity: .6, flex: "none" }}>{cob.pct}%</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", columnGap: 18 }}>
                {cob.conceitos.map(k => (
                    <div key={k.id} onClick={() => k.sessoes.length && abrir(k.sessoes[k.sessoes.length - 1].path)}
                        title={k.comEvidencia ? undefined : "sem registro de estudo"}
                        style={{ display: "flex", alignItems: "baseline", gap: 8, padding: "3px 0", borderBottom: `1px solid ${alpha(primary, 0.08)}`,
                            cursor: k.sessoes.length ? "pointer" : "default", opacity: k.comEvidencia ? 1 : 0.5 }}>
                        <span style={{ width: 28, flex: "none", fontSize: 11, color: muted, fontVariantNumeric: "tabular-nums" }}>{k.aula !== null ? `A${String(k.aula).padStart(2, "0")}` : "—"}</span>
                        <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, overflowWrap: "anywhere" }}>{String(k.nome).replace(/\.$/, "")}</span>
                        {k.frio && <GloBadge variant="dot" status="warning" size="small">{k.idade}d</GloBadge>}
                        {k.tempo > 0 && <span style={{ fontSize: 11, color: muted, fontVariantNumeric: "tabular-nums" }}>{C.fmtDuration(k.tempo)}</span>}
                        {k.concluido && <span style={{ fontSize: 12, color: ok, fontWeight: 700 }}>✓</span>}
                        {k.mastery !== null && <span style={{ fontSize: 12, fontWeight: 700, color: corMastery(theme, k.mastery), fontVariantNumeric: "tabular-nums" }}>{k.mastery.toFixed(1)}{k.derivado ? "*" : ""}</span>}
                    </div>
                ))}
            </div>
            <div style={{ fontSize: 10.5, color: muted }}>
                Esmaecido = sem registro. Tempo vem do Coado; ✓ = tópico concluído; número = domínio 0 a 10 medido em sessão guiada
                (<code>*</code> derivado da última sessão); badge de dias = sem sessão há mais de {DIAS_FRIO} dias.
            </div>
        </div>
    );
}

// ── aba: ESTUDO (Coado) ──────────────────────────────────────────────────────
function EstudoCoado({ co, theme }) {
    const muted = theme?.["color-text-muted"] || "var(--text-muted)";
    const primary = theme?.["color-primary"] || "#7c3aed";
    const erro = theme?.["color-error"] || "#ef4444", ok = theme?.["color-success"] || "#10b981";
    if (!co) return <Vazio titulo="Sem dados do Coado">A nota de estado do semestre (<code>System/Academico/Semestres/&lt;semestre&gt; Estudo.md</code>) não lista esta disciplina.</Vazio>;
    const h5 = { fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: muted, letterSpacing: ".03em", paddingBottom: 5, marginBottom: 5, borderBottom: `1px solid ${alpha(primary, 0.2)}` };
    const linha = { display: "flex", gap: 8, alignItems: "baseline", fontSize: 12.5, padding: "2px 0" };
    const num = { fontVariantNumeric: "tabular-nums" };
    const hoje = C.today();
    return (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 18 }}>
            <div>
                <div style={h5}>Últimos estudos</div>
                {co.estudos.length ? co.estudos.slice(0, 6).map(x => (
                    <div key={x.id} style={linha}>
                        <span style={{ ...num, color: muted, fontSize: 11, width: 40, flex: "none" }}>{C.fmtDayMonth(x.date)}</span>
                        <span style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>{C.nomeCategoria(x.categoryId)}{x.topicId ? <span style={{ color: muted }}> · {co.nomeTopico.get(x.topicId) || x.topicId}</span> : ""}</span>
                        {x.hits + x.misses > 0 && <span style={{ ...num, fontSize: 11 }}><span style={{ color: ok }}>{x.hits}</span>/<span style={{ color: erro }}>{x.misses}</span></span>}
                        <span style={{ ...num, fontSize: 11, color: muted }}>{C.fmtDuration(x.duration)}</span>
                    </div>
                )) : <div style={{ fontSize: 12, opacity: .6 }}>Nenhum estudo registrado.</div>}
            </div>
            <div>
                <div style={h5}>Ciclo e revisões</div>
                <div style={linha}><span style={{ flex: 1 }}>Sessões do ciclo pendentes</span><b style={num}>{co.ciclo.length}</b><span style={{ ...num, fontSize: 11, color: muted }}>{C.fmtMinutes(co.ciclo.reduce((a, i) => a + i.duration, 0) - Math.round(co.ciclo.reduce((a, i) => a + i.studied, 0) / 60))}</span></div>
                {co.revisoes.slice(0, 4).map(r => (
                    <div key={r.id} style={linha}>
                        <span style={{ ...num, fontSize: 11, width: 40, flex: "none", color: r.dueDate <= hoje ? erro : muted }}>{C.fmtDayMonth(r.dueDate)}</span>
                        <span style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>Revisão de {r.interval} {r.interval === 1 ? "dia" : "dias"}{r.topicId ? <span style={{ color: muted }}> · {co.nomeTopico.get(r.topicId) || r.topicId}</span> : ""}</span>
                    </div>
                ))}
                {!co.revisoes.length && <div style={{ fontSize: 12, opacity: .6 }}>Nenhuma revisão pendente.</div>}
            </div>
            <div>
                <div style={h5}>Avaliações</div>
                {co.provas.length ? co.provas.slice(0, 5).map((a, i) => (
                    <div key={i} style={{ ...linha, cursor: a.path ? "pointer" : "default" }} onClick={(e) => a.path && C.abrirNota(a.path, e)}>
                        <span style={{ ...num, fontSize: 11, width: 40, flex: "none", color: muted }}>{C.fmtDayMonth(a.data)}</span>
                        <span style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>{a.nome}{a.peso ? <span style={{ color: muted }}> · {a.peso}</span> : ""}</span>
                        <span style={{ ...num, fontSize: 11, color: muted }}>{C.diffDays(a.data, hoje)}d</span>
                    </div>
                )) : <div style={{ fontSize: 12, opacity: .6 }}>Nenhuma avaliação marcada.</div>}
                {co.anki && <div style={{ ...linha, marginTop: 6 }}><span style={{ flex: 1 }}>Anki · {co.anki.baralho}</span><span style={{ ...num, fontSize: 11, color: muted }}>{co.anki.para_hoje} para hoje · {co.anki.cards} cards</span></div>}
            </div>
        </div>
    );
}

// ── faixa de números simples (abas Sessões e SRS), no padrão do ClassView ────
function FaixaSimples({ itens, theme }) {
    const primary = theme?.["color-primary"] || "#7c3aed";
    const muted = theme?.["color-text-muted"] || "var(--text-muted)";
    return (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 16px", padding: "8px 14px", background: alpha(primary, 0.1), borderRadius: 12, border: `1px solid ${alpha(primary, 0.2)}` }}>
            {itens.map((x, i) => (
                <div key={x.label} style={i ? { borderLeft: `1px solid ${alpha(primary, 0.2)}`, paddingLeft: 16 } : {}}>
                    <div style={{ fontSize: 10.5, textTransform: "uppercase", color: muted, fontWeight: 700 }}>{x.label}</div>
                    <div style={{ fontSize: 20, fontWeight: 800, fontVariantNumeric: "tabular-nums", color: x.color || undefined }}>{x.value}</div>
                    {x.sub && <div style={{ fontSize: 11, color: muted }}>{x.sub}</div>}
                </div>
            ))}
        </div>
    );
}

// ── aba: PROGRAMA (a ementa, rotulada como ementa) ───────────────────────────
function SyllabusCoverage({ d, theme }) {
    const muted = theme?.["color-text-muted"] || "var(--text-muted)";
    const accent = theme?.["color-accent"] || "var(--interactive-accent)";
    const ok = theme?.["color-success"] || "#27ae60";
    if (!d.ementa.length) {
        return (
            <Vazio titulo="Sem programa ingerido">
                Solte o plano de ensino e o plano de aulas em <code>System/Academico/_Inbox-Tutor/</code>.
                A <code>curriculum-ingestion</code> extrai os conceitos por aula e preenche
                <code> conteudo_programatico[]</code>.
            </Vazio>
        );
    }
    const c = d.cobertura;
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 5 }}>
                    <span style={{ opacity: 0.8 }}>
                        Ementa da disciplina — {c.total} conceitos do plano de aulas.
                        <strong style={{ marginLeft: 6 }}>{c.estudados} estudados</strong>, {c.total - c.estudados} sem nenhum registro.
                    </span>
                    <span style={{ opacity: 0.6 }}>{c.pct}%</span>
                </div>
                <div style={{ height: 8, background: "var(--background-modifier-border)", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ width: `${c.pct}%`, height: "100%", background: ok, borderRadius: 4, transition: "width .35s ease" }} />
                </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column" }}>
                {d.conceitos.map(k => (
                    <div key={k.id}
                        onClick={() => k.sessoes.length && abrir(k.sessoes[k.sessoes.length - 1].path)}
                        style={{
                            display: "flex", alignItems: "baseline", gap: 10, padding: "4px 0",
                            borderBottom: `1px solid ${accent}14`,
                            cursor: k.sessoes.length ? "pointer" : "default",
                            opacity: k.estudado ? 1 : 0.55,
                        }}>
                        <span style={{ minWidth: 32, fontSize: 11, color: muted, fontVariantNumeric: "tabular-nums" }}>
                            {k.aula !== null ? `A${String(k.aula).padStart(2, "0")}` : "—"}
                        </span>
                        <span style={{ flex: 1, fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={k.nome}>
                            {k.nome}
                        </span>
                        {k.frio && <GloBadge variant="dot" status="warning" size="small">{k.idade}d</GloBadge>}
                        <span style={{ fontSize: 11, color: muted, minWidth: 86, textAlign: "right" }}>
                            {k.estudado ? `${k.sessoes.length} sessão(ões)` : "não estudado"}
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: corMastery(theme, k.mastery), minWidth: 34, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                            {k.mastery === null ? "—" : k.mastery.toFixed(1)}{k.derivado ? "*" : ""}
                        </span>
                    </div>
                ))}
            </div>
            <div style={{ fontSize: 10.5, color: muted }}>
                Conceito sem registro fica esmaecido e sem nota — programa não é conteúdo produzido.
                Badge de dias = sem sessão há mais de {DIAS_FRIO} dias. <code>*</code> = mastery derivado
                da última sessão (o difficulty-indexer ainda não consolidou).
            </div>
        </div>
    );
}

// ── aba: MASTERY ─────────────────────────────────────────────────────────────
function MasteryProfile({ d, theme }) {
    const muted = theme?.["color-text-muted"] || "var(--text-muted)";
    if (!d.mastery.medidos) {
        return (
            <Vazio titulo="Nenhum conceito medido">
                Mastery vem da rubrica 0–10 aplicada ao fim de cada sessão guiada (Quiron ou outro agente).
                Nenhuma sessão foi conduzida nesta disciplina, então não há o que medir —
                nem valor derivado, nem consolidado.
            </Vazio>
        );
    }
    const cores = {
        "0–3": theme?.["color-error"] || "#c0392b",
        "3–6": theme?.["color-error"] || "#c0392b",
        "6–8": theme?.["color-warning"] || "#d68910",
        "8–10": theme?.["color-success"] || "#27ae60",
    };
    const criticos = d.conceitos.filter(c => c.critico);
    const frios = d.conceitos.filter(c => c.frio);
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
                <div style={{ fontSize: 11.5, color: muted, marginBottom: 6 }}>
                    Distribuição do mastery — {d.mastery.medidos} conceito(s) medido(s), média {d.mastery.medio.toFixed(1)}
                </div>
                <DistBars labelWidth="52px" rows={d.mastery.distribuicao.map(f => ({ label: f.faixa, value: f.n, color: cores[f.faixa] }))} />
            </div>

            <div>
                <div style={{ fontSize: 11.5, color: muted, marginBottom: 6 }}>
                    Abaixo do limiar {LIMIAR_CRITICO.toFixed(1)} — vão gerar intervenção socrática
                </div>
                {criticos.length ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        {criticos.map(c => (
                            <div key={c.id} onClick={() => c.sessoes.length && abrir(c.sessoes[c.sessoes.length - 1].path)}
                                style={{ display: "flex", gap: 8, fontSize: 12.5, padding: "3px 8px", borderRadius: 5, cursor: "pointer", background: "var(--background-modifier-hover, rgba(0,0,0,0.04))" }}>
                                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.nome}</span>
                                <span style={{ fontWeight: 700, color: corMastery(theme, c.mastery) }}>{c.mastery.toFixed(1)}</span>
                            </div>
                        ))}
                    </div>
                ) : <div style={{ fontSize: 12, opacity: 0.6 }}>Nenhum conceito medido abaixo do limiar.</div>}
            </div>

            <div>
                <div style={{ fontSize: 11.5, color: muted, marginBottom: 6 }}>
                    Esfriando — estudados, sem sessão há mais de {DIAS_FRIO} dias
                </div>
                {frios.length ? (
                    <GloBadgeGroup>
                        {frios.map(c => <GloBadge key={c.id} variant="soft" status="warning" size="small">{c.nome.slice(0, 34)} · {c.idade}d</GloBadge>)}
                    </GloBadgeGroup>
                ) : <div style={{ fontSize: 12, opacity: 0.6 }}>Nenhum conceito esfriando.</div>}
            </div>
        </div>
    );
}

// ── aba: SESSÕES ─────────────────────────────────────────────────────────────
function SessionAnalytics({ d, theme }) {
    const muted = theme?.["color-text-muted"] || "var(--text-muted)";
    const accent = theme?.["color-accent"] || "var(--interactive-accent)";
    const e = d.estudo;
    if (!e.sessoes) {
        return (
            <Vazio titulo="Nenhuma sessão guiada registrada">
                A sessão guiada é conduzida por um agente (o Quiron ou outro) com você e o livro na mão;
                ao fim ele grava a nota em <code>Sessoes/</code> com o score por conceito. Enquanto não
                houver a primeira, não há série, duração, modo nem desbloqueio para observar.
            </Vazio>
        );
    }
    const modos = Object.entries(e.modos).map(([label, value], i) => ({ label, value, color: accent }));
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
                <div style={{ fontSize: 11.5, color: muted, marginBottom: 6 }}>
                    Evolução do score por sessão — {e.serie.length} medição(ões)
                </div>
                <SerieScores pontos={e.serie} theme={theme} />
            </div>

            <FaixaSimples theme={theme} itens={[
                { label: "Duração média", value: e.duracaoMedia === null ? "—" : `${Math.round(e.duracaoMedia)}min`, sub: "hard-stop 90min" },
                { label: "Tempo total", value: `${Math.round(e.minutos / 60)}h` },
                { label: "Desbloqueios", value: e.desbloqueios, sub: e.sessoes ? `${Math.round(100 * e.desbloqueios / e.sessoes)}% das sessões` : "" },
            ]} />

            <div>
                <div style={{ fontSize: 11.5, color: muted, marginBottom: 6 }}>Modo da sessão</div>
                <DistBars labelWidth="82px" rows={modos} />
            </div>

            <div>
                <div style={{ fontSize: 11.5, color: muted, marginBottom: 6 }}>Sessões</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    {d.sessoes.slice().reverse().map(s => (
                        <div key={s.path} onClick={() => abrir(s.path)}
                            style={{ display: "flex", gap: 8, alignItems: "baseline", fontSize: 12.5, padding: "3px 8px", borderRadius: 5, cursor: "pointer", background: "var(--background-modifier-hover, rgba(0,0,0,0.04))" }}>
                            <span style={{ minWidth: 74, color: muted, fontSize: 11 }}>{s.data || "—"}</span>
                            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.nome}</span>
                            {s.desbloqueio && <GloBadge variant="dot" status="info" size="small">desbloqueio</GloBadge>}
                            {s.duracao !== null && <span style={{ fontSize: 11, color: muted }}>{s.duracao}min</span>}
                            <span style={{ fontWeight: 700, color: corMastery(theme, s.score), minWidth: 30, textAlign: "right" }}>
                                {Number.isFinite(s.score) ? s.score.toFixed(1) : "—"}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ── aba: SRS ─────────────────────────────────────────────────────────────────
function SRSMetrics({ d, theme }) {
    const muted = theme?.["color-text-muted"] || "var(--text-muted)";
    const accent = theme?.["color-accent"] || "var(--interactive-accent)";
    const s = d.srs;
    if (!s.total) {
        return (
            <Vazio titulo="Nenhum card de revisão">
                Os cards nascem da skill <code>spaced-repetition</code> depois que um conceito é estudado —
                SM-2 com <code>ease</code> inicial 2.5, intervalo teto de 45 dias. Sem conceito estudado,
                não há card: nem carga, nem retenção, nem previsão.
            </Vazio>
        );
    }
    const cores = {
        vencidos: theme?.["color-error"] || "#c0392b",
        hoje: theme?.["color-warning"] || "#d68910",
        "7d": accent, "30d": accent, depois: accent,
        "sem-data": theme?.["color-text-muted"] || "#888",
    };
    const rotulos = { vencidos: "Vencidos", hoje: "Hoje", "7d": "Em 7 dias", "30d": "Em 30 dias", depois: "Depois", "sem-data": "Sem data" };
    const maxPrev = Math.max(1, ...s.previsao.map(p => p.n));
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <FaixaSimples theme={theme} itens={[
                { label: "Cards ativos", value: s.ativos, sub: `${s.total - s.ativos} concluídos` },
                { label: "Vencidos", value: s.buckets.vencidos, color: s.buckets.vencidos ? theme?.["color-error"] : null },
                { label: "Ease médio", value: s.easeMedio === null ? "—" : s.easeMedio.toFixed(2), sub: "init 2.5 · [1.3, 3.0]" },
                { label: "Maduros", value: s.maduros, sub: "3+ repetições" },
            ]} />

            <div>
                <div style={{ fontSize: 11.5, color: muted, marginBottom: 6 }}>Carga por horizonte</div>
                <DistBars labelWidth="86px"
                    rows={Object.entries(s.buckets).filter(([, v]) => v > 0).map(([k, v]) => ({ label: rotulos[k], value: v, color: cores[k] }))} />
            </div>

            <div>
                <div style={{ fontSize: 11.5, color: muted, marginBottom: 6 }}>Previsão — próximos 14 dias</div>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 56 }}>
                    {s.previsao.map(p => (
                        <div key={p.dia} title={`${p.dia}: ${p.n} card(s)`} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%" }}>
                            <div style={{ height: `${(p.n / maxPrev) * 100}%`, minHeight: p.n ? 3 : 1, background: p.n ? accent : "var(--background-modifier-border)", borderRadius: "3px 3px 0 0", transition: "height .35s ease" }} />
                        </div>
                    ))}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, opacity: 0.55, marginTop: 3 }}>
                    <span>{s.previsao[0].dia}</span><span>{s.previsao[s.previsao.length - 1].dia}</span>
                </div>
            </div>

            <div>
                <div style={{ fontSize: 11.5, color: muted, marginBottom: 6 }}>Próximos a vencer</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    {s.lista.slice(0, 12).map(c => (
                        <div key={c.path} onClick={() => abrir(c.path)}
                            style={{ display: "flex", gap: 8, alignItems: "baseline", fontSize: 12.5, padding: "3px 8px", borderRadius: 5, cursor: "pointer", background: "var(--background-modifier-hover, rgba(0,0,0,0.04))" }}>
                            <span style={{ minWidth: 74, color: muted, fontSize: 11 }}>{c.vence || "—"}</span>
                            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.concept || c.nome}</span>
                            <span style={{ fontSize: 11, color: muted }}>ease {c.ease?.toFixed(2) ?? "—"} · {c.reps ?? 0} rep</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ── dashboard ────────────────────────────────────────────────────────────────
// No padrão do ClassView: sem cartão de fundo, faixa de números rosa, abas em GloButton.
const nomeMaterial = (m) => { const [cam, alias] = String(m).split("|"); return { cam, nome: alias || cam.split("/").pop() }; };

function SubjectDashboard() {
    const { theme } = useTheme();
    const d = useSubjectData();
    const co = useCoadoDaDisciplina(d.codigo);
    const cob = cobertura(d, co);
    const [aba, setAba] = dc.useState("programa");
    const muted = theme?.["color-text-muted"] || "var(--text-muted)";
    const primary = theme?.["color-primary"] || "#7c3aed";
    const btn = { size: "small", variant: "liquid-glass", glow: false, lift: false };
    const semNada = !d.temAlgumRegistro && !(co && co.estudos.length);

    const abas = [
        { id: "programa", label: `Programa (${cob.estudados}/${cob.total})` },
        { id: "estudo", label: co?.estudos.length ? `Estudo (${co.estudos.length})` : "Estudo" },
        { id: "conteudo", label: d.artefatos.length ? `Conteúdo (${d.artefatos.length})` : "Conteúdo" },
        { id: "mastery", label: "Mastery" },
        { id: "sessoes", label: d.estudo.sessoes ? `Sessões (${d.estudo.sessoes})` : "Sessões" },
        { id: "srs", label: d.srs.buckets.vencidos ? `SRS (${d.srs.buckets.vencidos} vencidos)` : "SRS" },
    ];

    return (
        <div style={{ padding: "14px 10px 10px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap",
                borderBottom: `1px solid ${alpha(primary, 0.27)}`, paddingBottom: 8, marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 16, fontWeight: 700 }}>Acompanhamento</span>
                    <span style={{ fontSize: 11.5, color: muted }}>{d.codigo}{d.semestre ? ` · ${d.semestre}` : ""}{d.indexadoEm ? ` · programa indexado em ${d.indexadoEm}` : ""}</span>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {abas.map(t => <GloButton key={t.id} {...btn} label={t.label} active={aba === t.id} onClick={() => setAba(t.id)} />)}
                </div>
            </div>

            {semNada && (
                <div style={{ fontSize: 12, padding: "6px 10px", marginBottom: 10, borderRadius: 8, border: `1px solid ${alpha(theme?.["color-warning"] || "#d68910", 0.35)}` }}>
                    <strong>Nenhum estudo registrado nesta disciplina ainda</strong>: nem sessão guiada, nem estudo no Coado. Existe só o programa ({d.ementa.length} conceitos).
                </div>
            )}

            <FaixaNumeros d={d} co={co} cob={cob} theme={theme} />

            <div>
                <div style={{ display: aba === "programa" ? "block" : "none" }}><ProgramaGrade d={d} cob={cob} theme={theme} /></div>
                <div style={{ display: aba === "estudo" ? "block" : "none" }}><EstudoCoado co={co} theme={theme} /></div>
                <div style={{ display: aba === "conteudo" ? "block" : "none" }}><SubjectIndex embutido /></div>
                <div style={{ display: aba === "mastery" ? "block" : "none" }}><MasteryProfile d={d} theme={theme} /></div>
                <div style={{ display: aba === "sessoes" ? "block" : "none" }}><SessionAnalytics d={d} theme={theme} /></div>
                <div style={{ display: aba === "srs" ? "block" : "none" }}><SRSMetrics d={d} theme={theme} /></div>
            </div>

            {d.materiais.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 10, paddingTop: 8, borderTop: `1px solid ${alpha(primary, 0.15)}` }}>
                    <span style={{ fontSize: 11, color: muted }}>Materiais</span>
                    <GloBadgeGroup>
                        {d.materiais.map(m => { const x = nomeMaterial(m); return <GloBadge key={m} variant="soft" size="small" clickable onClick={() => abrir(x.cam)}>{x.nome}</GloBadge>; })}
                    </GloBadgeGroup>
                </div>
            )}
        </div>
    );
}

const SubjectDashboardGated = gate(SubjectDashboard);
return {
    SubjectDashboard: SubjectDashboardGated, Func: SubjectDashboardGated,
    SyllabusCoverage, MasteryProfile, SessionAnalytics, SRSMetrics, ProgramaGrade, EstudoCoado, FaixaNumeros,
    DistBars, SerieScores,
};
