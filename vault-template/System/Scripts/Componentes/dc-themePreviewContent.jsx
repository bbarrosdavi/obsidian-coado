// ═══════════════════════════════════════════════════════════════════════════════
// THEME PREVIEW CONTENT v2
// v2: rótulos em pt-BR, sem emojis no seletor de exemplo; mesmas seções, mesmos
// componentes e as mesmas chaves de prévia no Settings (__preview_*).
// Shared component for displaying live preview of all Glo* components
// Used by both Theme Dashboard and Theme Editor
//
// Features:
//   - Comprehensive preview of all component variations
//   - Accepts theme object to display with custom colors/sprites
//   - Mobile-friendly layout
//   - All interactive demos work (draggable bars, clickable toggles, etc.)
//
// Usage:
//   const { ThemePreviewContent } = await dc.require(
//       dc.fileLink("System/Scripts/Componentes/dc-themePreviewContent.jsx")
//   );
//   <ThemePreviewContent theme={myThemeObject} />
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

const { useComponentCSS } = await dc.require(
    dc.fileLink("System/Scripts/Componentes/dc-gloButton.jsx")
);
const { GloButton } = await dc.require(
    dc.fileLink("System/Scripts/Componentes/dc-gloButton.jsx")
);
const { GloBar } = await dc.require(
    dc.fileLink("System/Scripts/Componentes/dc-gloBar.jsx")
);
const { GloToggle } = await dc.require(
    dc.fileLink("System/Scripts/Componentes/dc-gloToggle.jsx")
);
const { GloBadge } = await dc.require(
    dc.fileLink("System/Scripts/Componentes/dc-gloBadge.jsx")
);
const { GloCard } = await dc.require(
    dc.fileLink("System/Scripts/Componentes/dc-gloCard.jsx")
);
const { GloInput } = await dc.require(
    dc.fileLink("System/Scripts/Componentes/dc-gloInput.jsx")
);
const { GloSelect } = await dc.require(
    dc.fileLink("System/Scripts/Componentes/dc-gloSelect.jsx")
);
const { GloTabs } = await dc.require(
    dc.fileLink("System/Scripts/Componentes/dc-gloTabs.jsx")
);

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER: Preview Section Wrapper
// ═══════════════════════════════════════════════════════════════════════════════

function PreviewSection({ title, color, children }) {
    return (
        <div style={styles.previewSection}>
            <h4 style={{ 
                ...styles.previewSectionTitle, 
                color: color,
                borderBottom: `1px solid ${color}33`
            }}>
                {title}
            </h4>
            {children}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT: ThemePreviewContent
// ═══════════════════════════════════════════════════════════════════════════════

function ThemePreviewContent({ theme, compact = false }) {
    // Load shared CSS for animations
    useComponentCSS();
    
    // Local state for interactive previews
    const [barValue, setBarValue] = dc.useState(65);
    const [inputValue, setInputValue] = dc.useState("");
    const [selectValue, setSelectValue] = dc.useState("option1");
    
    // Extract colors from theme
    const primary = theme["color-primary"] || theme["color-accent"] || "#7c3aed";
    const accent = theme["color-accent"] || "#f59e0b";
    const surface = theme["color-surface"] || "var(--background-secondary)";
    const textMuted = theme["color-text-muted"] || "#a0a0b0";
    const textColor = theme["color-text"] || "var(--text-normal)";
    const success = theme["color-success"] || "#10b981";
    const warning = theme["color-warning"] || "#f59e0b";
    const error = theme["color-error"] || "#ef4444";
    
    // Extract sprite/visual properties from theme for overrides
    const barSprite = theme["bar-sprite"] || null;
    const barSpriteWidth = theme["bar-sprite-width"] || 34;
    const barSpriteHeight = theme["bar-sprite-height"] || 21;
    const barTrackBg = theme["bar-track-bg"] || null;
    const barFillGradient = theme["bar-fill-gradient"] || `linear-gradient(90deg, ${primary}, ${accent})`;
    const barHeight = theme["bar-height"] || "14px";
    const barBorderRadius = theme["bar-border-radius"] || "6px";
    const barClickAnimation = theme["bar-sprite-click-animation"] || "squish";
    
    const toggleSprite = theme["toggle-sprite"] || theme["bar-sprite"] || null;
    const toggleSpriteWidth = theme["toggle-sprite-width"] || theme["bar-sprite-width"] || 34;
    const toggleSpriteHeight = theme["toggle-sprite-height"] || theme["bar-sprite-height"] || 21;
    const toggleIdleBg = theme["toggle-idle-bg"] || null;
    const toggleActiveBg = theme["toggle-active-bg"] || null;
    const toggleClickAnimation = theme["toggle-sprite-click-animation"] || "squish";
    
    const buttonSprite = theme["button-sprite"] || theme["bar-sprite"] || null;
    const buttonSpriteWidth = theme["button-sprite-width"] || theme["bar-sprite-width"] || 34;
    const buttonSpriteHeight = theme["button-sprite-height"] || theme["bar-sprite-height"] || 21;
    const buttonIdleBg = theme["button-idle-bg"] || null;
    const buttonHoverBg = theme["button-hover-bg"] || null;
    const buttonActiveBg = theme["button-active-bg"] || null;
    const buttonClickAnimation = theme["button-sprite-click-animation"] || "bounce";

    return (
        <div style={styles.previewContent}>
            
            {/* ─── COLOR PALETTE ─── */}
            <PreviewSection title="Paleta de cores" color={primary}>
                <div style={styles.colorPalette}>
                    {[
                        { name: "Primária", color: primary },
                        { name: "Destaque", color: accent },
                        { name: "Sucesso", color: success },
                        { name: "Alerta", color: warning },
                        { name: "Erro", color: error },
                        { name: "Superfície", color: surface },
                    ].map(({ name, color }) => (
                        <div key={name} style={styles.paletteItem}>
                            <div style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '6px',
                                background: color,
                                border: '1px solid var(--background-modifier-border, rgba(0,0,0,0.1))'
                            }} />
                            <span style={{ fontSize: '10px', color: textMuted }}>{name}</span>
                        </div>
                    ))}
                </div>
            </PreviewSection>

            {/* ─── PROGRESS BAR ─── */}
            <PreviewSection title="Barra de progresso (GloBar)" color={primary}>
                <GloBar
                    value={barValue}
                    max={100}
                    draggable={true}
                    onChange={setBarValue}
                    showValue={true}
                    label="Progresso arrastável"
                    sprite={barSprite}
                    spriteWidth={barSpriteWidth}
                    spriteHeight={barSpriteHeight}
                    trackBg={barTrackBg}
                    fillGradient={barFillGradient}
                    height={barHeight}
                    borderRadius={barBorderRadius}
                    clickAnimation={barClickAnimation}
                    themeOverride={theme}
                />
            </PreviewSection>

            {/* ─── TOGGLES ─── */}
            <PreviewSection title="Alternador (GloToggle)" color={primary}>
                <div style={styles.toggleRow}>
                    <div style={styles.toggleDemo}>
                        <span style={{ fontSize: '12px', color: textMuted, marginBottom: '8px' }}>Ligado</span>
                        <GloToggle
                            targetKey="__preview_toggle_on"
                            targetFile="System/Settings.md"
                            onLabel={theme["label-active"] || "Ativo"}
                            offLabel={theme["label-inactive"] || "Inativo"}
                            sprite={toggleSprite}
                            spriteWidth={toggleSpriteWidth}
                            spriteHeight={toggleSpriteHeight}
                            idleBg={toggleIdleBg}
                            activeBg={toggleActiveBg}
                            spriteAnimation={toggleClickAnimation}
                            themeOverride={theme}
                        />
                    </div>
                    <div style={styles.toggleDemo}>
                        <span style={{ fontSize: '12px', color: textMuted, marginBottom: '8px' }}>Desligado</span>
                        <GloToggle
                            targetKey="__preview_toggle_off"
                            targetFile="System/Settings.md"
                            onLabel={theme["label-active"] || "Ativo"}
                            offLabel={theme["label-inactive"] || "Inativo"}
                            sprite={toggleSprite}
                            spriteWidth={toggleSpriteWidth}
                            spriteHeight={toggleSpriteHeight}
                            idleBg={toggleIdleBg}
                            activeBg={toggleActiveBg}
                            spriteAnimation={toggleClickAnimation}
                            themeOverride={theme}
                        />
                    </div>
                </div>
            </PreviewSection>

            {/* ─── BUTTONS ─── */}
            <PreviewSection title="Botões (GloButton)" color={primary}>
                <div style={styles.buttonGrid}>
                    <GloButton
                        label="Primário"
                        variant="primary"
                        size="small"
                        bg={buttonIdleBg}
                        hoverBg={buttonHoverBg}
                        activeBg={buttonActiveBg}
                        themeOverride={theme}
                    />
                    <GloButton label="Secundário" variant="secondary" size="small" themeOverride={theme} />
                    <GloButton label="Fantasma" variant="ghost" size="small" themeOverride={theme} />
                    <GloButton label="Sucesso" variant="success" size="small" themeOverride={theme} />
                    <GloButton label="Alerta" variant="warning" size="small" themeOverride={theme} />
                    <GloButton label="Erro" variant="error" size="small" themeOverride={theme} />
                </div>
                <div style={{ marginTop: '12px' }}>
                    <GloButton
                        label="Com sprite"
                        variant="primary"
                        showSprite={true}
                        sprite={buttonSprite}
                        spriteWidth={buttonSpriteWidth}
                        spriteHeight={buttonSpriteHeight}
                        spriteAnimation={buttonClickAnimation}
                        bg={buttonIdleBg}
                        hoverBg={buttonHoverBg}
                        activeBg={buttonActiveBg}
                        themeOverride={theme}
                    />
                </div>
            </PreviewSection>

            {/* ─── BADGES ─── */}
            <PreviewSection title="Selos (GloBadge)" color={primary}>
                <div style={styles.badgeRow}>
                    <GloBadge status="info">Info</GloBadge>
                    <GloBadge status="success">Sucesso</GloBadge>
                    <GloBadge status="warning">Alerta</GloBadge>
                    <GloBadge status="error">Erro</GloBadge>
                    <GloBadge status="neutral">Neutro</GloBadge>
                    <GloBadge color={primary}>Primário</GloBadge>
                </div>
                <div style={{ ...styles.badgeRow, marginTop: '8px' }}>
                    <GloBadge variant="outlined" color={accent}>Contorno</GloBadge>
                    <GloBadge removable={true} onRemove={() => {}} color={primary}>Removível</GloBadge>
                    <GloBadge pulse={true} status="error">Pulso</GloBadge>
                </div>
            </PreviewSection>

            {/* ─── CARDS ─── */}
            <PreviewSection title="Cartões (GloCard)" color={primary}>
                <div style={styles.cardGrid}>
                    <GloCard
                        title="Cartão padrão"
                        variant="default"
                        size="small"
                        bg={theme["card-bg-color"] || surface}
                        accentColor={primary}
                        themeOverride={theme}
                    >
                        <p style={{ margin: 0, fontSize: '12px', color: textMuted }}>
                            Cartão com o estilo padrão.
                        </p>
                    </GloCard>
                    <GloCard
                        title="Cartão elevado"
                        variant="elevated"
                        size="small"
                        bg={theme["card-bg-color"] || surface}
                        accentColor={primary}
                        themeOverride={theme}
                    >
                        <p style={{ margin: 0, fontSize: '12px', color: textMuted }}>
                            Cartão com sombra elevada.
                        </p>
                    </GloCard>
                    <GloCard
                        title="Cartão com contorno"
                        variant="outlined"
                        size="small"
                        bg={theme["card-bg-color"] || surface}
                        borderColor={primary}
                        accentColor={primary}
                        themeOverride={theme}
                    >
                        <p style={{ margin: 0, fontSize: '12px', color: textMuted }}>
                            Cartão com borda visível.
                        </p>
                    </GloCard>
                </div>
            </PreviewSection>

            {/* ─── INPUTS ─── */}
            <PreviewSection title="Campos (GloInput)" color={primary}>
                <div style={styles.inputGrid}>
                    <GloInput
                        type="text"
                        placeholder="Texto..."
                        label="Texto"
                        value={inputValue}
                        onChange={setInputValue}
                        bgOverride={theme["input-bg"]}
                        borderOverride={theme["input-border"]}
                        borderFocusOverride={theme["input-border-focus"]}
                        accentColorOverride={primary}
                        themeOverride={theme}
                    />
                    <GloInput
                        type="number"
                        placeholder="0"
                        label="Número"
                        min={0}
                        max={100}
                        bgOverride={theme["input-bg"]}
                        borderOverride={theme["input-border"]}
                        borderFocusOverride={theme["input-border-focus"]}
                        accentColorOverride={primary}
                        themeOverride={theme}
                    />
                </div>
                <div style={{ marginTop: '12px' }}>
                    <GloInput
                        type="textarea"
                        placeholder="Texto em várias linhas..."
                        label="Área de texto"
                        rows={2}
                        bgOverride={theme["input-bg"]}
                        borderOverride={theme["input-border"]}
                        borderFocusOverride={theme["input-border-focus"]}
                        accentColorOverride={primary}
                        themeOverride={theme}
                    />
                </div>
            </PreviewSection>

            {/* ─── SELECT ─── */}
            <PreviewSection title="Seleção (GloSelect)" color={primary}>
                <div style={styles.selectGrid}>
                    <GloSelect
                        options={[
                            { value: "option1", label: "Opção um" },
                            { value: "option2", label: "Opção dois" },
                            { value: "option3", label: "Opção três" },
                        ]}
                        value={selectValue}
                        onChange={setSelectValue}
                        label="Lista"
                        placeholder="Escolha uma opção..."
                        bgOverride={theme["select-bg"] || theme["input-bg"]}
                        borderOverride={theme["select-border"] || theme["input-border"]}
                        accentColorOverride={primary}
                        themeOverride={theme}
                    />
                    <GloSelect
                        options={[
                            { value: "a", label: "Maçã" },
                            { value: "b", label: "Banana" },
                            { value: "c", label: "Cereja" },
                        ]}
                        label="Com busca"
                        placeholder="Escolha a fruta..."
                        searchable={true}
                        bgOverride={theme["select-bg"] || theme["input-bg"]}
                        borderOverride={theme["select-border"] || theme["input-border"]}
                        accentColorOverride={primary}
                        themeOverride={theme}
                    />
                </div>
            </PreviewSection>

            {/* ─── TABS ─── */}
            <PreviewSection title="Abas (GloTabs)" color={primary}>
                <div style={styles.tabsGrid}>
                    <div>
                        <span style={{ fontSize: '11px', color: textMuted, marginBottom: '8px', display: 'block' }}>Sublinhado</span>
                        <GloTabs
                            tabs={[
                                { id: "t1", label: "Aba 1" },
                                { id: "t2", label: "Aba 2" },
                                { id: "t3", label: "Aba 3" },
                            ]}
                            variant="underline"
                            renderContent={false}
                            size="small"
                            accentColorOverride={primary}
                            surfaceColorOverride={surface}
                        />
                    </div>
                    <div>
                        <span style={{ fontSize: '11px', color: textMuted, marginBottom: '8px', display: 'block' }}>Pílulas</span>
                        <GloTabs
                            tabs={[
                                { id: "t1", label: "Aba 1" },
                                { id: "t2", label: "Aba 2" },
                                { id: "t3", label: "Aba 3" },
                            ]}
                            variant="pills"
                            renderContent={false}
                            size="small"
                            accentColorOverride={primary}
                            surfaceColorOverride={surface}
                        />
                    </div>
                    <div>
                        <span style={{ fontSize: '11px', color: textMuted, marginBottom: '8px', display: 'block' }}>Caixas</span>
                        <GloTabs
                            tabs={[
                                { id: "t1", label: "Aba 1" },
                                { id: "t2", label: "Aba 2" },
                                { id: "t3", label: "Aba 3" },
                            ]}
                            variant="boxed"
                            renderContent={false}
                            accentColorOverride={primary}
                            surfaceColorOverride={surface}
                            size="small"
                        />
                    </div>
                </div>
            </PreviewSection>

            {/* ─── LIQUID GLASS ─── */}
            <PreviewSection title="Vidro líquido" color={primary}>
                <div style={{
                    background: "rgba(0,0,0,0.2)",
                    borderRadius: "12px",
                    padding: "16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                }}>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <GloButton label="Repouso" variant="liquid-glass" size="small" glow={false} lift={false} press={true} themeOverride={theme} />
                        <GloButton label="Ativo" variant="liquid-glass" size="small" active={true} glow={false} lift={false} press={true} themeOverride={theme} />
                        <GloButton label="Passe o mouse" variant="liquid-glass" size="small" glow={false} press={true} themeOverride={theme} />
                    </div>
                    <GloTabs
                        tabs={[
                            { id: "lg1", label: "Aba 1" },
                            { id: "lg2", label: "Aba 2" },
                            { id: "lg3", label: "Aba 3" },
                        ]}
                        variant="liquid-glass"
                        renderContent={false}
                        size="small"
                        accentColorOverride={primary}
                    />
                    <GloCard
                        title="Cartão de vidro"
                        variant="liquid-glass"
                        size="small"
                        themeOverride={theme}
                    >
                        <p style={{ margin: 0, fontSize: '12px', color: textMuted }}>
                            Cartão de vidro: transparente em repouso, tom primário no hover.
                        </p>
                    </GloCard>
                    <GloInput
                        placeholder="Campo de vidro líquido..."
                        variant="liquid-glass"
                        size="small"
                        themeOverride={theme}
                    />
                    <GloToggle
                        targetKey="__preview_lg_toggle"
                        targetFile="System/Settings.md"
                        variant="liquid-glass"
                        onLabel="Vidro ligado"
                        offLabel="Vidro desligado"
                        showSprite={false}
                        themeOverride={theme}
                    />
                </div>
            </PreviewSection>

        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════════

const styles = {
    previewContent: {
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
    },
    previewSection: {
        marginBottom: '0',
    },
    previewSectionTitle: {
        fontSize: '12px',
        fontWeight: '600',
        margin: '0 0 12px 0',
        paddingBottom: '8px',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
    },
    
    // Color palette
    colorPalette: {
        display: 'flex',
        gap: '12px',
        flexWrap: 'wrap',
    },
    paletteItem: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '4px',
    },
    
    // Toggle row
    toggleRow: {
        display: 'flex',
        gap: '20px',
        flexWrap: 'wrap',
    },
    toggleDemo: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
    },
    
    // Button grid
    buttonGrid: {
        display: 'flex',
        gap: '8px',
        flexWrap: 'wrap',
    },
    
    // Badge row
    badgeRow: {
        display: 'flex',
        gap: '8px',
        flexWrap: 'wrap',
    },
    
    // Card grid
    cardGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: '12px',
    },
    
    // Input grid
    inputGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: '12px',
    },
    
    // Select grid
    selectGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: '12px',
    },
    
    // Tabs grid
    tabsGrid: {
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
    },
};

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

const renderedView = (
    <div style={{ padding: '16px', background: '#1e1e2e', borderRadius: '12px' }}>
        <p style={{ color: '#888', fontSize: '12px', marginBottom: '16px' }}>
            Demonstração do ThemePreviewContent (tema padrão)
        </p>
        <ThemePreviewContent theme={{}} />
    </div>
);

return { 
    renderedView, 
    ThemePreviewContent,
    PreviewSection,
};
