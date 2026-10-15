// ═══════════════════════════════════════════════════════════════════════════════
// DC-VISIBLE-GATE - só monta o widget quando o bloco está visível
//
// Por quê: numa aba de nota o Obsidian mantém o modo leitura e o editor Live
// Preview no DOM ao mesmo tempo. Em modo leitura o editor fica oculto, mas os
// blocos datacorejsx dele continuam renderizados: cada widget rodava duas
// vezes (queries, derivações, leitura de arquivos, animação), uma delas numa
// cópia invisível. Medido em 2026-10-12: duas montagens simultâneas do mesmo
// componente, a segunda em .markdown-source-view com offsetParent nulo.
//
// Como: o portão renderiza um <div>. Fora de .markdown-source-view monta os
// filhos na hora; dentro do editor (onde mora a cópia oculta) espera o
// IntersectionObserver confirmar que ficou visível (trocar para o modo edição,
// abrir a aba). Nada de checkVisibility síncrono: forçava layout da página. Depois de
// montado só desmonta se o nó sair do documento: o Obsidian não desmonta o
// conteúdo de um embed quando a aba navega para outra nota (as inscrições no
// índice ficavam vivas e acumulavam a cada visita). A cada atualização do
// índice o portão confere isConnected; desanexado, solta os filhos. Se a seção
// voltar ao documento e ficar visível, o IntersectionObserver monta de novo.
//
// Uso (entrada de widget, acima dos hooks caros):
//   const { gate } = await dc.require(dc.fileLink("System/Scripts/Core/dc-visibleGate.jsx"));
//   const Dashboard = gate(DashboardReal);   // componente com o portão embutido
// ═══════════════════════════════════════════════════════════════════════════════

const isShown = (el) => !!el && el.isConnected && (el.checkVisibility ? el.checkVisibility() : el.offsetParent !== null);

function VisibleGate({ children, style = null, minHeight = null }) {
    const ref = dc.useRef(null);
    const [open, setOpen] = dc.useState(false);
    // Fechado: espera ficar visível.
    dc.useEffect(() => {
        if (open) return;
        const el = ref.current;
        // Fora do editor (leitura, embed): monta já, sem perguntar ao layout.
        // checkVisibility() aqui forçava estilo+layout da página no meio da
        // abertura da nota (74 ms medidos em Settings.md).
        if (!el || !el.closest(".markdown-source-view") || typeof IntersectionObserver === "undefined") { setOpen(true); return; }
        const io = new IntersectionObserver((entries) => {
            if (entries.some(e => e.isIntersecting) || isShown(el)) { io.disconnect(); setOpen(true); }
        });
        io.observe(el);
        return () => io.disconnect();
    }, [open]);
    // Aberto: solta os filhos se o nó for desanexado (embed órfão).
    dc.useEffect(() => {
        if (!open) return;
        const core = app.plugins.plugins.datacore?.core;
        if (!core?.on) return;
        const ref_ = core.on("update", () => { if (ref.current && !ref.current.isConnected) setOpen(false); });
        return () => core.offref(ref_);
    }, [open]);
    return <div ref={ref} className="dc-visible-gate" style={style || (open ? null : { minHeight: minHeight || 1 })}>{open ? children : null}</div>;
}

/** Envolve um componente: o resultado só monta o original quando visível. */
function gate(Component, opts = {}) {
    const Gated = (props) => <VisibleGate minHeight={opts.minHeight} style={opts.style}><Component {...props} /></VisibleGate>;
    Gated.displayName = `Gated(${Component.name || "Widget"})`;
    return Gated;
}

return { VisibleGate, gate, isShown };
