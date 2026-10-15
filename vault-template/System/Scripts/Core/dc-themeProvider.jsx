// ═══════════════════════════════════════════════════════════════════════════════
// THEME PROVIDER v3
// Tema dos widgets: lê System/Settings.md e System/Temas/, deriva cores, injeta
// variáveis CSS e sincroniza com a configuração do Obsidian.
//
// Desempenho:
//   - Tema montado de forma síncrona no primeiro render quando não depende de
//     JSON externo (color-override ausente ou já em cache): sem "Loading" e
//     sem segundo render por widget.
//   - Um objeto de tema por chave tema:override, com identidade estável, para
//     que os componentes possam memorizar estilos derivados por `theme`.
//   - readSettings() é síncrono e barato (metadataCache); todos os Glo* leem
//     flashy-mode por ele em vez de um efeito por instância.
//
// Uso:
//   const { useTheme } = await dc.require(dc.fileLink("System/Scripts/Core/dc-themeProvider.jsx"));
//   const { theme } = useTheme();
// ═══════════════════════════════════════════════════════════════════════════════

const SETTINGS_PATH = "System/Settings.md";
const THEMES_DIR = "System/Temas";

// ─────────────────────────────────────────────────────────────────────────────
// CORES
// ─────────────────────────────────────────────────────────────────────────────

function hexToRgba(hex, alpha = 1) {
    if (!hex || typeof hex !== "string") return `rgba(124, 58, 237, ${alpha})`;
    const h = hex.replace("#", "");
    const r = parseInt(h.substring(0, 2), 16) || 0;
    const g = parseInt(h.substring(2, 4), 16) || 0;
    const b = parseInt(h.substring(4, 6), 16) || 0;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function isLightColor(hex) {
    if (!hex || typeof hex !== "string") return false;
    const h = hex.replace("#", "");
    const r = parseInt(h.substring(0, 2), 16) || 0;
    const g = parseInt(h.substring(2, 4), 16) || 0;
    const b = parseInt(h.substring(4, 6), 16) || 0;
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5;
}

// STYLE SETTINGS KEY MAPPING
// Maps Style Settings keys to our widget properties
// Aligned with Minimal Theme semantics:
//   bg1/bg2/bg3 = backgrounds, ui1/ui2/ui3 = borders, ax1/ax2/ax3 = accents, tx1/tx2/tx3 = text
// ─────────────────────────────────────────────────────────────────────────────

const STYLE_SETTINGS_MAP = {
    // ═══════════════════════════════════════════════════════════════════════
    // BACKGROUND COLORS (bg1=primary, bg2=secondary, bg3=active)
    // ═══════════════════════════════════════════════════════════════════════
    
    // Dark mode
    "minimal-style@@bg1@@dark": "color-background",
    "minimal-style@@bg2@@dark": "color-surface",
    "minimal-style@@bg3@@dark": "color-surface-hover",
    
    // Light mode
    "minimal-style@@bg1@@light": "color-background",
    "minimal-style@@bg2@@light": "color-surface",
    "minimal-style@@bg3@@light": "color-surface-hover",

    // ═══════════════════════════════════════════════════════════════════════
    // BORDER/UI COLORS (ui1=border, ui2=highlighted, ui3=active)
    // ═══════════════════════════════════════════════════════════════════════
    
    // Dark mode
    "minimal-style@@ui1@@dark": "color-border",
    "minimal-style@@ui2@@dark": "color-border-highlight",
    "minimal-style@@ui3@@dark": "color-border-active",
    
    // Light mode
    "minimal-style@@ui1@@light": "color-border",
    "minimal-style@@ui2@@light": "color-border-highlight",
    "minimal-style@@ui3@@light": "color-border-active",

    // ═══════════════════════════════════════════════════════════════════════
    // ACCENT COLORS (ax1=accent, ax2=hover, ax3=interactive)
    // ═══════════════════════════════════════════════════════════════════════
    
    // Dark mode
    "minimal-style@@ax1@@dark": "color-accent",
    "minimal-style@@ax2@@dark": "color-accent-hover",
    "minimal-style@@ax3@@dark": "color-accent-active",
    "minimal-style@@sp1@@dark": "color-text-on-accent",
    
    // Light mode
    "minimal-style@@ax1@@light": "color-accent",
    "minimal-style@@ax2@@light": "color-accent-hover",
    "minimal-style@@ax3@@light": "color-accent-active",
    "minimal-style@@sp1@@light": "color-text-on-accent",

    // ═══════════════════════════════════════════════════════════════════════
    // TEXT COLORS (tx1=normal, tx2=muted, tx3=faint)
    // ═══════════════════════════════════════════════════════════════════════
    
    // Dark mode
    "minimal-style@@tx1@@dark": "color-text",
    "minimal-style@@tx2@@dark": "color-text-muted",
    "minimal-style@@tx3@@dark": "color-text-faint",
    "minimal-style@@hl1@@dark": "color-selection-bg",
    "minimal-style@@hl2@@dark": "color-highlight-bg",
    
    // Light mode
    "minimal-style@@tx1@@light": "color-text",
    "minimal-style@@tx2@@light": "color-text-muted",
    "minimal-style@@tx3@@light": "color-text-faint",
    "minimal-style@@hl1@@light": "color-selection-bg",
    "minimal-style@@hl2@@light": "color-highlight-bg",

    // ═══════════════════════════════════════════════════════════════════════
    // EXTENDED COLORS (for charts, graphs, status indicators)
    // ═══════════════════════════════════════════════════════════════════════
    
    // Dark mode
    "minimal-style@@color-red@@dark": "color-red",
    "minimal-style@@color-orange@@dark": "color-orange",
    "minimal-style@@color-yellow@@dark": "color-yellow",
    "minimal-style@@color-green@@dark": "color-green",
    "minimal-style@@color-cyan@@dark": "color-cyan",
    "minimal-style@@color-blue@@dark": "color-blue",
    "minimal-style@@color-purple@@dark": "color-purple",
    "minimal-style@@color-pink@@dark": "color-pink",
    
    // Light mode
    "minimal-style@@color-red@@light": "color-red",
    "minimal-style@@color-orange@@light": "color-orange",
    "minimal-style@@color-yellow@@light": "color-yellow",
    "minimal-style@@color-green@@light": "color-green",
    "minimal-style@@color-cyan@@light": "color-cyan",
    "minimal-style@@color-blue@@light": "color-blue",
    "minimal-style@@color-purple@@light": "color-purple",
    "minimal-style@@color-pink@@light": "color-pink",

    // ═══════════════════════════════════════════════════════════════════════
    // HEADING COLORS
    // ═══════════════════════════════════════════════════════════════════════
    
    // Dark mode
    "minimal-style@@h1-color@@dark": "color-heading-1",
    "minimal-style@@h2-color@@dark": "color-heading-2",
    "minimal-style@@h3-color@@dark": "color-heading-3",
    "minimal-style@@h4-color@@dark": "color-heading-4",
    "minimal-style@@h5-color@@dark": "color-heading-5",
    "minimal-style@@h6-color@@dark": "color-heading-6",
    
    // Light mode
    "minimal-style@@h1-color@@light": "color-heading-1",
    "minimal-style@@h2-color@@light": "color-heading-2",
    "minimal-style@@h3-color@@light": "color-heading-3",
    "minimal-style@@h4-color@@light": "color-heading-4",
    "minimal-style@@h5-color@@light": "color-heading-5",
    "minimal-style@@h6-color@@light": "color-heading-6",

    // ═══════════════════════════════════════════════════════════════════════
    // ICON COLORS
    // ═══════════════════════════════════════════════════════════════════════
    
    // Dark mode
    "minimal-style@@icon-color@@dark": "color-icon",
    "minimal-style@@icon-color-hover@@dark": "color-icon-hover",
    "minimal-style@@icon-color-active@@dark": "color-icon-active",
    
    // Light mode
    "minimal-style@@icon-color@@light": "color-icon",
    "minimal-style@@icon-color-hover@@light": "color-icon-hover",
    "minimal-style@@icon-color-active@@light": "color-icon-active",

    // ═══════════════════════════════════════════════════════════════════════
    // LINK COLORS
    // ═══════════════════════════════════════════════════════════════════════
    
    // Dark mode
    "minimal-style@@link-color@@dark": "color-link",
    "minimal-style@@link-color-hover@@dark": "color-link-hover",
    "minimal-style@@link-external-color@@dark": "color-link-external",
    "minimal-style@@link-external-color-hover@@dark": "color-link-external-hover",
    
    // Light mode
    "minimal-style@@link-color@@light": "color-link",
    "minimal-style@@link-color-hover@@light": "color-link-hover",
    "minimal-style@@link-external-color@@light": "color-link-external",
    "minimal-style@@link-external-color-hover@@light": "color-link-external-hover",

    // ═══════════════════════════════════════════════════════════════════════
    // GRAPH NODE COLORS (for activity tracker visualizations)
    // ═══════════════════════════════════════════════════════════════════════
    
    // Dark mode
    "minimal-style@@graph-node@@dark": "color-graph-node",
    "minimal-style@@graph-node-focused@@dark": "color-graph-node-active",
    "minimal-style@@graph-node-tag@@dark": "color-graph-node-tag",
    
    // Light mode
    "minimal-style@@graph-node@@light": "color-graph-node",
    "minimal-style@@graph-node-focused@@light": "color-graph-node-active",
    "minimal-style@@graph-node-tag@@light": "color-graph-node-tag",

    // ═══════════════════════════════════════════════════════════════════════
    // UI ELEMENTS (line numbers, gutters, tabs)
    // ═══════════════════════════════════════════════════════════════════════
    
    // Dark mode
    "minimal-style@@line-number-color@@dark": "color-line-number",
    "minimal-style@@gutter-background@@dark": "color-gutter",
    "minimal-style@@active-line-bg@@dark": "color-active-line",
    "minimal-style@@minimal-tab-text-color@@dark": "color-tab",
    "minimal-style@@minimal-tab-text-color-active@@dark": "color-tab-active",
    
    // Light mode
    "minimal-style@@line-number-color@@light": "color-line-number",
    "minimal-style@@gutter-background@@light": "color-gutter",
    "minimal-style@@active-line-bg@@light": "color-active-line",
    "minimal-style@@minimal-tab-text-color@@light": "color-tab",
    "minimal-style@@minimal-tab-text-color-active@@light": "color-tab-active",

    // ═══════════════════════════════════════════════════════════════════════
    // EXTRA-EXTRAS SNIPPET (HR/divider colors)
    // ═══════════════════════════════════════════════════════════════════════
    
    "extra-extras@@extras-hr-color@@dark": "color-divider",
    "extra-extras@@extras-hr-color@@light": "color-divider",
};

// ─────────────────────────────────────────────────────────────────────────────
// DEFAULT THEME
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_THEME = {
    "theme-id": "default",
    "theme-name": "Default",
    "theme-description": "Fallback theme",
    
    // ═══════════════════════════════════════════════════════════════════════
    // BACKGROUND COLORS (aligned with Minimal: bg1/bg2/bg3)
    // ═══════════════════════════════════════════════════════════════════════
    "color-background": "#1e1e2e",       // bg1 - Primary background
    "color-surface": "#2a2a3e",          // bg2 - Secondary background (cards, panels)
    "color-surface-hover": "#363650",    // bg3 - Active/hover background
    
    // ═══════════════════════════════════════════════════════════════════════
    // BORDER COLORS (aligned with Minimal: ui1/ui2/ui3)
    // ═══════════════════════════════════════════════════════════════════════
    "color-border": "rgba(255,255,255,0.1)",        // ui1 - Default border
    "color-border-highlight": "rgba(255,255,255,0.2)", // ui2 - Highlighted border
    "color-border-active": "#7c3aed",              // ui3 - Active/focused border
    
    // ═══════════════════════════════════════════════════════════════════════
    // ACCENT COLORS (aligned with Minimal: ax1/ax2/ax3/sp1)
    // ═══════════════════════════════════════════════════════════════════════
    "color-accent": "#7c3aed",           // ax1 - Primary accent (links, buttons)
    "color-accent-hover": "#8b5cf6",     // ax2 - Accent hover state
    "color-accent-active": "#6d28d9",    // ax3 - Accent active/pressed state
    "color-text-on-accent": "#ffffff",   // sp1 - Text on accent backgrounds
    
    // ═══════════════════════════════════════════════════════════════════════
    // TEXT COLORS (aligned with Minimal: tx1/tx2/tx3/hl1/hl2)
    // ═══════════════════════════════════════════════════════════════════════
    "color-text": "#ffffff",             // tx1 - Primary text
    "color-text-muted": "#a0a0b0",       // tx2 - Secondary/muted text
    "color-text-faint": "#6b6b7b",       // tx3 - Tertiary/faint text
    "color-selection-bg": "rgba(124,58,237,0.3)",  // hl1 - Text selection background
    "color-highlight-bg": "rgba(245,158,11,0.35)", // hl2 - Highlighted text background
    
    // ═══════════════════════════════════════════════════════════════════════
    // EXTENDED COLORS (aligned with Minimal's rainbow palette)
    // Used for charts, graphs, status indicators, syntax highlighting
    // ═══════════════════════════════════════════════════════════════════════
    "color-red": "#ef4444",
    "color-orange": "#f59e0b",
    "color-yellow": "#eab308",
    "color-green": "#10b981",
    "color-cyan": "#06b6d4",
    "color-blue": "#3b82f6",
    "color-purple": "#8b5cf6",
    "color-pink": "#ec4899",
    
    // ═══════════════════════════════════════════════════════════════════════
    // SEMANTIC COLORS (derived from extended colors)
    // ═══════════════════════════════════════════════════════════════════════
    "color-success": "#10b981",          // Uses green
    "color-warning": "#f59e0b",          // Uses orange
    "color-error": "#ef4444",            // Uses red
    
    // ═══════════════════════════════════════════════════════════════════════
    // HEADING COLORS
    // ═══════════════════════════════════════════════════════════════════════
    "color-heading-1": "#7c3aed",
    "color-heading-2": "#8b5cf6",
    "color-heading-3": "#a78bfa",
    "color-heading-4": "#c4b5fd",
    "color-heading-5": "#ddd6fe",
    "color-heading-6": "#ede9fe",
    
    // ═══════════════════════════════════════════════════════════════════════
    // ICON COLORS
    // ═══════════════════════════════════════════════════════════════════════
    "color-icon": "#7c3aed",
    "color-icon-hover": "#a78bfa",
    "color-icon-active": "#8b5cf6",
    
    // ═══════════════════════════════════════════════════════════════════════
    // LINK COLORS
    // ═══════════════════════════════════════════════════════════════════════
    "color-link": "#7c3aed",
    "color-link-hover": "#a78bfa",
    "color-link-external": "#3b82f6",
    "color-link-external-hover": "#60a5fa",
    
    // ═══════════════════════════════════════════════════════════════════════
    // GRAPH NODE COLORS (for activity tracker visualizations)
    // ═══════════════════════════════════════════════════════════════════════
    "color-graph-node": "#7c3aed",
    "color-graph-node-active": "#f59e0b",
    "color-graph-node-tag": "#10b981",
    
    // ═══════════════════════════════════════════════════════════════════════
    // UI ELEMENT COLORS
    // ═══════════════════════════════════════════════════════════════════════
    "color-divider": "#7c3aed",
    "color-line-number": "#6b6b7b",
    "color-gutter": "rgba(124,58,237,0.1)",
    "color-active-line": "rgba(124,58,237,0.1)",
    "color-tab": "#a0a0b0",
    "color-tab-active": "#ffffff",
    
    // ═══════════════════════════════════════════════════════════════════════
    // GLOW EFFECTS (auto-derived if not set)
    // ═══════════════════════════════════════════════════════════════════════
    "glow-enabled": true,
    "glow-color-active": "",  // Derived from accent
    "glow-color-hover": "",   // Derived from accent-hover
    "glow-intensity": "15px",
    "glow-spread": "2px",
    
    // ═══════════════════════════════════════════════════════════════════════
    // TRANSITIONS
    // ═══════════════════════════════════════════════════════════════════════
    "transition-duration": "0.3s",
    "transition-easing": "ease",
    
    // ═══════════════════════════════════════════════════════════════════════
    // BORDERS
    // ═══════════════════════════════════════════════════════════════════════
    "border-width-default": "1px",
    "border-width-active": "2px",
    "border-radius-small": "6px",
    "border-radius-medium": "12px",
    "border-radius-large": "16px",
    "border-radius-pill": "9999px",
    
    // ═══════════════════════════════════════════════════════════════════════
    // TYPOGRAPHY
    // ═══════════════════════════════════════════════════════════════════════
    "font-interface": "",
    "font-text": "",
    "font-mono": "Fira Code, monospace",
    
    // ═══════════════════════════════════════════════════════════════════════
    // SPRITE PACK
    // ═══════════════════════════════════════════════════════════════════════
    "bar-sprite": "",
    "bar-sprite-width": 34,
    "bar-sprite-height": 21,
    "bar-track-bg": "",
    "bar-fill-gradient": "linear-gradient(90deg, #7c3aed, #a78bfa)",
    "bar-border-radius": "6px",
    "bar-height": "14px",
    
    "toggle-sprite": "",
    "toggle-sprite-width": 50,
    "toggle-sprite-height": 40,
    "toggle-idle-bg": "",
    "toggle-hover-bg": "",
    "toggle-active-bg": "",
    
    // ═══════════════════════════════════════════════════════════════════════
    // LABELS
    // ═══════════════════════════════════════════════════════════════════════
    "label-active": "Active",
    "label-inactive": "Inactive",
    "label-active-sub": "Enabled",
    "label-inactive-sub": "Disabled",
    
    // ═══════════════════════════════════════════════════════════════════════
    // BUTTONS
    // ═══════════════════════════════════════════════════════════════════════
    "button-idle-bg": "#7c3aed",
    "button-hover-bg": "#8b5cf6",
    "button-active-bg": "#6d28d9",
    "button-text-color": "#ffffff",
    "button-border-radius": "8px",
    "button-padding": "10px 20px",
    "button-sprite": "",
    "button-sprite-width": 34,
    "button-sprite-height": 21,
    "button-sprite-click-animation": "bounce",
    "button-sprite-click-duration": "0.3s",
    "transition-normal": "0.3s",
    "transition-fast": "0.15s",
    
    // ═══════════════════════════════════════════════════════════════════════
    // CARDS
    // ═══════════════════════════════════════════════════════════════════════
    "card-bg-color": "#2a2a3e",
    "card-border": "1px solid rgba(255,255,255,0.1)",
    "card-border-radius": "12px",
    "card-shadow": "0 4px 15px rgba(0,0,0,0.2)",
    "card-padding": "16px",
    
    // ═══════════════════════════════════════════════════════════════════════
    // INPUTS
    // ═══════════════════════════════════════════════════════════════════════
    "input-bg": "rgba(255,255,255,0.05)",
    "input-border": "1px solid rgba(255,255,255,0.2)",
    "input-border-focus": "1px solid #7c3aed",
    "input-border-radius": "6px",
    "input-text-color": "#ffffff",
    
    // ═══════════════════════════════════════════════════════════════════════
    // CHIPS
    // ═══════════════════════════════════════════════════════════════════════
    "chip-bg": "rgba(255,255,255,0.05)",
    "chip-bg-active": "rgba(255,255,255,0.15)",
    "chip-border-radius": "20px",
    
    // ═══════════════════════════════════════════════════════════════════════
    // CHARTS (defaults derived from extended colors if not set)
    // ═══════════════════════════════════════════════════════════════════════
    "chart-color-1": "",  // Falls back to color-purple
    "chart-color-2": "",  // Falls back to color-orange
    "chart-color-3": "",  // Falls back to color-green
    "chart-color-4": "",  // Falls back to color-red
    "chart-color-5": "",  // Falls back to color-blue
    "chart-color-6": "",  // Falls back to color-pink
    "heatmap-empty": "rgba(255,255,255,0.1)",
    "heatmap-filled": "",  // Falls back to color-purple
    
    // ═══════════════════════════════════════════════════════════════════════
    // EMOJI ICONS
    // ═══════════════════════════════════════════════════════════════════════
    "icon-style": "emoji",
    "icon-water": "",
    "icon-sleep": "",
    "icon-exercise": "",
    "icon-mood": "",
    "icon-food": "",
    "icon-journal": "",
    
    // ═══════════════════════════════════════════════════════════════════════
    // HR/DIVIDER SVG
    // ═══════════════════════════════════════════════════════════════════════
    "hr-svg": "",
    "hr-color": "#7c3aed",
    
    // ═══════════════════════════════════════════════════════════════════════
    // OBSIDIAN SYNC
    // ═══════════════════════════════════════════════════════════════════════
    "obsidian-accent-color": "#7c3aed",
    "sync-to-obsidian": true,
};

// ─────────────────────────────────────────────────────────────────────────────
// SETTINGS (leitura síncrona)
// ─────────────────────────────────────────────────────────────────────────────

function settingsFile() {
    return app.vault.getAbstractFileByPath(SETTINGS_PATH)
        || app.metadataCache.getFirstLinkpathDest(SETTINGS_PATH, "");
}

/** Frontmatter do Settings.md já interpretado. Barato: lê do metadataCache. */
function readSettings() {
    const file = settingsFile();
    const fm = (file && app.metadataCache.getFileCache(file)?.frontmatter) || {};
    return {
        file, fm,
        themeId: fm["widget-theme"] || "nyanCat",
        colorOverride: fm["color-override"] || "",
        widgetBackgrounds: fm["widget-backgrounds"] !== false,
        flashyMode: fm["flashy-mode"] !== false,
        syncToObsidian: fm["sync-to-obsidian"] !== false,
    };
}

const getFlashyMode = () => readSettings().flashyMode;

// ─────────────────────────────────────────────────────────────────────────────
// DERIVAÇÃO
// ─────────────────────────────────────────────────────────────────────────────

const isDarkMode = () => document.body.classList.contains("theme-dark");

/** Mapeia o JSON do Style Settings para chaves de widget, no modo claro/escuro atual. */
function mapStyleSettingsToWidgetProps(styleSettings) {
    const mapped = {};
    const cur = isDarkMode() ? "@@dark" : "@@light";
    const opp = cur === "@@dark" ? "@@light" : "@@dark";
    for (const [ssKey, widgetKey] of Object.entries(STYLE_SETTINGS_MAP)) {
        const modal = ssKey.includes("@@dark") || ssKey.includes("@@light");
        if (!modal) {
            if (styleSettings[ssKey]) mapped[widgetKey] = styleSettings[ssKey];
        } else if (ssKey.endsWith(cur)) {
            const v = styleSettings[ssKey] || styleSettings[ssKey.replace(cur, opp)];
            if (v) mapped[widgetKey] = v;
        }
    }
    return mapped;
}

const fill = (t, key, value) => { if (!t[key]) t[key] = value; };

function deriveChartColors(t) {
    fill(t, "chart-color-1", t["color-purple"] || "#8b5cf6");
    fill(t, "chart-color-2", t["color-orange"] || "#f59e0b");
    fill(t, "chart-color-3", t["color-green"] || "#10b981");
    fill(t, "chart-color-4", t["color-red"] || "#ef4444");
    fill(t, "chart-color-5", t["color-blue"] || "#3b82f6");
    fill(t, "chart-color-6", t["color-pink"] || "#ec4899");
    fill(t, "heatmap-filled", t["color-purple"] || "#8b5cf6");
    return t;
}

function deriveSemanticColors(t) {
    fill(t, "color-success", t["color-green"] || "#10b981");
    fill(t, "color-warning", t["color-orange"] || "#f59e0b");
    fill(t, "color-error", t["color-red"] || "#ef4444");
    return t;
}

function deriveGlowColors(t) {
    const accent = t["color-accent"] || "#7c3aed";
    const accentHover = t["color-accent-hover"] || "#8b5cf6";
    fill(t, "glow-color-active", hexToRgba(accent, 0.4));
    fill(t, "glow-color-hover", hexToRgba(accentHover, 0.25));
    fill(t, "color-text", isLightColor(t["color-background"]) ? "#1e1e1e" : "#ffffff");
    fill(t, "color-text-muted", hexToRgba(t["color-text"], 0.6));
    fill(t, "color-text-faint", hexToRgba(t["color-text"], 0.4));
    fill(t, "color-link", t["color-accent"]);
    fill(t, "color-link-hover", t["color-accent-hover"]);
    fill(t, "color-icon", t["color-accent"]);
    fill(t, "color-icon-hover", t["color-accent-hover"]);
    fill(t, "color-icon-active", t["color-accent-active"] || t["color-accent"]);
    fill(t, "color-graph-node", t["color-accent"]);
    fill(t, "color-graph-node-active", t["color-orange"] || "#f59e0b");
    fill(t, "color-graph-node-tag", t["color-green"] || "#10b981");
    fill(t, "color-border-active", t["color-accent"]);
    fill(t, "color-divider", t["color-accent"]);
    deriveSemanticColors(t);
    deriveChartColors(t);
    return t;
}

// ─────────────────────────────────────────────────────────────────────────────
// ARQUIVOS DE TEMA
// ─────────────────────────────────────────────────────────────────────────────

let themeCache = new Map();          // "tema:override" -> objeto de tema derivado
let colorOverrideCache = new Map();  // nome -> JSON do Style Settings
let availableThemesCache = null;
let availableColorSchemesCache = null;

function themeFolderFiles() {
    const dir = app.vault.getAbstractFileByPath(THEMES_DIR);
    return dir?.children ? dir.children.filter(f => f.extension) : [];
}

function _findThemeFile(themeId) {
    return themeFolderFiles().find(f => f.extension === "md"
        && app.metadataCache.getFileCache(f)?.frontmatter?.["theme-id"] === themeId);
}

async function loadColorOverride(name) {
    if (!name) return null;
    if (colorOverrideCache.has(name)) return colorOverrideCache.get(name);
    try {
        const file = app.vault.getAbstractFileByPath(`${THEMES_DIR}/style-settings-${name}.json`);
        if (file) {
            const json = JSON.parse(await app.vault.read(file));
            colorOverrideCache.set(name, json);
            return json;
        }
    } catch (e) {
        console.warn(`Failed to load color override: ${name}`, e);
    }
    return null;
}

/** Tema derivado a partir do frontmatter do arquivo (+ override já carregado). */
function buildTheme(themeId, overrideJson) {
    const file = _findThemeFile(themeId);
    const fm = (file && app.metadataCache.getFileCache(file)?.frontmatter) || {};
    let t = { ...DEFAULT_THEME, ...fm };
    if (fm["style-settings"] && typeof fm["style-settings"] === "object") {
        Object.assign(t, mapStyleSettingsToWidgetProps(fm["style-settings"]));
    }
    if (overrideJson) {
        Object.assign(t, mapStyleSettingsToWidgetProps(overrideJson));
        t["_styleSettingsOverride"] = overrideJson;
    }
    return deriveGlowColors(t);
}

function scanThemes() {
    if (availableThemesCache) return availableThemesCache;
    availableThemesCache = themeFolderFiles()
        .filter(f => f.extension === "md" && !f.name.startsWith("_"))
        .map(f => ({ f, fm: app.metadataCache.getFileCache(f)?.frontmatter }))
        .filter(x => x.fm?.["theme-id"])
        .map(({ f, fm }) => ({
            id: fm["theme-id"],
            name: fm["theme-name"] || fm["theme-id"],
            description: fm["theme-description"] || "",
            path: f.path,
            hasSprite: !!(fm["bar-sprite"] || fm["toggle-sprite"]),
        }));
    return availableThemesCache;
}

function scanColorSchemes() {
    if (availableColorSchemesCache) return availableColorSchemesCache;
    availableColorSchemesCache = themeFolderFiles()
        .filter(f => f.extension === "json" && f.basename.startsWith("style-settings-"))
        .map(f => ({ name: f.basename.replace("style-settings-", ""), path: f.path }));
    return availableColorSchemesCache;
}

// Mantêm a forma { lista, isLoading } da API anterior; agora síncronos.
function useAvailableThemes() { return { themes: scanThemes(), isLoading: false }; }
function useAvailableColorSchemes() { return { schemes: scanColorSchemes(), isLoading: false }; }

// ─────────────────────────────────────────────────────────────────────────────
// HOOK PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

function useTheme() {
    const s = readSettings();
    const key = `${s.themeId}:${s.colorOverride}`;
    let theme = themeCache.get(key);
    const pendingOverride = !theme && s.colorOverride && !colorOverrideCache.has(s.colorOverride);
    if (!theme && !pendingOverride) {
        theme = buildTheme(s.themeId, s.colorOverride ? colorOverrideCache.get(s.colorOverride) : null);
        themeCache.set(key, theme);
        injectCSSVariables(theme);
    }
    // Só o caso com override ainda não lido do disco precisa de um segundo render.
    const [, bump] = dc.useState(0);
    dc.useEffect(() => {
        if (!pendingOverride) return;
        let alive = true;
        loadColorOverride(s.colorOverride).then(() => { if (alive) bump(n => n + 1); });
        return () => { alive = false; };
    }, [key, pendingOverride]);

    return {
        theme: theme || DEFAULT_THEME,
        isLoading: !theme,
        themeName: s.themeId,
        colorOverrideName: s.colorOverride,
        settings: { widgetBackgrounds: s.widgetBackgrounds, flashyMode: s.flashyMode },
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// VARIÁVEIS CSS
// ─────────────────────────────────────────────────────────────────────────────

// [variável CSS, chave do tema]. Valores ausentes não são escritos (antes
// viravam a string "undefined" e anulavam o fallback de var(--x, fallback)).
const CSS_VARS = [
    ["--theme-background", "color-background"], ["--theme-surface", "color-surface"], ["--theme-surface-hover", "color-surface-hover"],
    ["--theme-border", "color-border"], ["--theme-border-highlight", "color-border-highlight"], ["--theme-border-active", "color-border-active"],
    ["--theme-accent", "color-accent"], ["--theme-accent-hover", "color-accent-hover"], ["--theme-accent-active", "color-accent-active"], ["--theme-text-on-accent", "color-text-on-accent"],
    ["--theme-text", "color-text"], ["--theme-text-muted", "color-text-muted"], ["--theme-text-faint", "color-text-faint"],
    ["--theme-selection-bg", "color-selection-bg"], ["--theme-highlight-bg", "color-highlight-bg"],
    ["--theme-success", "color-success"], ["--theme-warning", "color-warning"], ["--theme-error", "color-error"],
    ["--theme-red", "color-red"], ["--theme-orange", "color-orange"], ["--theme-yellow", "color-yellow"], ["--theme-green", "color-green"],
    ["--theme-cyan", "color-cyan"], ["--theme-blue", "color-blue"], ["--theme-purple", "color-purple"], ["--theme-pink", "color-pink"],
    ["--theme-icon", "color-icon"], ["--theme-icon-hover", "color-icon-hover"], ["--theme-icon-active", "color-icon-active"],
    ["--theme-link", "color-link"], ["--theme-link-hover", "color-link-hover"], ["--theme-link-external", "color-link-external"], ["--theme-link-external-hover", "color-link-external-hover"],
    ["--theme-graph-node", "color-graph-node"], ["--theme-graph-node-active", "color-graph-node-active"], ["--theme-graph-node-tag", "color-graph-node-tag"],
    ["--theme-divider", "color-divider"], ["--theme-line-number", "color-line-number"], ["--theme-gutter", "color-gutter"], ["--theme-active-line", "color-active-line"],
    ["--theme-tab", "color-tab"], ["--theme-tab-active", "color-tab-active"],
    ["--theme-glow-active", "glow-color-active"], ["--theme-glow-hover", "glow-color-hover"], ["--theme-glow-intensity", "glow-intensity"], ["--theme-glow-spread", "glow-spread"],
    ["--theme-transition-duration", "transition-duration"], ["--theme-transition-easing", "transition-easing"],
    ["--theme-radius-small", "border-radius-small"], ["--theme-radius-medium", "border-radius-medium"], ["--theme-radius-large", "border-radius-large"],
    ["--theme-font-interface", "font-interface"], ["--theme-font-text", "font-text"], ["--theme-font-mono", "font-mono"],
    // Compatíveis com o Minimal (snippets e integrações)
    ["--bg1", "color-background"], ["--bg2", "color-surface"], ["--bg3", "color-surface-hover"],
    ["--ui1", "color-border"], ["--ui2", "color-border-highlight"], ["--ui3", "color-border-active"],
    ["--ax1", "color-accent"], ["--ax2", "color-accent-hover"], ["--ax3", "color-accent-active"], ["--sp1", "color-text-on-accent"],
    ["--tx1", "color-text"], ["--tx2", "color-text-muted"], ["--tx3", "color-text-faint"], ["--hl1", "color-selection-bg"], ["--hl2", "color-highlight-bg"],
    ["--color-red", "color-red"], ["--color-orange", "color-orange"], ["--color-yellow", "color-yellow"], ["--color-green", "color-green"],
    ["--color-cyan", "color-cyan"], ["--color-blue", "color-blue"], ["--color-purple", "color-purple"], ["--color-pink", "color-pink"],
    ["--h1-color", "color-heading-1"], ["--h2-color", "color-heading-2"], ["--h3-color", "color-heading-3"],
    ["--h4-color", "color-heading-4"], ["--h5-color", "color-heading-5"], ["--h6-color", "color-heading-6"],
    ["--icon-color", "color-icon"], ["--icon-color-hover", "color-icon-hover"], ["--icon-color-active", "color-icon-active"],
    ["--link-color", "color-link"], ["--link-color-hover", "color-link-hover"], ["--link-external-color", "color-link-external"], ["--link-external-color-hover", "color-link-external-hover"],
    ["--graph-node", "color-graph-node"], ["--graph-node-focused", "color-graph-node-active"], ["--graph-node-tag", "color-graph-node-tag"],
];

function injectCSSVariables(theme) {
    const st = document.documentElement.style;
    for (const [cssVar, key] of CSS_VARS) {
        const v = theme[key];
        if (v !== undefined && v !== null && v !== "") st.setProperty(cssVar, String(v));
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// SINCRONIZAÇÃO COM O OBSIDIAN
// ─────────────────────────────────────────────────────────────────────────────

async function mergeJsonFile(path, data, label) {
    let existing = {};
    try { existing = JSON.parse(await app.vault.adapter.read(path)); }
    catch (e) { console.log(`${label} data.json doesn't exist, creating new file`); }
    await app.vault.adapter.write(path, JSON.stringify({ ...existing, ...data }, null, 2));
}

async function syncToAppearance(accentColor) {
    try {
        const path = ".obsidian/appearance.json";
        const json = JSON.parse(await app.vault.adapter.read(path));
        json.accentColor = accentColor;
        await app.vault.adapter.write(path, JSON.stringify(json, null, 2));
        return true;
    } catch (e) {
        console.error("Failed to sync to appearance.json:", e);
        return false;
    }
}

async function syncToStyleSettings(data) {
    try { await mergeJsonFile(".obsidian/plugins/obsidian-style-settings/data.json", data, "Style Settings"); return true; }
    catch (e) { console.error("Failed to sync to Style Settings:", e); return false; }
}

async function syncToMinimalSettings(data) {
    try { await mergeJsonFile(".obsidian/plugins/obsidian-minimal-settings/data.json", data, "Minimal Settings"); return true; }
    catch (e) { console.error("Failed to sync to Minimal Settings:", e); return false; }
}

async function syncThemeToObsidian(theme) {
    const results = { appearance: false, styleSettings: false, minimalSettings: false };
    if (theme["obsidian-accent-color"]) results.appearance = await syncToAppearance(theme["obsidian-accent-color"]);
    const ss = theme["_styleSettingsOverride"] || theme["style-settings"];
    if (ss && typeof ss === "object") results.styleSettings = await syncToStyleSettings(ss);
    const ms = theme["minimal-settings"];
    if (ms && typeof ms === "object") results.minimalSettings = await syncToMinimalSettings(ms);
    return results;
}

/** Dados de sincronização: frontmatter cru do tema + override (sem derivação), como antes. */
async function syncDataFor(themeId, colorOverride, warnMissing = false) {
    const file = _findThemeFile(themeId);
    const data = { ...DEFAULT_THEME, ...((file && app.metadataCache.getFileCache(file)?.frontmatter) || {}) };
    if (colorOverride) {
        const ov = await loadColorOverride(colorOverride);
        if (ov) {
            data["_styleSettingsOverride"] = ov;
            if (ov["minimal-style@@ui3@@dark"]) data["obsidian-accent-color"] = ov["minimal-style@@ui3@@dark"];
        } else if (warnMissing) {
            new Notice(`Color scheme "${colorOverride}" not found!`);
        }
    }
    return data;
}

// ─────────────────────────────────────────────────────────────────────────────
// TROCA DE TEMA
// ─────────────────────────────────────────────────────────────────────────────

function clearThemeCache() {
    themeCache.clear();
    colorOverrideCache.clear();
    availableThemesCache = null;
    availableColorSchemesCache = null;
}

async function switchTheme(themeId, colorOverride = "", syncToObsidian = true) {
    try {
        const file = app.vault.getAbstractFileByPath(SETTINGS_PATH);
        if (!file) { new Notice("Settings.md not found!"); return false; }
        await app.fileManager.processFrontMatter(file, fm => {
            fm["widget-theme"] = themeId;
            fm["color-override"] = colorOverride;
        });
        clearThemeCache();
        if (syncToObsidian) {
            const results = await syncThemeToObsidian(await syncDataFor(themeId, colorOverride));
            console.log("Theme sync results:", results);
        }
        new Notice(`Theme switched to: ${themeId}${colorOverride ? ` + ${colorOverride}` : ""}`);
        setTimeout(() => window.location.reload(), 500);
        return true;
    } catch (e) {
        console.error("Failed to switch theme:", e);
        new Notice("Failed to switch theme");
        return false;
    }
}

async function setColorOverride(colorOverride, syncToObsidian = true) {
    try {
        if (!app.vault.getAbstractFileByPath(SETTINGS_PATH)) return false;
        return await switchTheme(readSettings().themeId, colorOverride, syncToObsidian);
    } catch (e) {
        console.error("Failed to set color override:", e);
        return false;
    }
}

async function applyCurrentTheme() {
    try {
        if (!app.vault.getAbstractFileByPath(SETTINGS_PATH)) { new Notice("Settings.md not found!"); return false; }
        const s = readSettings();
        new Notice(`Applying theme: ${s.themeId}${s.colorOverride ? ` + ${s.colorOverride}` : ""}...`);
        clearThemeCache();
        if (s.syncToObsidian) {
            const results = await syncThemeToObsidian(await syncDataFor(s.themeId, s.colorOverride, true));
            console.log("Theme sync results:", results);
            if (results.styleSettings) {
                new Notice("Theme applied! Reloading...");
                setTimeout(() => window.location.reload(), 500);
            } else {
                new Notice("Theme applied but Style Settings sync failed");
            }
        }
        return true;
    } catch (e) {
        console.error("Failed to apply theme:", e);
        new Notice("Failed to apply theme: " + e.message);
        return false;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// OVERRIDE TEMPORÁRIO (pré-visualização no editor de temas)
// Pilha no módulo: o Datacore não expõe createContext.
// ─────────────────────────────────────────────────────────────────────────────

let themeOverrideStack = [];

function setThemeOverride(theme) {
    const processed = theme ? deriveGlowColors({ ...DEFAULT_THEME, ...theme }) : null;
    themeOverrideStack.push(processed);
    return () => {
        const i = themeOverrideStack.indexOf(processed);
        if (i > -1) themeOverrideStack.splice(i, 1);
    };
}

const getThemeOverride = () => themeOverrideStack.length ? themeOverrideStack[themeOverrideStack.length - 1] : null;
function clearThemeOverrides() { themeOverrideStack = []; }

function ThemeOverrideProvider({ theme, children }) {
    dc.useEffect(() => setThemeOverride(theme), [theme]);
    return children;
}

function useThemeWithOverride() {
    const override = getThemeOverride();
    const { theme, isLoading, themeName, colorOverrideName } = useTheme();
    if (override) {
        return { theme: override, isLoading: false, themeName: override["theme-id"] || "preview", colorOverrideName: "", isOverride: true };
    }
    return { theme, isLoading, themeName, colorOverrideName, isOverride: false };
}

// ─────────────────────────────────────────────────────────────────────────────
// CARREGAMENTO PARA PRÉ-VISUALIZAÇÃO
// ─────────────────────────────────────────────────────────────────────────────

async function loadThemeFromPath(path) {
    try {
        const file = app.vault.getAbstractFileByPath(path);
        if (!file) { console.warn(`Theme file not found: ${path}`); return { ...DEFAULT_THEME }; }
        const fm = app.metadataCache.getFileCache(file)?.frontmatter || {};
        let t = { ...DEFAULT_THEME, ...fm };
        if (fm["style-settings"] && typeof fm["style-settings"] === "object") {
            Object.assign(t, mapStyleSettingsToWidgetProps(fm["style-settings"]));
        }
        return deriveGlowColors(t);
    } catch (e) {
        console.error(`Failed to load theme from ${path}:`, e);
        return { ...DEFAULT_THEME };
    }
}

async function loadThemeById(themeId) {
    const file = _findThemeFile(themeId);
    if (!file) { console.warn(`Theme not found with ID: ${themeId}`); return { ...DEFAULT_THEME }; }
    return loadThemeFromPath(file.path);
}

function getThemeMetadata(path) {
    const file = app.vault.getAbstractFileByPath(path);
    const fm = file && app.metadataCache.getFileCache(file)?.frontmatter;
    if (!fm?.["theme-id"]) return null;
    return {
        id: fm["theme-id"],
        name: fm["theme-name"] || fm["theme-id"],
        description: fm["theme-description"] || "",
        path,
        hasSprite: !!(fm["bar-sprite"] || fm["toggle-sprite"]),
        version: fm["theme-version"] || "1.0",
        author: fm["theme-author"] || "",
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

return {
    // Hooks
    useTheme, useThemeWithOverride, useAvailableThemes, useAvailableColorSchemes,
    // Componentes
    ThemeOverrideProvider,
    // Override
    setThemeOverride, getThemeOverride, clearThemeOverrides,
    // Ações
    switchTheme, setColorOverride, applyCurrentTheme, clearThemeCache,
    // Carregamento
    loadThemeFromPath, loadThemeById, getThemeMetadata, loadColorOverride,
    // Sincronização
    syncThemeToObsidian, syncToAppearance, syncToStyleSettings, syncToMinimalSettings,
    // Utilitários
    hexToRgba, isLightColor, isDarkMode, mapStyleSettingsToWidgetProps,
    deriveGlowColors, deriveChartColors, deriveSemanticColors,
    readSettings, getFlashyMode,
    // Constantes
    DEFAULT_THEME, STYLE_SETTINGS_MAP,
};
