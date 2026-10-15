// ═══════════════════════════════════════════════════════════════════════════════
// DC-GRAPH-KIT - peças compartilhadas pelos grafos (GloGraph 2D e GloGraph3D)
//
// - Layout por simulação de forças, calculado em fatias (~10 ms por fatia)
//   para não travar a interface, com cache por assinatura do conjunto de nós e
//   arestas: na janela (vale para todos os blocos da sessão) e no localStorage
//   (vale entre sessões). O resultado é idêntico ao cálculo síncrono antigo:
//   mesmas contas, mesma ordem, só em arrays tipados.
// - Canvas com densidade de pixels correta e resolução de cores CSS (var(),
//   nomes, rgb) para o contexto 2D, que não entende var().
// ═══════════════════════════════════════════════════════════════════════════════

const STORE_PREFIX = "dc-graph-layout:";
const STORE_MAX = 6;
const mem = (window.__dcGraphLayouts = window.__dcGraphLayouts || new Map());

/** Assinatura FNV-1a de ids, arestas e parâmetros que afetam o layout. */
function signature(kind, nodes, edges, extra = "") {
    let h = 0x811c9dc5;
    const add = (s) => { for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } h ^= 124; };
    add(kind); add(String(extra));
    for (const n of nodes) { add(String(n.id)); add(n.pin || ""); }
    for (const e of edges) { add(String(e.from)); add(String(e.to)); add(String(e.rest ?? "")); }
    return `${kind}:${(h >>> 0).toString(36)}:${nodes.length}:${edges.length}`;
}

function loadStored(key) {
    try {
        const raw = localStorage.getItem(STORE_PREFIX + key);
        return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
}
function saveStored(key, value) {
    try {
        const idx = JSON.parse(localStorage.getItem(STORE_PREFIX + "index") || "[]").filter(k => k !== key);
        idx.push(key);
        while (idx.length > STORE_MAX) localStorage.removeItem(STORE_PREFIX + idx.shift());
        localStorage.setItem(STORE_PREFIX + key, JSON.stringify(value));
        localStorage.setItem(STORE_PREFIX + "index", JSON.stringify(idx));
    } catch (e) { /* armazenamento indisponível: só o cache da sessão vale */ }
}

// ── Simulações (geradores: uma iteração por passo) ───────────────────────────

/** Mesma física do simulate3D original (repulsão, molas, gravidade, resfriamento). */
function* sim3D(nodes, edges, iterations) {
    const n = nodes.length, N = Math.max(n, 1);
    const X = new Float64Array(n), Y = new Float64Array(n), Z = new Float64Array(n), G = new Float64Array(n);
    const idx = new Map();
    nodes.forEach((node, i) => {
        idx.set(node.id, i);
        const t = (i + 0.5) / N, phi = Math.acos(1 - 2 * t), theta = i * 2.39996;
        const r = node.pin === "core" ? 0 : node.pin === "hub" ? 55 : 70 + 80 * Math.cbrt(t);
        X[i] = r * Math.sin(phi) * Math.cos(theta); Y[i] = r * Math.sin(phi) * Math.sin(theta); Z[i] = r * Math.cos(phi);
        G[i] = node.pin === "core" ? 0.25 : 0.015;
    });
    const order = nodes.map(nd => idx.get(nd.id));
    const S = [];
    for (const e of edges) { const a = idx.get(e.from), b = idx.get(e.to); if (a !== undefined && b !== undefined) S.push(a, b, e.rest || 95); }
    const REPULSION = 52000, SPRING = 0.03;
    for (let it = 0; it < iterations; it++) {
        const cool = 1 - it / iterations;
        for (let ii = 0; ii < n; ii++) {
            const i = order[ii];
            for (let jj = ii + 1; jj < n; jj++) {
                const j = order[jj];
                let dx = X[i] - X[j], dy = Y[i] - Y[j], dz = Z[i] - Z[j];
                let d2 = dx * dx + dy * dy + dz * dz;
                if (d2 < 1) { dx = 0.5; dy = 0.3; dz = 0.2; d2 = 0.4; }
                const d = Math.sqrt(d2), f = (REPULSION / (d2 * d)) * cool;
                X[i] += dx * f; Y[i] += dy * f; Z[i] += dz * f;
                X[j] -= dx * f; Y[j] -= dy * f; Z[j] -= dz * f;
            }
        }
        for (let k = 0; k < S.length; k += 3) {
            const a = S[k], b = S[k + 1], rest = S[k + 2];
            const dx = X[b] - X[a], dy = Y[b] - Y[a], dz = Z[b] - Z[a];
            const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1, f = (SPRING * (d - rest) * cool) / d;
            X[a] += dx * f; Y[a] += dy * f; Z[a] += dz * f;
            X[b] -= dx * f; Y[b] -= dy * f; Z[b] -= dz * f;
        }
        for (let ii = 0; ii < n; ii++) { const i = order[ii], g = G[i]; X[i] -= X[i] * g; Y[i] -= Y[i] * g; Z[i] -= Z[i] * g; }
        yield;
    }
    const pos = {};
    nodes.forEach(nd => { const i = idx.get(nd.id); pos[nd.id] = { x: X[i], y: Y[i], z: Z[i] }; });
    return pos;
}

/** Mesma física do simulate 2D original (inclui o recorte final às bordas). */
function* sim2D(nodes, edges, width, height, iterations) {
    const n = nodes.length;
    const X = new Float64Array(n), Y = new Float64Array(n);
    const idx = new Map();
    nodes.forEach((node, i) => { idx.set(node.id, i); const r = 30 + 14 * Math.sqrt(i), a = i * 2.39996; X[i] = width / 2 + r * Math.cos(a); Y[i] = height / 2 + r * Math.sin(a); });
    const order = nodes.map(nd => idx.get(nd.id));
    const S = [];
    for (const e of edges) { const a = idx.get(e.from), b = idx.get(e.to); if (a !== undefined && b !== undefined) S.push(a, b); }
    const REPULSION = 2600, SPRING = 0.035, REST = 95, GRAVITY = 0.012;
    for (let it = 0; it < iterations; it++) {
        const cool = 1 - it / iterations;
        for (let ii = 0; ii < n; ii++) {
            const i = order[ii];
            for (let jj = ii + 1; jj < n; jj++) {
                const j = order[jj];
                let dx = X[i] - X[j], dy = Y[i] - Y[j];
                let d2 = dx * dx + dy * dy;
                if (d2 < 1) { dx = (ii - jj) * 0.1 || 0.1; dy = 0.1; d2 = 0.02; }
                const f = (REPULSION / d2) * cool, d = Math.sqrt(d2);
                X[i] += (dx / d) * f; Y[i] += (dy / d) * f;
                X[j] -= (dx / d) * f; Y[j] -= (dy / d) * f;
            }
        }
        for (let k = 0; k < S.length; k += 2) {
            const a = S[k], b = S[k + 1];
            const dx = X[b] - X[a], dy = Y[b] - Y[a], d = Math.sqrt(dx * dx + dy * dy) || 1, f = SPRING * (d - REST) * cool;
            X[a] += (dx / d) * f; Y[a] += (dy / d) * f;
            X[b] -= (dx / d) * f; Y[b] -= (dy / d) * f;
        }
        for (let ii = 0; ii < n; ii++) { const i = order[ii]; X[i] += (width / 2 - X[i]) * GRAVITY; Y[i] += (height / 2 - Y[i]) * GRAVITY; }
        yield;
    }
    const pos = {};
    nodes.forEach(nd => { const i = idx.get(nd.id); pos[nd.id] = { x: Math.max(24, Math.min(width - 24, X[i])), y: Math.max(20, Math.min(height - 24, Y[i])) }; });
    return pos;
}

/**
 * Layout assíncrono e cacheado. Devolve null enquanto calcula.
 * makeGen() cria o gerador de simulação; key é a assinatura do conjunto.
 */
function useLayout(key, makeGen) {
    const [, setLayout] = dc.useState(null);   // só dispara o render; a fonte é o cache
    dc.useEffect(() => {
        let hit = mem.get(key) || loadStored(key);
        if (hit) { mem.set(key, hit); setLayout(hit); return; }
        setLayout(null);
        let alive = true, timer = 0;
        const gen = makeGen();
        const slice = () => {
            if (!alive) return;
            const t0 = performance.now();
            let r;
            do { r = gen.next(); } while (!r.done && performance.now() - t0 < 10);
            if (r.done) { mem.set(key, r.value); saveStored(key, r.value); setLayout(r.value); }
            else timer = setTimeout(slice, 0);
        };
        timer = setTimeout(slice, 0);
        return () => { alive = false; clearTimeout(timer); };
    }, [key]);
    return mem.get(key) || null;
}

// ── Canvas ───────────────────────────────────────────────────────────────────

/** Ajusta o tamanho interno do canvas à densidade de pixels e devolve o contexto. */
function fitCanvas(canvas, w, h) {
    const dpr = window.devicePixelRatio || 1;
    const W = Math.round(w * dpr), H = Math.round(h * dpr);
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
}

/** Resolve uma cor CSS qualquer (var(), nome, rgb) para algo que o canvas entende. */
const colorCache = new Map();
function cssColor(value, host) {
    if (!value) return "transparent";
    if (/^#|^rgb|^hsl/i.test(value)) return value;
    const k = value;
    if (colorCache.has(k)) return colorCache.get(k);
    const probe = document.createElement("span");
    probe.style.color = value;
    probe.style.display = "none";
    (host || document.body).appendChild(probe);
    const out = getComputedStyle(probe).color || value;
    probe.remove();
    colorCache.set(k, out);
    return out;
}

const DASH = { solid: [], dashed: [7, 4], dotted: [2, 4] };

/** Fonte de interface do Obsidian, para o texto desenhado no canvas. */
function uiFont(el, px) {
    const fam = getComputedStyle(el || document.body).fontFamily || "sans-serif";
    return `${px}px ${fam}`;
}

/** Largura real do contêiner, observada (o grafo preenche sem faixas vazias). */
function useWidth(ref, initial = 800) {
    const [w, setW] = dc.useState(initial);
    dc.useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const measure = () => { const v = Math.round(el.clientWidth); if (v > 40) setW(v); };
        measure();
        const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
        ro?.observe(el);
        return () => ro?.disconnect();
    }, []);
    return w;
}

/** true enquanto o elemento estiver na viewport e a aba visível. */
function useOnScreen(ref) {
    const vis = dc.useRef({ inView: true });
    dc.useEffect(() => {
        const el = ref.current;
        if (!el || typeof IntersectionObserver === "undefined") return;
        const io = new IntersectionObserver(es => { for (const e of es) vis.current.inView = e.isIntersecting; vis.current.wake?.(); });
        io.observe(el);
        return () => io.disconnect();
    }, []);
    return vis;
}

return { signature, sim3D, sim2D, useLayout, fitCanvas, cssColor, DASH, uiFont, useWidth, useOnScreen };
