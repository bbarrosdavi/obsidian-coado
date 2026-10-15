// ═══════════════════════════════════════════════════════════════════════════════
// STUDY SESSIONS WIDGET (Próximas Sessões do Ciclo & Revisões)
//
// Cápsula compacta para a Home: lê o ciclo do Coado (C.useEstudo), exibe as
// próximas sessões pendentes com barra de progresso, botão para pular/reorganizar
// a fila, revisões pendentes de hoje (SRS) e atalho para o Painel Acadêmico.
// ═══════════════════════════════════════════════════════════════════════════════

const { useTheme } = await dc.require(dc.fileLink("System/Scripts/Core/dc-themeProvider.jsx"));
const { GloButton, alpha } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloButton.jsx"));
const C = await dc.require(dc.fileLink("System/Scripts/Core/dc-coadoCore.jsx"));

const Ponto = ({ cor, tamanho = 8 }) => (
    <span style={{ width: tamanho, height: tamanho, borderRadius: "50%", background: cor || "#999", display: "inline-block", flexShrink: 0 }} />
);

const Barra = ({ valor, cor, fundo, altura = 5 }) => (
    <div style={{ height: altura, background: fundo || "rgba(127,127,127,0.18)", borderRadius: altura / 2, overflow: "hidden", width: "100%", marginTop: 4 }}>
        <div style={{ height: "100%", width: `${Math.min(100, Math.max(0, valor))}%`, background: cor || "var(--text-accent)", transition: "width .25s ease" }} />
    </div>
);

function StudySessionsWidget() {
    const { theme } = useTheme();
    const dados = C.useEstudo();

    const primary = theme["color-primary"] || "#7c3aed";
    const muted = theme["color-text-muted"] || "var(--text-muted)";
    const line = alpha(primary, 0.15);
    const bad = theme["color-red"] || "#ef4444";
    const ok = theme["color-success"] || "#10b981";

    if (!dados || !dados.ok) {
        return (
            <div style={{ padding: "16px 12px", textAlign: "center", color: muted, fontSize: 12, fontStyle: "italic" }}>
                Nenhum plano de estudo ativo encontrado para o semestre.
            </div>
        );
    }

    const items = C.cycleProgress(dados.planning, dados.studies);
    const pendentes = items.filter(i => !i.done);
    const concluidas = items.filter(i => i.done).length;
    const prox = pendentes.slice(0, 4);

    const hoje = C.today();
    const revisoesHoje = (dados.reviews || []).filter(r => r.dueDate <= hoje && r.status === "pendente");

    const abrirPainel = (e) => {
        e?.preventDefault?.();
        app.workspace.openLinkText("System/Dashboards/Painel Academico", "", false);
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", boxSizing: "border-box" }}>
            {/* Cabeçalho */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${line}`, paddingBottom: 6 }}>
                <div>
                    <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.2px" }}>Ciclo de Estudo</div>
                    <div style={{ fontSize: 10, color: muted }}>
                        Ciclo {dados.planning.completedCycles + 1} · {concluidas} de {items.length} concluídas
                    </div>
                </div>
                <GloButton
                    label="Painel ↗"
                    size="small"
                    variant="liquid-glass"
                    glow={false}
                    lift={false}
                    onClick={abrirPainel}
                    style={{ fontSize: 10, padding: "2px 7px" }}
                />
            </div>

            {/* Lista das Próximas Sessões */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {prox.length === 0 ? (
                    <div style={{ padding: "12px 8px", textAlign: "center", fontSize: 11, color: muted }}>
                        Ciclo concluído!
                        <div style={{ marginTop: 6 }}>
                            <GloButton
                                label="Recomeçar Ciclo"
                                size="small"
                                variant="liquid-glass"
                                glow={false}
                                onClick={() => C.recomecarCiclo(dados)}
                                style={{ fontSize: 10 }}
                            />
                        </div>
                    </div>
                ) : (
                    prox.map((it, idx) => {
                        const d = dados.porId.get(it.subjectId);
                        const pct = it.duration > 0 ? (it.studied / (it.duration * 60)) * 100 : 0;
                        const restanteMin = Math.max(0, Math.round((it.duration * 60 - it.studied) / 60));

                        return (
                            <div
                                key={it.id}
                                style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    padding: "6px 8px",
                                    borderRadius: 8,
                                    background: idx === 0 ? alpha(primary, 0.08) : alpha(muted, 0.05),
                                    border: idx === 0 ? `1px solid ${alpha(primary, 0.25)}` : "1px solid transparent",
                                }}
                            >
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                                    <div
                                        style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, cursor: "pointer" }}
                                        onClick={(e) => d && C.abrirNota(d.path, e)}
                                        title={d ? `Abrir nota de ${d.titulo}` : ""}
                                    >
                                        <Ponto cor={d?.cor || primary} tamanho={7} />
                                        <span style={{ fontSize: 11, fontWeight: idx === 0 ? 700 : 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                            {d ? `${d.cod} · ${d.titulo}` : it.subjectId.toUpperCase()}
                                        </span>
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                                        <span style={{ fontSize: 10, color: muted, fontVariantNumeric: "tabular-nums" }}>
                                            {C.fmtDuration(it.studied)} / {C.fmtMinutes(it.duration)}
                                        </span>
                                        {pendentes.length > 1 && (
                                            <button
                                                onClick={() => C.pularSessaoCiclo(dados, it.id)}
                                                title="Pular sessão (passar para o fim da fila)"
                                                style={{
                                                    background: "transparent",
                                                    border: "none",
                                                    color: muted,
                                                    cursor: "pointer",
                                                    padding: "0 2px",
                                                    fontSize: 12,
                                                    lineHeight: 1,
                                                }}
                                            >
                                                ↷
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <Barra valor={pct} cor={d?.cor || primary} />
                            </div>
                        );
                    })
                )}
            </div>

            {/* Revisões SRS de Hoje (se houver) */}
            {revisoesHoje.length > 0 && (
                <div style={{ marginTop: 4, borderTop: `1px solid ${line}`, paddingTop: 6 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: muted, marginBottom: 4, textTransform: "uppercase", letterSpacing: ".04em" }}>
                        Revisões Hoje ({revisoesHoje.length})
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {revisoesHoje.slice(0, 3).map(r => {
                            const d = dados.porId.get(r.subjectId);
                            const atrasada = r.dueDate < hoje;
                            return (
                                <div
                                    key={r.id}
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        padding: "3px 6px",
                                        borderRadius: 6,
                                        fontSize: 10,
                                        background: alpha(atrasada ? bad : primary, 0.08),
                                    }}
                                >
                                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>
                                        <b>{d?.cod || r.subjectId.toUpperCase()}</b>{r.topicId ? ` · ${r.topicId}` : ""}
                                    </span>
                                    <button
                                        onClick={() => C.statusRevisao(dados, r.id, "feita")}
                                        title="Marcar revisão como feita"
                                        style={{
                                            background: "transparent",
                                            border: `1px solid ${alpha(ok, 0.4)}`,
                                            borderRadius: 4,
                                            color: ok,
                                            cursor: "pointer",
                                            fontSize: 9,
                                            padding: "1px 5px",
                                            marginLeft: 4,
                                            flexShrink: 0,
                                        }}
                                    >
                                        ✓
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

return { Func: StudySessionsWidget, StudySessionsWidget };
