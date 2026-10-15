// ═══════════════════════════════════════════════════════════════════════════════
// DC-GLO-GRAPH v3 - grafo de relações 2D
// Nós coloridos, arestas sólida/tracejada/pontilhada com direção, zoom (roda),
// pan (arrastar o fundo), arrastar nó, destaque da vizinhança, legenda.
//
// Desempenho: canvas desenhado sob demanda (hover, arrasto, pan, zoom). O SVG
// anterior re-renderizava o grafo inteiro a cada hover. Layout em fatias e
// cacheado por conjunto e largura (dc-graphKit), idêntico ao cálculo antigo.
// ═══════════════════════════════════════════════════════════════════════════════

const { useTheme } = await dc.require(dc.fileLink("System/Scripts/Core/dc-themeProvider.jsx"));
const { signature, sim2D, useLayout, fitCanvas, cssColor, DASH, uiFont, useWidth } = await dc.require(dc.fileLink("System/Scripts/Core/dc-graphKit.jsx"));

const TAU = Math.PI * 2;
const trunc = (s, n) => s.length > n ? s.slice(0, n - 1) + "…" : s;

function GloGraph({
    nodes = [], edges = [], height = 420, iterations = 260, legend = null,
    emptyText = "Sem nós para exibir.", onNodeClick = null, onNodeHover = null, style = {},
}) {
    const { theme } = useTheme();
    const wrapRef = dc.useRef(null), canvasRef = dc.useRef(null), anchorRef = dc.useRef(null);
    const vw = useWidth(wrapRef);
    const key = dc.useMemo(() => signature("2d", nodes, edges, `${iterations}:${vw}:${height}`), [nodes, edges, iterations, vw, height]);
    const basePos = useLayout(key, () => sim2D(nodes, edges, vw, height, iterations));

    const st = dc.useRef(null);
    if (!st.current) st.current = { view: { x: 0, y: 0, k: 1 }, dragPos: {}, hover: null, drag: null, moved: false, raf: 0 };
    dc.useEffect(() => { st.current.dragPos = {}; st.current.view = { x: 0, y: 0, k: 1 }; }, [key]);

    const neighbors = dc.useMemo(() => {
        const m = {};
        for (const e of edges) { (m[e.from] = m[e.from] || new Set()).add(e.to); (m[e.to] = m[e.to] || new Set()).add(e.from); }
        return m;
    }, [edges]);
    const accentRaw = theme?.["color-accent"] || "#0099ff";

    const draw = () => {
        const s = st.current, canvas = canvasRef.current;
        s.raf = 0;
        if (!canvas || !basePos) return;
        const host = wrapRef.current;
        const faint = cssColor("var(--text-faint)", host), muted = cssColor("var(--text-muted)", host), normal = cssColor("var(--text-normal)", host);
        const P = (id) => s.dragPos[id] || basePos[id];
        const hover = s.hover, hood = hover ? neighbors[hover] : null;
        const ctx = fitCanvas(canvas, vw, height);
        ctx.clearRect(0, 0, vw, height);
        ctx.save();
        ctx.translate(s.view.x, s.view.y); ctx.scale(s.view.k, s.view.k);
        for (const e of edges) {
            const a = P(e.from), b = P(e.to);
            if (!a || !b) continue;
            const dim = hover && e.from !== hover && e.to !== hover;
            const col = cssColor(e.color || "var(--text-faint)", host);
            ctx.globalAlpha = dim ? 0.12 : 0.75;
            ctx.strokeStyle = col; ctx.lineWidth = hover && !dim ? 2 : 1.1;
            ctx.setLineDash(DASH[e.style || "solid"] || []);
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
            ctx.setLineDash([]);
            if (e.directed) {
                const ang = Math.atan2(b.y - a.y, b.x - a.x), L = 7;
                ctx.fillStyle = faint; ctx.beginPath();
                ctx.moveTo(b.x, b.y);
                ctx.lineTo(b.x - L * Math.cos(ang - 0.42), b.y - L * Math.sin(ang - 0.42));
                ctx.lineTo(b.x - L * Math.cos(ang + 0.42), b.y - L * Math.sin(ang + 0.42));
                ctx.closePath(); ctx.fill();
            }
            if (e.label && hover && !dim) {
                ctx.font = uiFont(canvas, 8); ctx.textAlign = "center"; ctx.fillStyle = muted;
                ctx.fillText(e.label, (a.x + b.x) / 2, (a.y + b.y) / 2 - 3);
            }
        }
        ctx.font = uiFont(canvas, 9); ctx.textAlign = "center";
        for (const n of nodes) {
            const p = P(n.id);
            if (!p) continue;
            const r = n.size || 8, c = cssColor(n.color || accentRaw, host);
            ctx.globalAlpha = hover && n.id !== hover && !(hood && hood.has(n.id)) ? 0.18 : 1;
            ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU);
            if (n.ghost) { ctx.setLineDash([3, 2]); ctx.lineWidth = 1.4; ctx.strokeStyle = faint; ctx.stroke(); ctx.setLineDash([]); }
            else { ctx.fillStyle = c; ctx.fill(); }
            ctx.fillStyle = n.ghost ? faint : normal;
            ctx.fillText(trunc(n.label || n.id, 22), p.x, p.y + r + 10);
        }
        ctx.restore();
        ctx.globalAlpha = 1;
    };
    const redraw = () => { const s = st.current; if (!s.raf) s.raf = requestAnimationFrame(draw); };
    dc.useEffect(() => { redraw(); return () => cancelAnimationFrame(st.current.raf); }, [basePos, vw, height, theme, nodes, edges]);

    const toGraph = (ev) => {
        const r = canvasRef.current.getBoundingClientRect(), v = st.current.view;
        return { x: (ev.clientX - r.left - v.x) / v.k, y: (ev.clientY - r.top - v.y) / v.k };
    };
    const hitAt = (ev) => {
        if (!basePos) return null;
        const g = toGraph(ev), s = st.current;
        for (let i = nodes.length - 1; i >= 0; i--) {
            const n = nodes[i], p = s.dragPos[n.id] || basePos[n.id], r = (n.size || 8) + 2;
            if (p && (p.x - g.x) ** 2 + (p.y - g.y) ** 2 <= r * r) return n;
        }
        return null;
    };
    const hoverEvent = (ev, n) => {
        const a = anchorRef.current, s = st.current;
        if (a && n) {
            const p = s.dragPos[n.id] || basePos[n.id], v = s.view, r = (n.size || 8) * v.k;
            a.style.left = `${v.x + p.x * v.k - r}px`; a.style.top = `${v.y + p.y * v.k - r}px`; a.style.width = a.style.height = `${r * 2}px`;
        }
        return { ctrlKey: ev.ctrlKey, metaKey: ev.metaKey, shiftKey: ev.shiftKey, clientX: ev.clientX, clientY: ev.clientY, nativeEvent: ev, currentTarget: a, target: a };
    };

    const onPointerDown = (ev) => {
        const s = st.current, n = hitAt(ev);
        canvasRef.current.setPointerCapture?.(ev.pointerId);
        s.moved = false;
        s.drag = n ? { id: n.id } : { pan: true, x: ev.clientX, y: ev.clientY, ox: s.view.x, oy: s.view.y };
    };
    const onPointerMove = (ev) => {
        const s = st.current, d = s.drag;
        if (d) {
            s.moved = true;
            if (d.id) s.dragPos = { ...s.dragPos, [d.id]: toGraph(ev) };
            else { s.view.x = d.ox + (ev.clientX - d.x); s.view.y = d.oy + (ev.clientY - d.y); }
            redraw();
            return;
        }
        const n = hitAt(ev), id = n ? n.id : null;
        if (id !== s.hover) {
            s.hover = id;
            canvasRef.current.style.cursor = id ? "pointer" : "default";
            canvasRef.current.title = id ? (n.label || id) : "";
            redraw();
        }
        if (onNodeHover && (id || s.hoverNotified)) { onNodeHover(id, hoverEvent(ev, n)); s.hoverNotified = !!id; }
    };
    const onPointerUp = (ev) => {
        const s = st.current, d = s.drag, wasDrag = s.moved;
        s.drag = null;
        if (d?.id && !wasDrag && onNodeClick) onNodeClick(d.id);
    };
    const onWheel = (ev) => {
        ev.preventDefault();
        const v = st.current.view;
        v.k = Math.max(0.4, Math.min(4, v.k * (ev.deltaY < 0 ? 1.15 : 1 / 1.15)));
        redraw();
    };

    if (!nodes.length) return <p style={{ opacity: 0.5 }}>{emptyText}</p>;

    return (
        <div ref={wrapRef} style={{ width: "100%", ...style }}>
            <div style={{ position: "relative", width: "100%", height: `${height}px` }}>
                <canvas ref={canvasRef}
                    onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
                    onPointerLeave={(ev) => { const s = st.current; if (s.hover) { s.hover = null; redraw(); if (onNodeHover) onNodeHover(null, hoverEvent(ev, null)); s.hoverNotified = false; } }}
                    onWheel={onWheel}
                    style={{ width: "100%", height: `${height}px`, display: "block", background: "var(--background-primary-alt)", borderRadius: "8px", border: "1px solid var(--background-modifier-border)", touchAction: "none" }} />
                <div ref={anchorRef} style={{ position: "absolute", pointerEvents: "none", width: 0, height: 0 }} />
                {!basePos && (
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.5, fontSize: "0.85em", pointerEvents: "none" }}>Montando o grafo…</div>
                )}
            </div>
            {legend && (
                <div style={{ display: "flex", gap: "14px", flexWrap: "wrap", marginTop: "6px", fontSize: "0.75em", opacity: 0.75 }}>
                    {legend.map((l, i) => (
                        <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                            {l.style
                                ? <svg width="22" height="8"><line x1="1" y1="4" x2="21" y2="4" stroke={l.color || "var(--text-faint)"} strokeWidth="2" strokeDasharray={(DASH[l.style] || []).join(" ") || "none"} /></svg>
                                : <span style={{ width: "9px", height: "9px", borderRadius: "50%", background: l.color, display: "inline-block" }} />}
                            {l.label}
                        </span>
                    ))}
                    <span style={{ opacity: 0.6 }}>· roda = zoom · arraste o fundo = pan · arraste um nó = reposicionar</span>
                </div>
            )}
        </div>
    );
}

function renderedView() {
    const nodes = [
        { id: "a", label: "Nota A" }, { id: "b", label: "Nota B" }, { id: "c", label: "Nota C" }, { id: "d", label: "Externa", ghost: true },
    ];
    const edges = [
        { from: "a", to: "b" },
        { from: "b", to: "c", style: "dashed", directed: true, label: "supersedes" },
        { from: "a", to: "d", style: "dotted", label: "related" },
    ];
    return <GloGraph nodes={nodes} edges={edges} height={300} legend={[{ style: "dashed", label: "supersedes" }]} />;
}

return { GloGraph, renderedView };
