// ═══════════════════════════════════════════════════════════════════════════════
// DC-COADO-CORE - o estudo acadêmico com as contas do Coado, lido e gravado na vault
//
// Fontes (as mesmas que a ponte com o Coado sincroniza):
//   nota de estado   System/Academico/Semestres/<semestre> Estudo.md
//                    planejamento (ciclo), revisões, tópicos concluídos, metas, cores
//   estudos          `timeEntries` das notas-razão (<COD> Estudo <semestre>.md) e das tarefas
//                    acadêmicas com `class:`; cada entrada fechada de 1 min ou mais é um estudo
//   disciplinas      notas `type: disciplina` do semestre, com `conteudo_programatico`
//
// As contas (ciclo, progresso do ciclo, constância, totais) são porte direto de
// apps/web/src/lib/utils.ts do Coado (commit 4625e58); o gerador de ciclo foi conferido
// contra o original em 500 configurações.
//
// Gravações: só pelo processFrontMatter do Obsidian, na nota de estado e nas notas-razão.
// ═══════════════════════════════════════════════════════════════════════════════

const ACAD = "System/Academico";
const MIN_SEGUNDOS = 60;
const CATEGORIAS = [
    { id: "teoria", nome: "Teoria" }, { id: "revisao", nome: "Revisão" },
    { id: "questoes", nome: "Questões" }, { id: "execucao", nome: "Execução" },
];
const nomeCategoria = (id) => CATEGORIAS.find(c => c.id === id)?.nome || id;

// ---------- datas (data local YYYY-MM-DD, como no Coado) ----------
const pad = (n) => String(n).padStart(2, "0");
const toDateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => toDateStr(new Date());
const parseDate = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parseDate(s); d.setDate(d.getDate() + n); return toDateStr(d); };
const diffDays = (a, b) => Math.round((parseDate(a) - parseDate(b)) / 86400000);
const startOfWeek = (s) => addDays(s, -parseDate(s).getDay());
const startOfMonth = (s) => s.slice(0, 8) + "01";
const dateRange = (from, to) => { const out = []; for (let d = from; d <= to; d = addDays(d, 1)) out.push(d); return out; };
const DIAS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
const DIAS_LONGOS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const weekdayShort = (s) => DIAS[parseDate(s).getDay()];
const fmtDayMonth = (s) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;
const fmtDate = (s) => `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}`;

// ---------- durações ----------
const fmtDuration = (seconds) => {
    const total = Math.round(seconds / 60), h = Math.floor(total / 60), m = total % 60;
    return h === 0 ? `${m}min` : `${h}h${pad(m)}min`;
};
const fmtMinutes = (min) => fmtDuration(min * 60);
const fmtHoras = (h) => `${(Math.round(h * 10) / 10).toString().replace(".", ",")}h`;
const pct = (part, total) => (total > 0 ? Math.round((part / total) * 100) : 0);
const plural = (n, um, varios) => `${n} ${n === 1 ? um : (varios || um + "s")}`;

// ---------- agregações ----------
function totals(studies) {
    let duration = 0, hits = 0, misses = 0;
    const days = new Set();
    for (const s of studies) { duration += s.duration; hits += s.hits; misses += s.misses; days.add(s.date); }
    const questions = hits + misses;
    return { duration, hits, misses, questions, performance: pct(hits, questions), days: days.size };
}

function constancy(studies, ref = today()) {
    const studiedDays = new Set(studies.map(s => s.date));
    const sorted = [...studiedDays].sort();
    let record = 0, run = 0, prev = null;
    for (const d of sorted) { run = prev && diffDays(d, prev) === 1 ? run + 1 : 1; record = Math.max(record, run); prev = d; }
    let current = 0, cursor = studiedDays.has(ref) ? ref : addDays(ref, -1);
    while (studiedDays.has(cursor)) { current++; cursor = addDays(cursor, -1); }
    const last = sorted.filter(d => d <= ref).pop();
    return { studiedDays, current, record, daysSinceLast: last ? diffDays(ref, last) : null };
}

// ---------- planejamento (porte do Coado) ----------
const uid = () => (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36)).replace(/-/g, "").slice(0, 16);
const subjectWeight = (importance, knowledge) => importance * (6 - knowledge);
const roundTo = (v, step) => Math.max(step, Math.round(v / step) * step);

function generateCycle(cfg) {
    const subs = cfg.subjects.filter(s => s.importance > 0);
    if (!subs.length) return [];
    const weights = subs.map(s => subjectWeight(s.importance, s.knowledge));
    const sum = weights.reduce((a, b) => a + b, 0);
    const total = Math.max(cfg.weeklyMinutes, cfg.minSession * subs.length);
    const queues = subs.map((s, i) => {
        const minutes = Math.max(cfg.minSession, roundTo((weights[i] / sum) * total, 15));
        const n = Math.max(1, Math.ceil(minutes / cfg.maxSession));
        const session = Math.min(cfg.maxSession, Math.max(cfg.minSession, roundTo(minutes / n, 15)));
        return { subjectId: s.subjectId, weight: weights[i], sessions: Array.from({ length: n }, () => session) };
    });
    const out = [];
    let last = null;
    while (queues.some(q => q.sessions.length)) {
        const candidates = queues.filter(q => q.sessions.length).sort((a, b) => b.sessions.length - a.sessions.length || b.weight - a.weight);
        const pick = candidates.find(q => q.subjectId !== last) ?? candidates[0];
        out.push({ id: uid(), subjectId: pick.subjectId, duration: pick.sessions.shift() });
        last = pick.subjectId;
    }
    return out;
}

/** Cada estudo preenche a primeira sessão incompleta da mesma disciplina; o excedente vai para a última. */
function cycleProgress(planning, studies) {
    const items = planning.cycle.map(c => ({ ...c, studied: 0, done: false }));
    const relevant = studies.filter(s => s.countInPlanning && s.date >= planning.cycleStartedAt)
        .sort((a, b) => (a.date + (a.time ?? "")).localeCompare(b.date + (b.time ?? "")));
    for (const s of relevant) {
        let remaining = s.duration;
        const own = items.filter(i => i.subjectId === s.subjectId);
        if (!own.length) continue;
        for (const it of own) {
            if (remaining <= 0) break;
            const room = it.duration * 60 - it.studied;
            if (room <= 0) continue;
            const used = Math.min(room, remaining);
            it.studied += used; remaining -= used;
        }
        if (remaining > 0) own[own.length - 1].studied += remaining;
    }
    for (const it of items) it.done = it.studied >= it.duration * 60;
    return items;
}

/** Distribui a sequência do ciclo pelos dias marcados (modo semanal). */
function weeklySchedule(planning) {
    const days = planning.config.days.map((on, i) => ({ day: i, on }));
    const active = days.filter(d => d.on);
    const buckets = days.map(d => ({ day: d.day, items: [], minutes: 0 }));
    if (!active.length) return buckets;
    const perDay = planning.config.weeklyMinutes / active.length;
    let idx = 0;
    for (const item of planning.cycle) {
        while (idx < active.length - 1 && buckets[active[idx].day].minutes + item.duration / 2 > perDay) idx++;
        const b = buckets[active[idx].day];
        b.items.push(item); b.minutes += item.duration;
    }
    return buckets;
}

// ---------- leitura da vault ----------
const fmOf = (path) => {
    const f = app.vault.getAbstractFileByPath(path);
    return f ? app.metadataCache.getFileCache(f)?.frontmatter || null : null;
};
const alvoLink = (v) => { const m = /\[\[([^\]|#]+)/.exec(String(v || "")); return m ? m[1].trim() : null; };

/** Converte uma entrada de `timeEntries` em estudo (ou null). */
function estudoDaEntrada(e, disc, path, i) {
    if (!e || !e.startTime || !e.endTime || e.confirmado === false) return null;
    const st = new Date(e.startTime), en = new Date(e.endTime);
    if (isNaN(st) || isNaN(en)) return null;
    const duration = Math.round((en - st) / 1000);
    if (duration < MIN_SEGUNDOS) return null;
    return {
        id: e.coado || `${path}#${i}`, subjectId: disc.id, topicId: e.topico || null,
        categoryId: e.categoria || (disc.natureza === "execucao" ? "execucao" : "teoria"),
        date: toDateStr(st), time: `${pad(st.getHours())}:${pad(st.getMinutes())}`, duration,
        hits: +e.acertos || 0, misses: +e.erros || 0, countInPlanning: e.ciclo !== false,
        material: e.material || "", comment: e.comentario || "", path, index: i,
    };
}

/** Todo o estado do estudo do semestre ativo, recalculado quando muda algo em System/Academico. */
function useEstudo() {
    const pages = dc.useQuery(`@page and path("${ACAD}")`);
    return dc.useMemo(() => {
        const paths = pages.map(p => p.$path).filter(Boolean);
        const estadoPath = paths.find(p => p.startsWith(`${ACAD}/Semestres/`) && p.endsWith(" Estudo.md") && fmOf(p)?.coado_plano);
        if (!estadoPath) return { ok: false };
        const est = fmOf(estadoPath);
        const semestre = alvoLink(est.semestre) || estadoPath.split("/").pop().replace(" Estudo.md", "");
        const cores = est.cores || {};
        // disciplinas do semestre
        const discs = [];
        for (const p of paths) {
            if (!p.startsWith(`${ACAD}/Disciplinas/`)) continue;
            const fm = fmOf(p);
            if (!fm || fm.type !== "disciplina" || String(fm.semestre) !== semestre) continue;
            const cod = String(fm.codigo).trim();
            const nome = p.split("/").pop().replace(/\.md$/, "");
            discs.push({
                id: cod.toLowerCase(), cod, nome, titulo: fm.disciplina || nome, path: p, pasta: p.slice(0, p.lastIndexOf("/")),
                cor: cores[cod] || "#999", natureza: fm.natureza || "conteudo",
                topicos: (fm.conteudo_programatico || []).filter(t => t && t.id)
                    .map(t => ({ id: `${cod.toLowerCase()}_${t.id}`, nome: String(t.nome || t.id).replace(/\.$/, ""), aula: +t.aula || 0 })),
            });
        }
        discs.sort((a, b) => a.cod.localeCompare(b.cod));
        const porNome = new Map(discs.map(d => [d.nome, d]));
        const porId = new Map(discs.map(d => [d.id, d]));
        // estudos: notas-razão e tarefas acadêmicas com class
        // mesmo corte da ponte: entradas de antes do início do semestre não são deste semestre
        const inicioSem = String(fmOf(`${ACAD}/Semestres/${semestre}.md`)?.start || "").slice(0, 10) || "1970-01-01";
        const studies = [];
        for (const p of paths) {
            const d = discs.find(x => p.startsWith(x.pasta + "/"));
            if (!d) continue;
            const fm = fmOf(p);
            if (!fm || !Array.isArray(fm.timeEntries)) continue;
            const razao = p === `${d.pasta}/${d.cod} Estudo ${semestre}.md`;
            const tags = Array.isArray(fm.tags) ? fm.tags : [fm.tags];
            if (!razao && !(tags.includes("tipo/task") && porNome.get(alvoLink(fm.class)) === d)) continue;
            fm.timeEntries.forEach((e, i) => { const s = estudoDaEntrada(e, d, p, i); if (s && s.date >= inicioSem) studies.push(s); });
        }
        studies.sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
        const pl = est.planejamento || {};
        const planning = {
            type: pl.tipo === "semanal" ? "weekly" : "cycle",
            config: {
                weeklyMinutes: +pl.minutos_semana || 0, days: Array.isArray(pl.dias) ? pl.dias.map(Boolean) : [false, true, true, true, true, true, false],
                minSession: +pl.sessao_min || 30, maxSession: +pl.sessao_max || 120,
                subjects: (pl.disciplinas || []).map(x => ({ subjectId: String(x.codigo).toLowerCase(), importance: +x.importancia, knowledge: +x.conhecimento })),
            },
            cycle: (pl.ciclo || []).map(x => ({ id: String(x.id), subjectId: String(x.codigo).toLowerCase(), duration: +x.minutos })),
            completedCycles: +pl.ciclos_completos || 0,
            cycleStartedAt: String(pl.inicio_ciclo || today()).slice(0, 10),
        };
        const reviews = (est.revisoes || []).filter(r => r && r.id).map(r => ({
            id: String(r.id), studyId: String(r.estudo), subjectId: String(r.disciplina).toLowerCase(), topicId: r.topico || null,
            dueDate: String(r.vence).slice(0, 10), interval: +r.intervalo, status: r.status || "pendente", doneAt: r.feita_em || null,
        }));
        const meta = est.meta_semanal || {};
        return {
            ok: true, semestre, estadoPath, discs, porId, studies, planning, reviews,
            topicosConcluidos: new Set((est.topicos_concluidos || []).map(String)),
            meta: { minutes: +meta.minutos || 0, questions: +meta.questoes || 0 },
            dataProva: est.data_prova ? String(est.data_prova).slice(0, 10) : null,
            anki: est.anki || null,
            notasCards: notasDeCards(paths, discs),
            intervalos: (est.intervalos_revisao || [1, 7, 30]).map(Number),
        };
    }, [pages]);
}

/** Abre a nota no Obsidian (link dentro de widget não navega sozinho). */
function abrirNota(path, evento) {
    evento?.preventDefault?.();
    app.workspace.openLinkText(path, "", evento?.ctrlKey || evento?.metaKey);
}

// ---------- avaliações (várias por disciplina: P1, P2, substitutiva...) ----------
// Mesma regra da ponte: tabela da seção "Avaliações" da nota da disciplina (primeira data
// dd/mm/aaaa da linha; nome em negrito, ou a coluna que não é data nem peso) e tarefas type: exame.
const DATA_BR = /(\d{2})\/(\d{2})\/(\d{4})/;
const limpar = (s) => String(s || "").replace(/\*\*|`/g, "").replace(/\s+/g, " ").trim();

function lerTabelaAvaliacoes(corpo, d) {
    const out = [];
    let dentro = false;
    for (const linha of corpo.split("\n")) {
        if (/^#+\s*Avalia/.test(linha)) { dentro = true; continue; }
        if (dentro && linha.startsWith("#")) break;
        if (!dentro || !linha.trim().startsWith("|")) continue;
        const m = DATA_BR.exec(linha);
        if (!m) continue;
        const cels = linha.split("|").slice(1, -1).map(s => s.trim());
        const negrito = /\*\*([^*]+)\*\*/.exec(linha);
        const peso = cels.find(c => /^\d+\s*%$/.test(c)) || (/(\d+%)/.exec(linha) || [])[1] || null;
        const cData = cels.find(c => DATA_BR.test(c)) || "";
        const cNegrito = negrito ? cels.find(c => c.includes(negrito[0])) : null;
        const nome = limpar(negrito ? negrito[1] : cels.find(c => c !== cData && !/^\d+\s*%$/.test(c)) || "Avaliação");
        // o resto da célula da data (horário) e da célula do nome, mais as outras colunas, vira detalhe
        const extraData = limpar(cData.replace(DATA_BR, "").replace(/^\s*at[ée]\s*/i, "")).replace(/^[,;\s]+/, "");
        const extraNome = cNegrito ? limpar(cNegrito.replace(negrito[0], "").replace(/\(\s*\d+\s*%\s*\)/, "")).replace(/^[,:;\s]+/, "") : "";
        const outros = cels.filter(c => c !== cData && c !== cNegrito && c !== peso && limpar(c) !== nome).map(limpar);
        out.push({ cod: d.cod, id: d.id, cor: d.cor, path: d.path, data: `${m[3]}-${m[2]}-${m[1]}`, nome, peso,
            detalhe: [extraData, extraNome, ...outros].filter(Boolean).join(" · "), ate: /^\s*at[ée]\s/i.test(cData) });
    }
    return out;
}

/** Avaliações do semestre, ordenadas pela data. Lê o corpo das notas de disciplina (assíncrono). */
function useAvaliacoes(dados) {
    const [lista, setLista] = dc.useState([]);
    dc.useEffect(() => {
        if (!dados.ok) return;
        let vivo = true;
        (async () => {
            const out = [];
            for (const d of dados.discs) {
                const f = app.vault.getAbstractFileByPath(d.path);
                if (f) out.push(...lerTabelaAvaliacoes(await app.vault.cachedRead(f), d));
                // tarefas type: exame da disciplina (sem repetir data já vinda da tabela)
                for (const g of app.vault.getMarkdownFiles()) {
                    if (!g.path.startsWith(d.pasta + "/")) continue;
                    const fm = app.metadataCache.getFileCache(g)?.frontmatter;
                    if (fm?.type !== "exame" || !fm.due_date) continue;
                    const data = String(fm.due_date).slice(0, 10);
                    if (!out.some(a => a.cod === d.cod && a.data === data)) out.push({ cod: d.cod, id: d.id, cor: d.cor, path: g.path, data, nome: g.basename, peso: null, detalhe: "", ate: false });
                }
            }
            out.sort((a, b) => a.data.localeCompare(b.data) || a.cod.localeCompare(b.cod));
            if (vivo) setLista(out);
        })();
        return () => { vivo = false; };
    }, [dados]);
    return lista;
}

// ---------- Anki ----------
// O resumo (cards, novos, para hoje, revisados, retenção) vem da nota de estado: a ponte lê uma
// cópia da coleção a cada rodada. As ações falam com o AnkiConnect pelo http do Node (o fetch do
// Obsidian sai com origem app:// e o AnkiConnect só aceita http://localhost).

/** Notas de cards (Revisoes/, campo cards-deck ou #card) e notas de resolução (type: pratica), por disciplina. */
function notasDeCards(paths, discs) {
    const out = {};
    for (const d of discs) out[d.id] = { cards: [], resolucoes: [] };
    for (const p of paths) {
        const d = discs.find(x => p.startsWith(x.pasta + "/"));
        if (!d) continue;
        const f = app.vault.getAbstractFileByPath(p);
        const cache = f && app.metadataCache.getFileCache(f);
        const fm = cache?.frontmatter || {};
        const nCards = (cache?.tags || []).filter(x => x.tag === "#card").length;
        const nome = p.split("/").pop().replace(/\.md$/, "");
        if (fm["cards-deck"] || nCards) {
            out[d.id].cards.push({ path: p, nome, baralho: fm["cards-deck"] || null, cards: nCards,
                sincronizados: Object.keys(fm.flashcards || {}).length, status: fm.status || null, vence: fm.due_date ? String(fm.due_date).slice(0, 10) : null });
        } else if (fm.type === "pratica") {
            out[d.id].resolucoes.push({ path: p, nome, status: fm.status || null, vence: fm.due_date ? String(fm.due_date).slice(0, 10) : null });
        }
    }
    return out;
}

function ankiConnect(action, params = {}) {
    return new Promise((res, rej) => {
        let http;
        try { http = window.require("http"); } catch (e) { return rej(e); }
        const corpo = JSON.stringify({ action, version: 6, params });
        const req = http.request({ host: "127.0.0.1", port: 8765, method: "POST", headers: { "Content-Type": "application/json" }, timeout: 2500 }, (r) => {
            let d = ""; r.on("data", c => d += c); r.on("end", () => { try { const j = JSON.parse(d); j.error ? rej(new Error(j.error)) : res(j.result); } catch (e) { rej(e); } });
        });
        req.on("error", rej); req.on("timeout", () => { req.destroy(); rej(new Error("tempo esgotado")); });
        req.end(corpo);
    });
}

const ankiAberto = () => ankiConnect("version").then(() => true, () => false);

/** Abre o Anki pelo niri (fica independente do Obsidian) e espera o AnkiConnect responder. */
async function abrirAnki() {
    if (await ankiAberto()) return true;
    try {
        const cp = window.require("child_process");
        // PYTHONNOUSERSITE: o protobuf do pip de usuário (~/.local, 7.35) é mais velho que o que o Anki
        // exige e, carregado antes do do sistema, derruba o Anki na partida.
        cp.spawn("niri", ["msg", "action", "spawn", "--", "env", "PYTHONNOUSERSITE=1", "anki"], { detached: true, stdio: "ignore" })
            .on("error", () => cp.spawn("anki", [], { detached: true, stdio: "ignore", env: { ...process.env, PYTHONNOUSERSITE: "1" } }).unref()).unref();
    } catch (e) { new Notice("Não consegui abrir o Anki."); return false; }
    new Notice("Abrindo o Anki…");
    for (let i = 0; i < 40; i++) { await new Promise(r => setTimeout(r, 500)); if (await ankiAberto()) return true; }
    new Notice("O Anki não respondeu em 20 s.");
    return false;
}

async function revisarNoAnki(baralho) {
    if (!(await abrirAnki())) return;
    try { await ankiConnect("guiDeckReview", { name: baralho }); }
    catch (e) { new Notice(`Anki: ${e.message}`); }
}

/** Envia os cards da vault para o Anki (comando do plugin Flashcards), abrindo o Anki se preciso. */
async function sincronizarCards() {
    if (!(await abrirAnki())) return;
    const ok = app.commands.executeCommandById("flashcards-obsidian:flashcards-sync-vault");
    if (!ok) new Notice("Comando do plugin Flashcards não encontrado.");
}

// ---------- gravações ----------
async function noEstado(dados, fn) {
    const f = app.vault.getAbstractFileByPath(dados.estadoPath);
    if (!f) { new Notice("Nota de estado do semestre não encontrada."); return; }
    await app.fileManager.processFrontMatter(f, fn);
}

const planejamentoParaFm = (p) => ({
    tipo: p.type === "weekly" ? "semanal" : "ciclo", minutos_semana: p.config.weeklyMinutes, dias: p.config.days,
    sessao_min: p.config.minSession, sessao_max: p.config.maxSession,
    disciplinas: p.config.subjects.map(s => ({ codigo: s.subjectId.toUpperCase(), importancia: s.importance, conhecimento: s.knowledge })),
    ciclo: p.cycle.map(c => ({ id: c.id, codigo: c.subjectId.toUpperCase(), minutos: c.duration })),
    ciclos_completos: p.completedCycles, inicio_ciclo: p.cycleStartedAt,
});

const salvarPlanejamento = (dados, p) => noEstado(dados, fm => { fm.planejamento = planejamentoParaFm(p); });
const recomecarCiclo = (dados) => salvarPlanejamento(dados, { ...dados.planning, completedCycles: dados.planning.completedCycles + 1, cycleStartedAt: today() });

/** Move a sessão para o fim da fila pendente (pular agora), ou sobe/desce na ordem do ciclo. */
function pularSessaoCiclo(dados, itemId) {
    const p = dados.planning, items = cycleProgress(p, dados.studies);
    const idsPendentes = items.filter(i => !i.done).map(i => i.id);
    if (idsPendentes.length < 2) return;
    const alvo = itemId || idsPendentes[0];
    const idx = p.cycle.findIndex(c => c.id === alvo);
    if (idx < 0) return;
    const resto = p.cycle.filter((_, i) => i !== idx);
    // Coloca após a última sessão pendente (ou no fim do ciclo)
    const ultPendId = idsPendentes.filter(id => id !== alvo).pop();
    const pos = ultPendId ? resto.findIndex(c => c.id === ultPendId) + 1 : resto.length;
    const novoCiclo = [...resto.slice(0, pos), p.cycle[idx], ...resto.slice(pos)];
    return salvarPlanejamento(dados, { ...p, cycle: novoCiclo });
}

function moverSessaoCiclo(dados, itemId, dir) {
    const p = dados.planning;
    const idx = p.cycle.findIndex(c => c.id === itemId);
    const dest = idx + dir;
    if (idx < 0 || dest < 0 || dest >= p.cycle.length) return;
    const novoCiclo = [...p.cycle];
    [novoCiclo[idx], novoCiclo[dest]] = [novoCiclo[dest], novoCiclo[idx]];
    return salvarPlanejamento(dados, { ...p, cycle: novoCiclo });
}

function removerSessaoCiclo(dados, itemId) {
    const p = dados.planning;
    return salvarPlanejamento(dados, { ...p, cycle: p.cycle.filter(c => c.id !== itemId) });
}

function adicionarSessaoCiclo(dados, subjectId, duration = 60) {
    const p = dados.planning;
    const novo = { id: uid(), subjectId: String(subjectId).toLowerCase(), duration: Math.max(15, +duration || 60) };
    return salvarPlanejamento(dados, { ...p, cycle: [...p.cycle, novo] });
}

function statusRevisao(dados, id, status) {
    return noEstado(dados, fm => {
        for (const r of fm.revisoes || []) if (String(r.id) === id) { r.status = status; r.feita_em = status === "pendente" ? null : new Date().toISOString(); }
    });
}

function alternarTopico(dados, topicId) {
    return noEstado(dados, fm => {
        const s = new Set((fm.topicos_concluidos || []).map(String));
        s.has(topicId) ? s.delete(topicId) : s.add(topicId);
        fm.topicos_concluidos = [...s].sort();
    });
}

const salvarMeta = (dados, minutes, questions) => noEstado(dados, fm => { fm.meta_semanal = { minutos: minutes, questoes: questions }; });
const salvarDataProva = (dados, data) => noEstado(dados, fm => { fm.data_prova = data || null; });

/** Registra um estudo na nota-razão da disciplina e agenda as revisões pedidas. */
async function registrarEstudo(dados, input) {
    const d = dados.porId.get(input.subjectId);
    if (!d) return;
    const path = `${d.pasta}/${d.cod} Estudo ${dados.semestre}.md`;
    const f = app.vault.getAbstractFileByPath(path);
    if (!f) { new Notice(`Nota-razão não encontrada: ${path}`); return; }
    const id = "v" + uid().slice(0, 15);
    const [y, m, dd] = input.date.split("-").map(Number), [hh, mm] = input.time.split(":").map(Number);
    const ini = new Date(y, m - 1, dd, hh, mm), fim = new Date(ini.getTime() + input.duration * 1000);
    const topico = d.topicos.find(t => t.id === input.topicId);
    const e = { startTime: ini.toISOString(), description: [nomeCategoria(input.categoryId), topico?.nome].filter(Boolean).join(" · "),
        endTime: fim.toISOString(), coado: id, categoria: input.categoryId };
    if (input.topicId) e.topico = input.topicId;
    if (input.hits || input.misses) { e.acertos = input.hits; e.erros = input.misses; }
    if (input.countInPlanning === false) e.ciclo = false;
    await app.fileManager.processFrontMatter(f, fm => { fm.timeEntries = [...(fm.timeEntries || []), e]; });
    if (input.reviewIntervals?.length || input.finishTopic) {
        await noEstado(dados, fm => {
            if (input.reviewIntervals?.length) fm.revisoes = [...(fm.revisoes || []), ...input.reviewIntervals.map(n => ({
                id: "v" + uid().slice(0, 15), estudo: id, disciplina: d.cod, topico: input.topicId || null,
                vence: addDays(input.date, n), intervalo: n, status: "pendente", feita_em: null,
            }))];
            if (input.finishTopic && input.topicId) fm.topicos_concluidos = [...new Set([...(fm.topicos_concluidos || []).map(String), input.topicId])].sort();
        });
    }
    if (input.reviewId) await statusRevisao(dados, input.reviewId, "feita");
}

return {
    CATEGORIAS, nomeCategoria, DIAS, DIAS_LONGOS,
    pad, toDateStr, today, parseDate, addDays, diffDays, startOfWeek, startOfMonth, dateRange, weekdayShort, fmtDayMonth, fmtDate,
    fmtDuration, fmtMinutes, fmtHoras, pct, plural, totals, constancy,
    uid, subjectWeight, generateCycle, cycleProgress, weeklySchedule,
    useEstudo, useAvaliacoes, lerTabelaAvaliacoes, abrirNota, abrirAnki, revisarNoAnki, sincronizarCards, salvarPlanejamento, recomecarCiclo, pularSessaoCiclo, moverSessaoCiclo, removerSessaoCiclo, adicionarSessaoCiclo, statusRevisao, alternarTopico, salvarMeta, salvarDataProva, registrarEstudo,
};
