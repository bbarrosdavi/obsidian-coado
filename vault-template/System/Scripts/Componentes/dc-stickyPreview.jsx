// ═══════════════════════════════════════════════════════════════════════════════
// STICKY PREVIEW v2
// Collapsible, sticky-positioned preview wrapper for Theme Studio
// v2: rótulos em pt-BR, sem ícone-emoji por padrão (icon=null), CSS injetado uma
// vez no carregamento do módulo (antes, num efeito: o 1º quadro saía sem estilo).
//
// Features:
//   - Sticky header that stays visible while scrolling
//   - Tap/click header to collapse/expand content
//   - Mobile-first design with 640px breakpoint
//   - Smooth animations for collapse/expand
//   - Works in both desktop (right column) and mobile (top of page) layouts
//
// Usage:
//   const { StickyPreview } = await dc.require(
//       dc.fileLink("System/Scripts/Componentes/dc-stickyPreview.jsx")
//   );
//   <StickyPreview 
//       title="Live Preview" 
//       themeName="nyanCat"
//       primaryColor="#7c3aed"
//   >
//       <ThemePreviewContent theme={myTheme} />
//   </StickyPreview>
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────


// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Inject Sticky Preview CSS
// ─────────────────────────────────────────────────────────────────────────────

function injectStickyPreviewCSS() {
    {
        const styleId = "dc-sticky-preview-css";
        if (!document.getElementById(styleId)) {
            const style = document.createElement("style");
            style.id = styleId;
            style.textContent = `
                /* ═══════════════════════════════════════════════════════════════════
                   STICKY PREVIEW STYLES
                   Mobile-first with 640px breakpoint
                   ═══════════════════════════════════════════════════════════════════ */

                .dc-sticky-preview {
                    display: flex;
                    flex-direction: column;
                    border-radius: 12px;
                    overflow: hidden;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                }

                .dc-sticky-preview-header {
                    position: sticky;
                    top: 0;
                    z-index: 100;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 12px 16px;
                    cursor: pointer;
                    user-select: none;
                    transition: background 0.2s ease;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                    /* Ensure it's always above content */
                    backdrop-filter: blur(8px);
                    -webkit-backdrop-filter: blur(8px);
                }

                .dc-sticky-preview-header:hover {
                    background: rgba(255, 255, 255, 0.05);
                }

                .dc-sticky-preview-header:active {
                    background: rgba(255, 255, 255, 0.08);
                }

                .dc-sticky-preview-title {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 14px;
                    font-weight: 600;
                    margin: 0;
                }

                .dc-sticky-preview-subtitle {
                    font-size: 11px;
                    opacity: 0.6;
                }

                .dc-sticky-preview-toggle {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 11px;
                    opacity: 0.7;
                    transition: opacity 0.2s ease;
                }

                .dc-sticky-preview-header:hover .dc-sticky-preview-toggle {
                    opacity: 1;
                }

                .dc-sticky-preview-arrow {
                    font-size: 10px;
                    transition: transform 0.3s ease;
                }

                .dc-sticky-preview-arrow.collapsed {
                    transform: rotate(-90deg);
                }

                .dc-sticky-preview-content {
                    overflow: hidden;
                    transition: max-height 0.3s ease, opacity 0.2s ease, padding 0.3s ease;
                }

                .dc-sticky-preview-content.expanded {
                    max-height: none;
                    opacity: 1;
                    padding: 16px;
                }

                .dc-sticky-preview-content.collapsed {
                    max-height: 0;
                    opacity: 0;
                    padding: 0 16px;
                }

                /* Touch-friendly: larger tap target on mobile */
                @media (max-width: 640px) {
                    .dc-sticky-preview-header {
                        padding: 14px 16px;
                        min-height: 48px;
                    }

                    .dc-sticky-preview-title {
                        font-size: 13px;
                    }

                    .dc-sticky-preview-toggle {
                        font-size: 12px;
                        padding: 4px 8px;
                        background: rgba(255, 255, 255, 0.1);
                        border-radius: 6px;
                    }
                }
            `;
            document.head.appendChild(style);
        }
    }
}
injectStickyPreviewCSS();
const useStickyPreviewCSS = () => {};   // mantido por compatibilidade de exportação

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT: StickyPreview
// ═══════════════════════════════════════════════════════════════════════════════

function StickyPreview({
    title = "Prévia ao vivo",
    subtitle = null,
    icon = null,
    primaryColor = "#7c3aed",
    surfaceColor = "var(--background-secondary)",
    backgroundColor = "var(--background-primary)",
    textColor = "var(--text-normal)",
    textMuted = "#a0a0b0",
    defaultCollapsed = false,
    onToggle = null,
    children,
    style = {},
    className = "",
}) {
    const [isCollapsed, setIsCollapsed] = dc.useState(defaultCollapsed);
    
    const handleToggle = () => {
        const newState = !isCollapsed;
        setIsCollapsed(newState);
        if (onToggle) {
            onToggle(newState);
        }
    };
    
    return (
        <div 
            className={`dc-sticky-preview ${className}`.trim()}
            style={{
                background: `linear-gradient(180deg, ${surfaceColor}, ${backgroundColor})`,
                borderColor: `${primaryColor}22`,
                ...style,
            }}
        >
            {/* Sticky Header - Always visible, clickable to toggle */}
            <div 
                className="dc-sticky-preview-header"
                onClick={handleToggle}
                style={{
                    background: surfaceColor,
                    borderBottomColor: `${primaryColor}22`,
                }}
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <h3 
                        className="dc-sticky-preview-title"
                        style={{ color: primaryColor }}
                    >
                        {icon && <span>{icon}</span>}
                        <span>{title}</span>
                    </h3>
                    {subtitle && (
                        <span 
                            className="dc-sticky-preview-subtitle"
                            style={{ color: textMuted }}
                        >
                            {subtitle}
                        </span>
                    )}
                </div>
                
                <div 
                    className="dc-sticky-preview-toggle"
                    style={{ color: textMuted }}
                >
                    <span>{isCollapsed ? "Mostrar" : "Ocultar"}</span>
                    <span className={`dc-sticky-preview-arrow ${isCollapsed ? 'collapsed' : ''}`}>
                        ▼
                    </span>
                </div>
            </div>
            
            {/* Collapsible Content */}
            <div 
                className={`dc-sticky-preview-content ${isCollapsed ? 'collapsed' : 'expanded'}`}
                style={{
                    background: 'transparent',
                }}
            >
                {children}
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

const renderedView = (
    <div style={{ padding: '16px', background: '#1e1e2e', borderRadius: '12px' }}>
        <p style={{ color: '#888', fontSize: '12px', marginBottom: '16px' }}>
            Demonstração do StickyPreview
        </p>
        <StickyPreview 
            title="Prévia ao vivo" 
            subtitle="tema nyanCat"
            primaryColor="#ff69b4"
        >
            <div style={{ 
                padding: '20px', 
                background: 'var(--background-secondary-alt, rgba(0,0,0,0.05))', 
                borderRadius: '8px',
                color: '#fff'
            }}>
                <p style={{ margin: 0 }}>Área de conteúdo da prévia.</p>
                <p style={{ margin: '8px 0 0 0', opacity: 0.6, fontSize: '12px' }}>
                    Clique no cabeçalho para recolher ou expandir.
                </p>
            </div>
        </StickyPreview>
    </div>
);

return { 
    renderedView, 
    StickyPreview,
    useStickyPreviewCSS,
};
