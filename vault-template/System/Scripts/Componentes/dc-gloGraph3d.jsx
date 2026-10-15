// ═══════════════════════════════════════════════════════════════════════════════
// DC-GLO-GRAPH-3D v3 - grafo de relações em 3 eixos, projeção perspectiva
//
// Funcionamento do mapa de memória da Hina, cores 100% do tema:
//   • topologia livre ou núcleo→hubs→nós (pin: "core" | "hub")
//   • halo + brilho por nó, flutuação e pulso por fase (até 34 nós)
//   • opacidade por nó (confiança), anel de frescor, esmaecimento por profundidade
//   • rótulos por nível de detalhe; hover acende a vizinhança e apaga o resto
//
// Desempenho (medido em 2026-10-12, DASHBOARD_Mechabrain, 392 nós):
//   • Desenho em canvas. O SVG anterior escrevia setAttribute em ~1000
//     elementos por quadro; cada escrita passava pelo motor de estilo e layout
//     (~7 ms de estilo + ~6,5 ms de layout por quadro, parado).
//   • O laço só roda com o grafo na viewport e a aba visível; sem rotação,
//     arrasto, hover ou flutuação ele não redesenha.
//   • Layout calculado em fatias e cacheado por conjunto (dc-graphKit): sem a
//     tarefa longa de 0,4 a 1,8 s na abertura, e grátis ao reabrir.
// ═══════════════════════════════════════════════════════════════════════════════

const { useTheme } = await dc.require(dc.fileLink("System/Scripts/Core/dc-themeProvider.jsx"));
const { signature, sim3D, useLayout, fitCanvas, cssColor, DASH, uiFont, useWidth, useOnScreen } = await dc.require(dc.fileLink("System/Scripts/Core/dc-graphKit.jsx"));

function isDarkHex(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ""));
    if (!m) return true;
    const v = parseInt(m[1], 16);
    return (0.2126 * ((v >> 16) & 255) + 0.7152 * ((v >> 8) & 255) + 0.0722 * (v & 255)) / 255 < 0.5;
}
const trunc = (s, n) => s.length > n ? s.slice(0, n - 1) + "…" : s;
const TAU = Math.PI * 2;

function GloGraph3D({
    nodes = [], edges = [], height = 460, iterations = 220, autoRotate = true, fov = 520,
    background = null, legend = null, emptyText = "Sem nós para exibir.",
    onNodeClick = null, onNodeHover = null, style = {},
}) {
    const { theme } = useTheme();
    const wrapRef = dc.useRef(null), canvasRef = dc.useRef(null), anchorRef = dc.useRef(null);
    const vw = useWidth(wrapRef);
    const screen = useOnScreen(canvasRef);

    const key = dc.useMemo(() => signature("3d", nodes, edges, iterations), [nodes, edges, iterations]);
    const world = useLayout(key, () => sim3D(nodes, edges, iterations));

    const heavy = nodes.length > 34;
    const accentRaw = theme?.["color-accent"] || "var(--interactive-accent)";
    const themeBg = theme?.["color-background"] || null, themeSurface = theme?.["color-surface"] || null;
    const dark = isDarkHex(themeBg);
    const bg = background || (themeBg
        ? `radial-gradient(ellipse at center, ${themeSurface || themeBg} 0%, ${themeBg} 85%)`
        : "radial-gradient(ellipse at center, var(--background-primary-alt), var(--background-primary))");

    const neighbors = dc.useMemo(() => {
        const m = {};
        for (const e of edges) { (m[e.from] = m[e.from] || new Set()).add(e.to); (m[e.to] = m[e.to] || new Set()).add(e.from); }
        return m;
    }, [edges]);

    // Zoom inicial que enquadra o grafo (mesmo cálculo do original).
    const fitZoom = dc.useMemo(() => {
        if (!world) return 1;
        const cy = Math.cos(0.5), sy = Math.sin(0.5), cx = Math.cos(-0.3), sx = Math.sin(-0.3);
        let maxX = 1, maxY = 1;
        for (const n of nodes) {
            const w = world[n.id]; if (!w) continue;
            const x1 = w.x * cy + w.z * sy, z1 = -w.x * sy + w.z * cy, y2 = w.y * cx - z1 * sx, z2 = w.y * sx + z1 * cx, f = fov / (fov + z2);
            maxX = Math.max(maxX, Math.abs(x1 * f)); maxY = Math.max(maxY, Math.abs(y2 * f));
        }
        return Math.max(0.4, Math.min(3.5, Math.min((vw * 0.46) / maxX, (height * 0.46) / maxY)));
    }, [world, height, fov, vw]);

    const view = dc.useRef(null);
    if (!view.current) view.current = { rot: { rx: -0.3, ry: 0.5 }, zoom: 1, spinning: autoRotate, hover: null, drag: null, moved: false, dirty: true, proj: [] };
    dc.useEffect(() => { view.current.zoom = fitZoom; view.current.dirty = true; }, [fitZoom]);
    const [spinLabel, setSpinLabel] = dc.useState(autoRotate);

    // Cores resolvidas uma vez por tema (o canvas não entende var()).
    const colors = dc.useMemo(() => {
        const host = wrapRef.current;
        return {
            accent: cssColor(accentRaw, host),
            text: cssColor(theme?.["color-text"] || "var(--text-normal)", host),
            faint: cssColor(theme?.["color-text-faint"] || "var(--text-faint)", host),
            of: (c) => cssColor(c || accentRaw, host),
        };
    }, [theme, accentRaw, wrapRef.current]);

    // ── laço de desenho ────────────────────────────────────────────────────
    dc.useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !world) return;
        const st = view.current;
        st.dirty = true;
        const nodeColor = nodes.map(n => colors.of(n.color));
        const edgeColor = edges.map(e => colors.of(e.color));
        const blend = heavy ? "source-over" : (dark ? "screen" : "multiply");
        const fontCache = {};
        const fontFor = (px) => fontCache[px] || (fontCache[px] = uiFont(canvas, px));
        let raf = 0, frame = 0;

        // Modo pesado: nó (brilho + círculo + anel) e rótulo pré-desenhados em
        // bitmaps; por quadro só drawImage escalado. A opacidade do nó vira
        // globalAlpha do bitmap inteiro, como a opacidade de grupo do SVG antigo.
        const SS = Math.max(2, (window.devicePixelRatio || 1) * 2.5);
        const sprites = new Map(), labels = new Map();
        const spriteFor = (n, c) => {
            const r = n.size || 8, ring = n.ghost ? 0 : Math.round((n.ring || 0) * 20) / 20;
            const k = `${c}|${r}|${ring}|${n.ghost ? 1 : 0}`;
            let sp = sprites.get(k);
            if (sp) return sp;
            const R = Math.max(n.ghost ? r + 1 : r * 1.9, ring > 0.02 ? r * 1.55 + (1 + ring) : 0) + 1;
            const size = Math.ceil(R * 2 * SS);
            const oc = document.createElement("canvas"); oc.width = oc.height = size;
            const o = oc.getContext("2d");
            o.translate(size / 2, size / 2); o.scale(SS, SS);
            if (!n.ghost) { o.globalAlpha = 0.13; o.fillStyle = c; o.beginPath(); o.arc(0, 0, r * 1.9, 0, TAU); o.fill(); }
            o.globalAlpha = 1; o.beginPath(); o.arc(0, 0, r, 0, TAU);
            if (n.ghost) { o.setLineDash([3, 2]); o.lineWidth = 1.2; o.strokeStyle = colors.faint; o.stroke(); }
            else { o.fillStyle = c; o.fill(); }
            if (ring > 0.02) { o.globalAlpha = 0.1 + 0.5 * ring; o.lineWidth = 1 + ring; o.strokeStyle = c; o.beginPath(); o.arc(0, 0, r * 1.55, 0, TAU); o.stroke(); }
            sp = { img: oc, R };
            sprites.set(k, sp);
            return sp;
        };
        const labelFor = (n) => {
            const px = n.pin ? 10.5 : 9, txt = trunc(n.label || n.id, 20), col = n.ghost ? colors.faint : colors.text;
            const k = `${px}|${col}|${txt}`;
            let lb = labels.get(k);
            if (lb) return lb;
            const m = document.createElement("canvas").getContext("2d");
            m.font = fontFor(px);
            const w = Math.ceil(m.measureText(txt).width) + 4, h = Math.ceil(px * 1.5);
            const oc = document.createElement("canvas"); oc.width = Math.ceil(w * SS); oc.height = Math.ceil(h * SS);
            const o = oc.getContext("2d");
            o.scale(SS, SS); o.font = fontFor(px); o.textAlign = "center"; o.textBaseline = "alphabetic"; o.fillStyle = col;
            o.fillText(txt, w / 2, px * 1.1);
            lb = { img: oc, w, h, base: px * 1.1 };
            labels.set(k, lb);
            return lb;
        };

        const draw = () => {
            const t = performance.now() / 1000;
            if (st.spinning && !st.drag && !st.hover) st.rot.ry += heavy ? 0.006 : 0.012;
            const cy = Math.cos(st.rot.ry), sy = Math.sin(st.rot.ry), cx = Math.cos(st.rot.rx), sx = Math.sin(st.rot.rx);
            const P = new Array(nodes.length);
            for (let i = 0; i < nodes.length; i++) {
                const n = nodes[i], w = world[n.id];
                if (!w) continue;
                const yy = w.y + ((n.pin || heavy) ? 0 : Math.sin(t * 1.3 + i * 0.7) * 3.2);
                const x1 = w.x * cy + w.z * sy, z1 = -w.x * sy + w.z * cy, y2 = yy * cx - z1 * sx, z2 = yy * sx + z1 * cx;
                const f = (fov / (fov + z2)) * st.zoom;
                P[i] = { i, x: vw / 2 + x1 * f, y: height / 2 + y2 * f, f, depth: z2 };
            }
            const byId = {};
            for (const p of P) if (p) byId[nodes[p.i].id] = p;
            const fade = (d) => Math.max(0.22, Math.min(1, 1 - d / (fov * 0.9)));
            const hover = st.hover, hood = hover ? neighbors[hover] : null;

            const ctx = fitCanvas(canvas, vw, height);
            ctx.clearRect(0, 0, vw, height);
            ctx.lineWidth = 1;
            // arestas
            ctx.globalCompositeOperation = blend;
            for (let k = 0; k < edges.length; k++) {
                const e = edges[k], a = byId[e.from], b = byId[e.to];
                if (!a || !b) continue;
                const dim = hover && e.from !== hover && e.to !== hover;
                ctx.globalAlpha = dim ? 0.05 : 0.5 * Math.min(fade(a.depth), fade(b.depth));
                ctx.strokeStyle = edgeColor[k];
                ctx.setLineDash(DASH[e.style || "solid"] || []);
                ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
            }
            ctx.setLineDash([]);
            // nós, de trás para a frente
            const order = P.filter(Boolean).sort((p, q) => q.depth - p.depth);
            st.proj = order;
            for (const p of order) {
                const n = nodes[p.i], c = nodeColor[p.i];
                const hovered = hover === n.id;
                const dim = hover && !hovered && !(hood && hood.has(n.id));
                const pulse = (n.pin || heavy) ? 1 : 1 + Math.sin(t * 2 + p.i * 0.7) * 0.06;
                const s = p.f * pulse * (hovered ? 1.4 : 1);
                const alpha = (dim ? 0.1 : fade(p.depth)) * (n.opacity != null ? n.opacity : 1);
                const r = n.size || 8, ring = n.ring != null ? n.ring : 0;
                p.hitR = r * s * 1.25;
                if (heavy) {
                    const sp = spriteFor(n, c), D = sp.R * 2 * s;
                    ctx.globalAlpha = alpha;
                    ctx.drawImage(sp.img, p.x - D / 2, p.y - D / 2, D, D);
                    if (n.pin || p.f > 0.8 || hovered) {
                        const lb = labelFor(n);
                        ctx.drawImage(lb.img, p.x - (lb.w * s) / 2, p.y + (r + 11 - lb.base) * s, lb.w * s, lb.h * s);
                    }
                    continue;
                }
                ctx.save();
                ctx.translate(p.x, p.y); ctx.scale(s, s);
                ctx.globalCompositeOperation = blend;
                if (!n.ghost && !heavy) { ctx.globalAlpha = alpha * 0.05; ctx.fillStyle = c; ctx.beginPath(); ctx.arc(0, 0, r * 3.2, 0, TAU); ctx.fill(); }
                if (!n.ghost) { ctx.globalAlpha = alpha * 0.13; ctx.fillStyle = c; ctx.beginPath(); ctx.arc(0, 0, r * 1.9, 0, TAU); ctx.fill(); }
                ctx.globalCompositeOperation = "source-over";
                ctx.globalAlpha = alpha;
                ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU);
                if (n.ghost) { ctx.setLineDash([3, 2]); ctx.lineWidth = 1.2; ctx.strokeStyle = colors.faint; ctx.stroke(); ctx.setLineDash([]); }
                else { ctx.fillStyle = c; ctx.fill(); }
                if (ring > 0.02 && !n.ghost) {
                    ctx.globalCompositeOperation = blend;
                    ctx.globalAlpha = alpha * (0.1 + 0.5 * ring); ctx.lineWidth = 1 + ring; ctx.strokeStyle = c;
                    ctx.beginPath(); ctx.arc(0, 0, r * 1.55, 0, TAU); ctx.stroke();
                    ctx.globalCompositeOperation = "source-over";
                }
                if (n.pin || p.f > 0.8 || hovered) {
                    ctx.globalAlpha = alpha;
                    ctx.font = fontFor(n.pin ? 10.5 : 9); ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
                    ctx.fillStyle = n.ghost ? colors.faint : colors.text;
                    ctx.fillText(trunc(n.label || n.id, 20), 0, r + 11);
                }
                ctx.restore();
            }
            ctx.globalAlpha = 1;
            st.dirty = false;
        };

        const tick = () => {
            raf = 0;
            if (document.hidden || !screen.current.inView || !canvas.isConnected) return;   // dorme até a viewport acordar
            frame++;
            const animating = st.spinning || st.drag || !heavy;   // flutuação/pulso só sem o modo pesado
            if (animating && frame % (heavy ? 3 : 2) === 0) draw();
            else if (st.dirty) draw();
            if (animating || st.dirty) raf = requestAnimationFrame(tick);
        };
        const wake = () => { st.dirty = true; if (!raf) raf = requestAnimationFrame(tick); };
        screen.current.wake = wake;
        st.wake = wake;
        const onVis = () => { if (!document.hidden) wake(); };
        document.addEventListener("visibilitychange", onVis);
        wake();
        return () => { cancelAnimationFrame(raf); raf = 0; document.removeEventListener("visibilitychange", onVis); screen.current.wake = null; st.wake = null; };
    }, [world, vw, height, fov, neighbors, colors, heavy, dark, nodes, edges]);

    // ── interação ──────────────────────────────────────────────────────────
    const hitAt = (ev) => {
        const r = canvasRef.current.getBoundingClientRect();
        const x = ev.clientX - r.left, y = ev.clientY - r.top;
        const proj = view.current.proj;
        for (let k = proj.length - 1; k >= 0; k--) {   // da frente para trás
            const p = proj[k];
            if ((p.x - x) ** 2 + (p.y - y) ** 2 <= (p.hitR || 8) ** 2) return p;
        }
        return null;
    };
    const hoverEvent = (ev, p) => {
        const a = anchorRef.current;
        if (a && p) { a.style.left = `${p.x - p.hitR}px`; a.style.top = `${p.y - p.hitR}px`; a.style.width = a.style.height = `${p.hitR * 2}px`; }
        return { ctrlKey: ev.ctrlKey, metaKey: ev.metaKey, shiftKey: ev.shiftKey, clientX: ev.clientX, clientY: ev.clientY, nativeEvent: ev, currentTarget: a, target: a };
    };
    const setHover = (id, ev, p) => {
        const st = view.current;
        if (st.hover !== id) { st.hover = id; st.wake?.(); if (canvasRef.current) { canvasRef.current.style.cursor = id ? "pointer" : (st.drag ? "grabbing" : "grab"); canvasRef.current.title = id ? (nodes.find(n => n.id === id)?.label || id) : ""; } }
        if (onNodeHover) onNodeHover(id, hoverEvent(ev, p));
    };

    const onPointerDown = (ev) => {
        const st = view.current;
        st.drag = { x: ev.clientX, y: ev.clientY, rx: st.rot.rx, ry: st.rot.ry, pid: ev.pointerId };
        st.moved = false;
        canvasRef.current.setPointerCapture?.(ev.pointerId);
        if (st.spinning) { st.spinning = false; setSpinLabel(false); }
        st.wake?.();
    };
    const onPointerMove = (ev) => {
        const st = view.current;
        if (st.drag) {
            if (Math.abs(ev.clientX - st.drag.x) + Math.abs(ev.clientY - st.drag.y) > 2) st.moved = true;
            st.rot.ry = st.drag.ry - (ev.clientX - st.drag.x) * 0.009;
            st.rot.rx = Math.max(-1.4, Math.min(1.4, st.drag.rx + (ev.clientY - st.drag.y) * 0.009));
            st.dirty = true;
            return;
        }
        const p = hitAt(ev);
        const id = p ? nodes[p.i].id : null;
        if (id || st.hover) setHover(id, ev, p);
    };
    const onPointerUp = (ev) => {
        const st = view.current;
        const wasDrag = st.moved;
        st.drag = null;
        if (!wasDrag && onNodeClick) { const p = hitAt(ev); if (p) onNodeClick(nodes[p.i].id); }
        st.wake?.();
    };
    const onWheel = (ev) => {
        ev.preventDefault();
        const st = view.current;
        st.zoom = Math.max(0.4, Math.min(3.5, st.zoom * (ev.deltaY < 0 ? 1.12 : 1 / 1.12)));
        st.wake?.();
    };

    if (!nodes.length) return <p style={{ opacity: 0.5 }}>{emptyText}</p>;

    return (
        <div ref={wrapRef} style={{ width: "100%", ...style }}>
            <div style={{ position: "relative", width: "100%", height: `${height}px` }}>
                <canvas ref={canvasRef}
                    onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
                    onPointerLeave={(ev) => { if (view.current.hover) setHover(null, ev, null); }}
                    onWheel={onWheel}
                    style={{ width: "100%", height: `${height}px`, display: "block", background: bg, borderRadius: "8px", border: "1px solid var(--background-modifier-border)", touchAction: "none", cursor: "grab" }} />
                <div ref={anchorRef} style={{ position: "absolute", pointerEvents: "none", width: 0, height: 0 }} />
                {!world && (
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.5, fontSize: "0.85em", pointerEvents: "none" }}>Montando o grafo…</div>
                )}
            </div>
            <div style={{ display: "flex", gap: "14px", flexWrap: "wrap", marginTop: "6px", fontSize: "0.75em", opacity: 0.75, alignItems: "center" }}>
                {(legend || []).map((l, i) => (
                    <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                        {l.style
                            ? <svg width="22" height="8"><line x1="1" y1="4" x2="21" y2="4" stroke={l.color || accentRaw} strokeWidth="2" strokeDasharray={(DASH[l.style] || []).join(" ") || "none"} /></svg>
                            : <span style={{ width: "9px", height: "9px", borderRadius: "50%", background: l.color, display: "inline-block" }} />}
                        {l.label}
                    </span>
                ))}
                <span style={{ opacity: 0.6 }}>· arraste = orbitar · roda = zoom</span>
                <a style={{ cursor: "pointer", opacity: 0.7 }} onClick={() => {
                    const st = view.current;
                    st.spinning = !st.spinning;
                    setSpinLabel(st.spinning);
                    st.wake?.();
                }}>{spinLabel ? "pausar" : "girar"}</a>
            </div>
        </div>
    );
}

function renderedView() {
    const nodes = [
        { id: "core", label: "núcleo", size: 15, pin: "core" },
        { id: "h1", label: "hub A", size: 11, pin: "hub" },
        { id: "h2", label: "hub B", size: 11, pin: "hub" },
        ...Array.from({ length: 10 }, (_, i) => ({ id: `n${i}`, label: `Nó ${i}`, size: 6 + (i % 3), opacity: 0.5 + (i % 5) * 0.12, ring: (i % 4) / 4 })),
    ];
    const edges = [
        { from: "core", to: "h1", rest: 60 }, { from: "core", to: "h2", rest: 60 },
        ...nodes.slice(3).map((n, i) => ({ from: i % 2 ? "h1" : "h2", to: n.id, rest: 55 })),
    ];
    return <GloGraph3D nodes={nodes} edges={edges} height={340} />;
}

return { GloGraph3D, renderedView };
