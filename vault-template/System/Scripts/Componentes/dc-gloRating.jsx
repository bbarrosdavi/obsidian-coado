// ═══════════════════════════════════════════════════════════════════════════════
// DC-GLO-RATING v3 - avaliação de 1 a N com a forma do emoji, desenhada chapada
// Formas (prop `shape`): "star", "face", "bolt", "moon", "dot". Mesmo tamanho e
// comportamento das avaliações originais com emoji: glifo de 15 px numa célula de
// 22 px, aceso a 65% na cor da atividade, vazio como "○" a 20%, o mouse só cresce
// o glifo (120%). Sem brilho nem degradê. Hover em CSS (ordem invertida no DOM).
// Clique no marcador já marcado zera a avaliação só se `clearable`.
// ═══════════════════════════════════════════════════════════════════════════════

const { useTheme } = await dc.require(dc.fileLink("System/Scripts/Core/dc-themeProvider.jsx"));
const { useComponentCSS } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloButton.jsx"));

// Contornos de 24x24, preenchidos com a cor corrente (forma chapada).
const ON = {
    star: () => <path d="M12 2.4l2.95 6.1 6.7.9-4.9 4.65 1.22 6.65L12 17.4l-5.97 3.3 1.22-6.65L2.35 9.4l6.7-.9z" fill="currentColor" />,
    bolt: () => <path d="M13.8 1.8 4.4 13.6h6.3l-1.4 8.6 9.5-11.9h-6.4z" fill="currentColor" />,
    moon: () => <path d="M20 15.2A9 9 0 0 1 8.8 4a9 9 0 1 0 11.2 11.2z" fill="currentColor" />,
    face: () => (
        <g>
            <path fillRule="evenodd" fill="currentColor" d="M12 2.2a9.8 9.8 0 1 1 0 19.6a9.8 9.8 0 1 1 0-19.6zM8.7 8.5a1.35 1.35 0 1 0 0 2.7a1.35 1.35 0 1 0 0-2.7zM15.3 8.5a1.35 1.35 0 1 0 0 2.7a1.35 1.35 0 1 0 0-2.7zM7.3 13.6c1 2.4 2.7 3.6 4.7 3.6s3.7-1.2 4.7-3.6z" />
        </g>
    ),
    dot: () => <circle cx="12" cy="12" r="8" fill="currentColor" />,
};
// "○" do original para o marcador vazio.
const OFF = () => <circle cx="12" cy="12" r="7.6" fill="none" stroke="currentColor" strokeWidth="1.6" />;

function GloRating({ value = 0, max = 5, onChange = null, color = null, size = 15, label = null, showValue = true, clearable = false, readOnly = false, shape = "dot", style = {} }) {
    useComponentCSS();
    const { theme } = useTheme();
    const c = color || theme["color-primary"] || "var(--interactive-accent)";
    const v = Number(value) || 0;
    const ro = readOnly || !onChange;
    const pick = (i) => { if (!ro) onChange(clearable && i === v ? 0 : i); };
    const glyph = ON[shape] || ON.dot;
    const pips = [];
    for (let i = max; i >= 1; i--) {
        pips.push(
            <span key={i} className="dcg-pip" data-on={i <= v ? "" : undefined} title={String(i)} onClick={() => pick(i)}>
                <svg viewBox="0 0 24 24" className="on">{glyph()}</svg>
                <svg viewBox="0 0 24 24" className="off">{OFF()}</svg>
            </span>
        );
    }
    const cell = Math.round(size * 22 / 15);
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between", width: "100%", ...style }}>
            {label && <span style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>}
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                <div className="dcg-rate" data-ro={ro ? "" : undefined} style={{ "--rate-c": c, "--pip": `${size}px`, "--cell": `${cell}px` }}>{pips}</div>
                {showValue && <span style={{ fontSize: 13, fontWeight: 700, color: v ? c : "var(--text-muted)", width: 16, textAlign: "right", whiteSpace: "nowrap" }}>{v || "-"}</span>}
            </div>
        </div>
    );
}

const renderedView = (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, maxWidth: 320, padding: "1rem" }}>
        <GloRating label="Qualidade do sono" shape="star" value={4} />
        <GloRating label="Humor" shape="face" value={3} />
        <GloRating label="Energia" shape="bolt" value={2} />
        <GloRating label="Humor noturno" shape="moon" value={5} color="#A29BFE" />
    </div>
);

return { GloRating, renderedView };
