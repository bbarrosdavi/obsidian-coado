/* ==================================================================
   SUBJECT INDEX — índice do conteúdo PRODUZIDO de uma disciplina

   Lista o que foi de fato gerado, criado, anexado e avaliado sobre a
   matéria — sessões guiadas medidas, cards SRS, listas de prática,
   notas de aula e trabalhos — agrupado pelo conceito do plano de aulas.

   CORREÇÃO 2026-08-01: a primeira versão usava a ementa
   (`conteudo_programatico[]`, 29 conceitos vindos do plano de aulas da
   UTFPR) como espinha do índice, e pendurava os artefatos nela. Com zero
   sessões, zero cards e zero notas ligadas, o índice renderizava 29
   linhas e PARECIA populado — a ementa existe desde a ingestão, ela não
   é conteúdo produzido. Aqui o índice mostra só artefato real: conceito
   sem nada não aparece. A visão de cobertura do programa (que é útil, e
   é onde a ementa deve viver) fica na aba "Programa" do
   `dc-subjectMetrics.jsx`, rotulada como programa.

   É DERIVADO: lê `class` e `topic` das notas, nenhum agente escreve nele.

   - Usage:
       const { SubjectIndex } = await dc.require(dc.fileLink("System/Scripts/Widgets/dc-subjectIndex.jsx"));
       return <SubjectIndex />;                 // com card próprio
       return <SubjectIndex embutido />;        // dentro de outro card
   ================================================================== */

const { useTheme } = await dc.require(dc.fileLink("System/Scripts/Core/dc-themeProvider.jsx"));
const { GloCard } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloCard.jsx"));
const { GloBadge, GloBadgeGroup } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloBadge.jsx"));
const { useSubjectData, ESPECIES, LIMIAR_CRITICO } = await dc.require(dc.fileLink("System/Scripts/Core/dc-subjectData.jsx"));
const { gate } = await dc.require(dc.fileLink("System/Scripts/Core/dc-visibleGate.jsx"));

const abrir = (path) => { if (path) app.workspace.openLinkText(path, "", false); };
const corMastery = (theme, m) =>
    m === null || m === undefined ? (theme?.["color-text-muted"] || "var(--text-muted)")
        : m < LIMIAR_CRITICO ? (theme?.["color-error"] || "#c0392b")
            : m < 8 ? (theme?.["color-warning"] || "#d68910")
                : (theme?.["color-success"] || "#27ae60");

function Item({ item, muted }) {
    const detalhe = [
        item.data || null,
        item.vence ? `vence ${item.vence}` : null,
        item.status && !["open", ""].includes(item.status) ? item.status : null,
        Number.isFinite(item.score) ? `score ${item.score.toFixed(1)}` : null,
    ].filter(Boolean).join(" · ");
    return (
        <div onClick={() => abrir(item.path)} title={item.path}
            style={{
                display: "flex", alignItems: "baseline", gap: 8, cursor: "pointer",
                padding: "3px 8px", borderRadius: 5, fontSize: 12.5,
                background: "var(--background-modifier-hover, rgba(0,0,0,0.04))",
            }}>
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.nome}</span>
            {detalhe && <span style={{ color: muted, fontSize: 11, whiteSpace: "nowrap" }}>{detalhe}</span>}
        </div>
    );
}

function GrupoConceito({ c, theme, accent, muted }) {
    const porEspecie = ESPECIES
        .map(e => ({ ...e, lista: c.itens.filter(i => i.especie === e.id) }))
        .filter(e => e.lista.length > 0);
    return (
        <div style={{ padding: "8px 0 10px", borderBottom: `1px solid ${accent}1a` }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                <span style={{ minWidth: 32, fontSize: 11, color: muted, fontVariantNumeric: "tabular-nums" }}>
                    {c.aula !== null ? `A${String(c.aula).padStart(2, "0")}` : "—"}
                </span>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={c.nome}>
                    {c.nome}
                </span>
                <span title={c.derivado ? "derivado da última sessão (indexer ainda não consolidou)" : "mastery consolidado"}
                    style={{ fontSize: 12, fontWeight: 700, color: corMastery(theme, c.mastery), fontVariantNumeric: "tabular-nums" }}>
                    {c.mastery === null ? "—" : c.mastery.toFixed(1)}{c.derivado ? "*" : ""}
                </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 6, paddingLeft: 42 }}>
                {porEspecie.map(e => (
                    <div key={e.id} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                        <span style={{ minWidth: 66, fontSize: 11, color: muted, paddingTop: 4, flexShrink: 0 }}>{e.label}</span>
                        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
                            {e.lista.map(i => <Item key={i.path} item={i} muted={muted} />)}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function Conteudo({ d, theme }) {
    const accent = theme?.["color-accent"] || "var(--interactive-accent)";
    const muted = theme?.["color-text-muted"] || "var(--text-muted)";

    // Só conceitos COM artefato. Programa não entra aqui.
    const comConteudo = d.conceitos.filter(c => c.itens.length > 0);

    if (!d.artefatos.length) {
        return (
            <div style={{ fontSize: 12.5, lineHeight: 1.7, opacity: 0.8 }}>
                <div style={{ fontWeight: 600, marginBottom: 6, opacity: 1 }}>
                    Nada foi produzido nesta disciplina ainda.
                </div>
                Zero sessões guiadas, zero cards de revisão, zero listas de prática, zero notas ligadas.
                {d.ementa.length > 0 && (
                    <> O que existe é o <strong>programa</strong> — {d.ementa.length} conceitos ingeridos
                        do plano de aulas{d.indexadoEm ? ` em ${d.indexadoEm}` : ""} —, e programa não é conteúdo.
                        Ele fica na aba <strong>Programa</strong>.</>
                )}
                <div style={{ marginTop: 8, fontSize: 12, opacity: 0.85 }}>
                    Este índice preenche sozinho: toda nota com <code>class</code> apontando para esta
                    disciplina e <code>topic</code> preenchido aparece aqui, agrupada por conceito.
                </div>
            </div>
        );
    }

    const conta = (esp) => d.artefatos.filter(a => a.especie === esp).length;
    return (
        <div>
            <GloBadgeGroup style={{ marginBottom: 10 }}>
                {ESPECIES.map(e => conta(e.id) > 0 && (
                    <GloBadge key={e.id} variant="soft" size="small">{conta(e.id)} {e.label.toLowerCase()}</GloBadge>
                ))}
            </GloBadgeGroup>

            <div style={{ display: "flex", flexDirection: "column" }}>
                {comConteudo.map(c => <GrupoConceito key={c.id} c={c} theme={theme} accent={accent} muted={muted} />)}
            </div>

            {d.orfaos.length > 0 && (
                <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 11, color: muted, marginBottom: 6 }}>
                        Sem conceito atribuído — preencha <code>topic:</code> para entrar no agrupamento
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        {d.orfaos.map(i => <Item key={i.path} item={i} muted={muted} />)}
                    </div>
                </div>
            )}

            <div style={{ marginTop: 10, fontSize: 10.5, color: muted }}>
                {comConteudo.length} de {d.ementa.length} conceitos do programa têm registro.
                Derivado de <code>class</code> e <code>topic</code> — nenhum agente escreve neste índice.
            </div>
        </div>
    );
}

function SubjectIndex({ embutido = false }) {
    const { theme } = useTheme();
    const d = useSubjectData();
    if (embutido) return <Conteudo d={d} theme={theme} />;
    return (
        <GloCard variant="glass" title="Índice de conteúdo"
            subtitle={d.artefatos.length ? `${d.codigo} · ${d.artefatos.length} itens` : d.codigo}>
            <Conteudo d={d} theme={theme} />
        </GloCard>
    );
}

// Entrada de nota com portão de visibilidade (a cópia no editor oculto não monta).
// Embutido em outro widget, o portão do pai já basta.
const SubjectIndexGated = gate(SubjectIndex);
const SubjectIndexEntry = (props) => props?.embutido ? <SubjectIndex {...props} /> : <SubjectIndexGated {...props} />;
return { SubjectIndex: SubjectIndexEntry, Func: SubjectIndexEntry, Conteudo, SubjectIndexInline: SubjectIndex };
