// ═══════════════════════════════════════════════════════════════════════════════
// RANDOM QUOTE v2 (Citação do dia)
// Sorteia uma nota com categoria "Quote"/"Quotes" (fora templates) e mostra o
// texto sem frontmatter, com a atribuição (`attribution`) e o nome da nota.
// Usado pelas notas diárias como Func({ currentFile, scriptPath }).
// Mudanças: consulta só páginas com `categories` (antes, a vault inteira em
// cada uma das 166 notas diárias); sorteio estável por bloco; sem emojis.
// ═══════════════════════════════════════════════════════════════════════════════

const { gate } = await dc.require(dc.fileLink("System/Scripts/Core/dc-visibleGate.jsx"));

const asArray = (v) => Array.isArray(v) ? v : v ? [v] : [];

function QuoteViewReal() {
    const pages = dc.useQuery("@page and exists(categories)");
    const quotes = dc.useMemo(() => pages.filter(p => !(p.$name || "").includes("Template") && asArray(p.value("categories")).some(c => c && String(c).toLowerCase().includes("quote"))), [pages]);
    const [quote, setQuote] = dc.useState(null);

    dc.useEffect(() => {
        if (!quotes.length || quote) return;
        const note = quotes[Math.floor(Math.random() * quotes.length)];
        const raw = note.value("attribution");
        const author = raw?.fileName ? raw.fileName() : (raw || "Desconhecido");
        const file = app.vault.getFileByPath(note.$path);
        if (!file) { setQuote({ text: "Arquivo não encontrado.", author: "Sistema" }); return; }
        app.vault.cachedRead(file)
            .then(c => setQuote({ text: c.replace(/^---[\s\S]+?---/, "").trim(), author, noteName: note.$name, path: note.$path }))
            .catch(e => { console.error("[dc-randomQuote]", e); setQuote({ text: "Erro ao ler o arquivo.", author: "Sistema" }); });
    }, [quotes]);

    if (!quotes.length) return (
        <div style={{ opacity: 0.7, padding: "8px 12px", border: "1px dashed var(--text-muted)", borderRadius: 8, fontSize: 13 }}>
            Nenhuma citação encontrada (notas com categoria Quotes; {pages.length} notas com categoria verificadas).
        </div>
    );
    if (!quote) return <div style={{ opacity: 0.5, fontSize: 13 }}>Lendo citação...</div>;

    return (
        <div style={{ marginTop: 10, background: "var(--background-secondary)", padding: "16px 20px", borderRadius: 8, boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
            <div style={{ fontWeight: 700, textTransform: "uppercase", fontSize: 11, letterSpacing: 1, opacity: 0.7, marginBottom: 10 }}>Citação do dia</div>
            <div style={{ fontSize: "1.1em", lineHeight: 1.6, fontStyle: "italic", marginBottom: 14, fontFamily: "var(--font-text)", whiteSpace: "pre-wrap" }}>"{quote.text}"</div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: "0.85em", color: "var(--text-muted)", borderTop: "1px solid var(--background-modifier-border)", paddingTop: 8 }}>
                <span>— {quote.author}</span>
                {quote.noteName && <span className="dcg-link" style={{ opacity: 0.5, fontSize: "0.85em", cursor: "pointer" }} title="Nota de origem" onClick={() => app.workspace.openLinkText(quote.path, "", false)}>{quote.noteName}</span>}
            </div>
        </div>
    );
}

const QuoteView = gate(QuoteViewReal);
return { Func: QuoteView, QuoteView };
