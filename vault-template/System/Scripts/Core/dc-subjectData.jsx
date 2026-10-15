/* ==================================================================
   SUBJECT DATA — camada de dados da zona acadêmica (Mecha-Tutor)

   Hook único que lê a nota da disciplina corrente e TODA nota cujo
   `class` aponte para ela, e devolve as leituras derivadas que os
   widgets consomem. Nenhum widget consulta o vault por conta própria —
   assim índice, cobertura, mastery, sessões e SRS falam dos mesmos
   números.

   Contrato das propriedades (fonte única):
   System/Z_Vault/2025-12-25_DOC_Sistema_Tags.md — §Vocabulários de propriedade.

     type      sessao | revisao | pratica | aula | nota_de_aula | tarefa | exam | quiz | project
     class     "[[<COD Nome>]]"  — vínculo com a disciplina
     topic     id de conteudo_programatico[] — chave de agrupamento

   PRINCÍPIO: distinguir PROGRAMA de CONTEÚDO PRODUZIDO.
   `conteudo_programatico[]` é a ementa (existe desde a ingestão, mesmo
   sem nenhum estudo). Artefato é o que foi de fato gerado/registrado.
   Misturar os dois faz sistema vazio parecer cheio — não fazer isso.

   - Usage:
       const { useSubjectData } = await dc.require(dc.fileLink("System/Scripts/Core/dc-subjectData.jsx"));
   ================================================================== */

const LIMIAR_CRITICO = 6.0;      // limiar da rubrica 0-10 (nota de aprovação)
const DIAS_FRIO = 21;            // conceito sem sessão há mais que isso = esfriando

const ESPECIES = [
    { id: "sessao", label: "Sessões", tipos: ["sessao"] },
    { id: "revisao", label: "Revisões", tipos: ["revisao"] },
    { id: "pratica", label: "Práticas", tipos: ["pratica"] },
    { id: "aula", label: "Aulas", tipos: ["aula", "nota_de_aula", "nota", "note", "lecture"] },
    { id: "trabalho", label: "Trabalhos", tipos: ["tarefa", "trabalho", "assignment", "exam", "exame", "quiz", "midterm", "final", "project", "projeto", "leitura", "reading", "redação", "redacao", "essay"] },
];
const especieDe = (tipo) => {
    const t = String(tipo || "").toLowerCase();
    return ESPECIES.find(e => e.tipos.includes(t))?.id || null;
};

// ── leitura de campo (valor CRU: listas de objetos precisam sobreviver) ──────
const rawField = (p, campo) => {
    if (!p) return null;
    if (typeof p.value === "function") {
        try { const v = p.value(campo); if (v !== undefined && v !== null) return v; } catch (e) { /* ignore */ }
    }
    if (p.frontmatter && p.frontmatter[campo] !== undefined) return p.frontmatter[campo];
    if (p.$frontmatter && p.$frontmatter[campo] !== undefined) {
        const f = p.$frontmatter[campo];
        return (f && typeof f === "object" && "value" in f) ? f.value : f;
    }
    if (p[campo] !== undefined) return p[campo];
    return null;
};
const textField = (p, campo) => {
    const v = rawField(p, campo);
    if (v === null || v === undefined) return "";
    if (typeof v === "object") {
        if (typeof v.toISODate === "function") { try { return v.toISODate(); } catch (e) { /* ignore */ } }
        if (v instanceof Date) return v.toISOString().slice(0, 10);
        return JSON.stringify(v);
    }
    return String(v);
};
const numField = (p, campo) => {
    const s = textField(p, campo);
    if (s === "") return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
};
const listField = (p, campo) => {
    const v = rawField(p, campo);
    if (v === null || v === undefined) return [];
    return Array.isArray(v) ? v : [v];
};

const infoArquivo = (p) => {
    const path = p?.$path || p?.file?.path || p?.path || "";
    let nome = p?.$name || p?.file?.name || p?.name || "";
    if (!nome && path) nome = path.split("/").pop();
    return { path, nome: String(nome || "").replace(/\.md$/, "") };
};

// Data LOCAL, não `toISOString()`. Em UTC-3, das 21h à meia-noite o ISO em UTC
// já aponta para amanhã: os buckets do SRS, o corte de "frio" (21 dias) e a
// previsão de 14 dias andavam um dia inteiro à noite, que é justamente quando o
// estudo acontece. Mesmo motivo em `somaDias`.
const dataLocal = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const hoje = () => dataLocal(new Date());
const diasEntre = (a, b) => {
    if (!a || !b) return null;
    const d1 = new Date(`${String(a).slice(0, 10)}T00:00:00`);
    const d2 = new Date(`${String(b).slice(0, 10)}T00:00:00`);
    if (isNaN(d1) || isNaN(d2)) return null;
    return Math.round((d2 - d1) / 86400000);
};
const somaDias = (iso, n) => {
    const d = new Date(`${iso}T00:00:00`);
    d.setDate(d.getDate() + n);
    return dataLocal(d);
};

function ligaPara(valorClass, { codigo, nomeArquivo, path }) {
    const s = String(valorClass || "");
    if (!s) return false;
    return [codigo, nomeArquivo, path].some(alvo => alvo && (s.includes(`[[${alvo}]]`) || s.includes(alvo)));
}

// ── hook ─────────────────────────────────────────────────────────────────────
// Derivações já feitas, na janela: chave = disciplina + revisões das páginas +
// dia. Vários blocos e componentes da mesma disciplina (ClassView, painel,
// índice embutido, embeds) pagam a derivação uma vez só.
const CACHE = (window.__dcSubjectData = window.__dcSubjectData || new Map());
const revKey = (pages, atual) => {
    let sum = 0, max = 0;
    for (const p of pages || []) { const r = p.$revision || 0; sum += r; if (r > max) max = r; }
    return `${(pages || []).length}:${sum}:${max}:${atual?.$revision || 0}`;
};

function useSubjectData() {
    // Query restrita a System/Academico: todas as notas acadêmicas (disciplinas,
    // semestres, aulas, trabalhos) vivem lá. Com "@page" o widget varria a vault
    // inteira a cada edição em qualquer nota.
    const pages = dc.useQuery('@page and path("System/Academico")');
    const atual = dc.useCurrentFile();
    const { path: pathAtual, nome: nomeAtual } = infoArquivo(atual);
    const codigo = textField(atual, "codigo") || nomeAtual.split(" ")[0];
    const chave = `${pathAtual}|${codigo}|${revKey(pages, atual)}|${hoje()}`;

    return dc.useMemo(() => {
        const pronto = CACHE.get(chave);
        if (pronto) return pronto;
        const d = derivar();
        CACHE.set(chave, d);
        if (CACHE.size > 24) CACHE.delete(CACHE.keys().next().value);
        return d;
    }, [chave]);

    function derivar() {
        const hj = hoje();

        // ── ementa (PROGRAMA — existe desde a ingestão, não é conteúdo produzido)
        const ementa = listField(atual, "conteudo_programatico")
            .filter(c => c && typeof c === "object")
            .map(c => ({
                id: String(c.id ?? ""),
                nome: String(c.nome ?? c.id ?? ""),
                aula: Number.isFinite(Number(c.aula)) ? Number(c.aula) : null,
                masteryArmazenado: typeof c.mastery === "number" ? c.mastery : null,
                lastSessionArmazenada: c.last_session ? String(c.last_session).slice(0, 10) : null,
            }))
            .sort((a, b) => (a.aula ?? 9999) - (b.aula ?? 9999));

        // ── artefatos ligados (CONTEÚDO PRODUZIDO)
        const alvo = { codigo, nomeArquivo: nomeAtual, path: pathAtual };
        const artefatos = (pages || [])
            .filter(p => {
                const { path } = infoArquivo(p);
                if (!path || path === pathAtual) return false;
                // Template acadêmico carrega `[[Trabalhos Curso]]` de verdade no
                // frontmatter e casa com a query como se fosse artefato real.
                if (path.startsWith("System/Templates/") || /Template/i.test(path.split("/").pop())) return false;
                return ligaPara(textField(p, "class"), alvo);
            })
            .map(p => {
                const { path, nome } = infoArquivo(p);
                const tipo = textField(p, "type");
                const conceitos = listField(p, "conceitos").filter(c => c && typeof c === "object");
                const scores = conceitos.map(c => Number(c?.comprehension_score)).filter(Number.isFinite);
                const handoff = listField(p, "handoff").map(String);
                return {
                    path, nome, tipo,
                    especie: especieDe(tipo),
                    topic: textField(p, "topic"),
                    // conceitos secundários da mesma sessão (uma lista de exercícios cobre mais de um)
                    topicos: listField(p, "topicos").map(String),
                    status: textField(p, "status"),
                    data: textField(p, "data") || textField(p, "date") || textField(p, "created").slice(0, 10),
                    vence: textField(p, "due_date") || textField(p, "due"),
                    // sessão
                    duracao: numField(p, "duracao_min"),
                    modo: textField(p, "modo"),
                    capitulo: textField(p, "capitulo"),
                    conceitosMedidos: conceitos.map(c => ({
                        nome: String(c?.nome ?? ""), score: Number(c?.comprehension_score),
                    })).filter(c => Number.isFinite(c.score)),
                    score: scores.length ? Math.max(...scores) : numField(p, "nota") ?? numField(p, "grade"),
                    desbloqueio: handoff.some(h => h.toLowerCase().startsWith("desbloqueio")),
                    // card SRS
                    ease: numField(p, "ease"),
                    intervalo: numField(p, "interval_days"),
                    reps: numField(p, "reps"),
                    ultimoScore: numField(p, "last_score"),
                    concept: textField(p, "concept"),
                };
            });

        const sessoes = artefatos.filter(a => a.especie === "sessao")
            .sort((a, b) => String(a.data).localeCompare(String(b.data)));
        const cards = artefatos.filter(a => a.especie === "revisao");
        const praticas = artefatos.filter(a => a.especie === "pratica");
        const aulas = artefatos.filter(a => a.especie === "aula");
        const trabalhos = artefatos.filter(a => a.especie === "trabalho");

        // ── conceitos: ementa cruzada com o que foi produzido
        const conceitos = ementa.map(c => {
            const itens = artefatos.filter(a => (a.topic && a.topic === c.id) || a.topicos.includes(c.id));
            const s = itens.filter(a => a.especie === "sessao")
                .sort((x, y) => String(x.data).localeCompare(String(y.data)));
            // a nota da sessão mede o conceito principal (`topic`); os secundários (`topicos`) contam como estudados, sem nota
            const scoresConceito = s.filter(x => x.topic === c.id).map(x => x.score).filter(Number.isFinite);
            const ultima = s.length ? s[s.length - 1].data : null;
            const mastery = c.masteryArmazenado ?? (scoresConceito.length ? scoresConceito[scoresConceito.length - 1] : null);
            const ultimaSessao = c.lastSessionArmazenada || ultima;
            const idade = ultimaSessao ? diasEntre(ultimaSessao, hj) : null;
            return {
                ...c, itens, sessoes: s, mastery,
                derivado: c.masteryArmazenado === null && scoresConceito.length > 0,
                estudado: s.length > 0,
                critico: mastery !== null && mastery < LIMIAR_CRITICO,
                frio: s.length > 0 && idade !== null && idade > DIAS_FRIO,
                idade, scores: scoresConceito,
            };
        });

        const idsEmenta = new Set(ementa.map(c => c.id));
        const orfaos = artefatos.filter(a => !a.topic || !idsEmenta.has(a.topic));

        // ── SRS: buckets de vencimento e previsão
        const ativos = cards.filter(c => c.status !== "done");
        const bucketCard = (c) => {
            const d = c.vence ? diasEntre(hj, c.vence) : null;
            if (d === null) return "sem-data";
            if (d < 0) return "vencidos";
            if (d === 0) return "hoje";
            if (d <= 7) return "7d";
            if (d <= 30) return "30d";
            return "depois";
        };
        const buckets = { vencidos: 0, hoje: 0, "7d": 0, "30d": 0, depois: 0, "sem-data": 0 };
        ativos.forEach(c => { buckets[bucketCard(c)] += 1; });
        const previsao = Array.from({ length: 14 }, (_, i) => {
            const dia = somaDias(hj, i);
            return { dia, n: ativos.filter(c => String(c.vence).slice(0, 10) === dia).length };
        });
        const eases = ativos.map(c => c.ease).filter(Number.isFinite);
        const repsList = ativos.map(c => c.reps).filter(Number.isFinite);

        // ── sessões: agregados
        const duracoes = sessoes.map(s => s.duracao).filter(Number.isFinite);
        const scoresSessao = sessoes.map(s => s.score).filter(Number.isFinite);
        const modos = {};
        sessoes.forEach(s => { const m = s.modo || "—"; modos[m] = (modos[m] || 0) + 1; });

        const masteryMedido = conceitos.map(c => c.mastery).filter(Number.isFinite);
        const media = (xs) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;

        return {
            // identidade
            codigo, nomeAtual, pathAtual,
            disciplina: textField(atual, "disciplina"),
            semestre: textField(atual, "semestre"),
            skillDominio: textField(atual, "skill_dominio"),
            notaUsuario: textField(atual, "nota"),
            materiais: listField(atual, "fontes").map(f => String(f).replace(/^\[\[|\]\]$/g, "")),
            indexadoEm: textField(atual, "tutor_indexed_at").slice(0, 10),

            // camadas — PROGRAMA vs PRODUZIDO, nunca somadas
            ementa, conceitos, artefatos, orfaos,
            sessoes, cards, praticas, aulas, trabalhos,

            temAlgumRegistro: artefatos.length > 0,

            cobertura: {
                total: ementa.length,
                estudados: conceitos.filter(c => c.estudado).length,
                criticos: conceitos.filter(c => c.critico).length,
                frios: conceitos.filter(c => c.frio).length,
                pct: ementa.length ? Math.round(100 * conceitos.filter(c => c.estudado).length / ementa.length) : 0,
            },
            srs: {
                total: cards.length, ativos: ativos.length, buckets, previsao,
                easeMedio: media(eases), repsMedio: media(repsList),
                maduros: ativos.filter(c => (c.reps ?? 0) >= 3).length,
                lista: ativos.slice().sort((a, b) => String(a.vence).localeCompare(String(b.vence))),
            },
            estudo: {
                sessoes: sessoes.length,
                minutos: duracoes.reduce((a, b) => a + b, 0),
                duracaoMedia: media(duracoes),
                scoreMedio: media(scoresSessao),
                scoreUltimo: scoresSessao.length ? scoresSessao[scoresSessao.length - 1] : null,
                modos, desbloqueios: sessoes.filter(s => s.desbloqueio).length,
                serie: sessoes.filter(s => Number.isFinite(s.score))
                    .map(s => ({ data: s.data, score: s.score, path: s.path, nome: s.nome })),
            },
            mastery: {
                medio: media(masteryMedido),
                medidos: masteryMedido.length,
                distribuicao: [
                    { faixa: "0–3", n: masteryMedido.filter(m => m < 3).length },
                    { faixa: "3–6", n: masteryMedido.filter(m => m >= 3 && m < 6).length },
                    { faixa: "6–8", n: masteryMedido.filter(m => m >= 6 && m < 8).length },
                    { faixa: "8–10", n: masteryMedido.filter(m => m >= 8).length },
                ],
            },
            hoje: hj,
        };
    }
}

return { useSubjectData, ESPECIES, especieDe, LIMIAR_CRITICO, DIAS_FRIO, infoArquivo, diasEntre };
