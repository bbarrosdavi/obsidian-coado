// ═══════════════════════════════════════════════════════════════════════════════
// DC-GLO-BUTTON v3 - botão da família Glo* + folha de estilo compartilhada
//
// Estados visuais (hover, pressionado, ativo) são CSS: o componente calcula os
// valores de cada estado uma vez por render e os entrega como variáveis CSS.
// Passar o mouse não re-renderiza nada. Animações de clique (sprite, arco-íris)
// trocam classes direto no DOM, sem estado React.
//
// Também exporta, para os outros Glo*: useComponentCSS, useFlashyMode,
// resolveBackground, hexToRgba, alpha, stateVars.
// ═══════════════════════════════════════════════════════════════════════════════

const { useTheme, getFlashyMode } = await dc.require(dc.fileLink("System/Scripts/Core/dc-themeProvider.jsx"));

// ─────────────────────────────────────────────────────────────────────────────
// FUNDOS E CORES
// ─────────────────────────────────────────────────────────────────────────────

function wrapImageUrl(value) {
    if (!value) return value;
    if (value.startsWith("url(")) return value;
    if (value.startsWith("data:image")) return `url("${value}")`;
    if (/\.(png|jpg|jpeg|gif|svg|webp)$/i.test(value)) return `url("${value}")`;
    return value;
}

function resolveBackground(value, themeGradient, themeSolid) {
    if (!value) return wrapImageUrl(themeGradient || themeSolid);
    if (value.startsWith("data:image")) return `url("${value}")`;
    if (value.startsWith("linear-gradient") || value.startsWith("radial-gradient")) return value;
    if (value.startsWith("url(")) return value;
    if (value.startsWith("#") || value.startsWith("rgb") || /^[a-z]+$/i.test(value)) return value;
    if (/\.(png|jpg|jpeg|gif|svg|webp)$/i.test(value)) return `url("${value}")`;
    return wrapImageUrl(themeGradient || themeSolid);
}

// Ancorado no início: includes() varria fundos base64 de meio megabyte a cada render.
const isImage = (bg) => typeof bg === "string" && (bg.startsWith("url(") || /^\s*(repeating-)?(linear|radial|conic)-gradient\(/.test(bg));

/** Divide um fundo resolvido em cor e imagem (uma das duas fica neutra). */
const splitBg = (bg) => isImage(bg) ? { c: "transparent", i: asset(bg) } : { c: bg || "transparent", i: "none" };   // imagem grande vira referência (ver asset)

function hexToRgba(hex, alpha = 1) {
    if (!hex || !hex.startsWith("#")) return `rgba(124, 58, 237, ${alpha})`;
    let r, g, b;
    if (hex.length === 4) {
        r = parseInt(hex[1] + hex[1], 16); g = parseInt(hex[2] + hex[2], 16); b = parseInt(hex[3] + hex[3], 16);
    } else {
        r = parseInt(hex.slice(1, 3), 16); g = parseInt(hex.slice(3, 5), 16); b = parseInt(hex.slice(5, 7), 16);
    }
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Transparência para qualquer cor CSS (hex, rgb, var()): color-mix no lugar de parse manual. */
const alpha = (color, a) => `color-mix(in srgb, ${color} ${Math.round(a * 100)}%, transparent)`;

/**
 * Converte { idle, hover, on, press } (objetos de propriedade -> valor) em
 * variáveis CSS com sufixo por estado. Só escreve o que difere do idle.
 */
function stateVars(prefix, states) {
    const out = {};
    const idle = states.idle || {};
    for (const [k, v] of Object.entries(idle)) if (v !== undefined && v !== null) out[`--${prefix}-${k}`] = asset(v);
    for (const [st, suf] of [["hover", "h"], ["on", "on"], ["press", "p"]]) {
        const s = states[st];
        if (!s) continue;
        for (const [k, v] of Object.entries(s)) {
            if (v !== undefined && v !== null && v !== idle[k]) out[`--${prefix}-${k}-${suf}`] = asset(v);
        }
    }
    return out;
}

/**
 * Valores enormes (fundos em base64 dos temas: 0,2 a 1,8 MB) viram uma variável
 * global registrada uma vez; o elemento recebe só "var(--dcg-a-N)". Sem isso cada
 * botão copiava a imagem em 3 variáveis (repouso, hover, ativo) e o navegador
 * re-tokenizava megabytes por elemento a cada render.
 */
const ASSET_MIN = 2048;
const ASSETS = window.__dcgAssets || (window.__dcgAssets = { map: new Map(), n: 0 });
function asset(v) {
    if (typeof v !== "string" || v.length < ASSET_MIN) return v;
    let name = ASSETS.map.get(v);
    if (!name) {
        name = `--dcg-a-${++ASSETS.n}`;
        ASSETS.map.set(v, name);
        const el = document.createElement("style");
        el.className = "dcg-asset";
        el.textContent = `:root{${name}:${v}}`;
        document.head.appendChild(el);
    }
    return `var(${name})`;
}

// ─────────────────────────────────────────────────────────────────────────────
// FOLHA DE ESTILO COMPARTILHADA (injetada uma vez; versionada)
// ─────────────────────────────────────────────────────────────────────────────

const CSS_ID = "dc-components-css";
const CSS_VERSION = "3.13";

// Estado com fallback: hover cai no idle; "on" (ativo) cai no idle; press cai no hover.
const v = (p, k, st) => st === "h" ? `var(--${p}-${k}-h, var(--${p}-${k}))`
    : st === "on" ? `var(--${p}-${k}-on, var(--${p}-${k}))`
    : st === "p" ? `var(--${p}-${k}-p, var(--${p}-${k}-h, var(--${p}-${k})))`
    : `var(--${p}-${k})`;
const stateBlock = (p, keys, st) => keys.map(([prop, k]) => `${prop}:${v(p, k, st)};`).join("");

const BTN_KEYS = [["background-color", "c"], ["background-image", "i"], ["background-size", "s"], ["background-repeat", "r"],
    ["background-position", "p"], ["border", "b"], ["color", "fg"], ["box-shadow", "sh"], ["transform", "t"], ["font-weight", "fw"]];
const CARD_KEYS = [["background-color", "c"], ["background-size", "s"], ["background-repeat", "r"], ["background-position", "p"],
    ["border", "b"], ["box-shadow", "sh"], ["transform", "t"]];
const INPUT_KEYS = [["background-color", "c"], ["background-image", "i"], ["background-size", "s"], ["background-repeat", "r"],
    ["background-position", "p"], ["border", "b"], ["box-shadow", "sh"]];
const TOGGLE_KEYS = [["background-color", "c"], ["background-image", "i"], ["background-size", "s"], ["background-repeat", "r"],
    ["background-position", "p"], ["border", "b"], ["box-shadow", "sh"], ["transform", "t"]];

const ANIMS = {
    squish: "0%{transform:scale(1,1)}30%{transform:scale(1.1,.8)}50%{transform:scale(.9,1.1)}70%{transform:scale(1.05,.95)}100%{transform:scale(1,1)}",
    bounce: "0%{transform:translateY(0)}20%{transform:translateY(-8px)}40%{transform:translateY(0)}60%{transform:translateY(-4px)}80%{transform:translateY(0)}100%{transform:translateY(0)}",
    spin: "0%{transform:rotate(0)}100%{transform:rotate(360deg)}",
    twist: "0%{transform:rotate(0)}25%{transform:rotate(15deg)}50%{transform:rotate(-15deg)}75%{transform:rotate(8deg)}100%{transform:rotate(0)}",
    jiggle: "0%{transform:translateX(0)}20%{transform:translateX(-4px)}40%{transform:translateX(4px)}60%{transform:translateX(-2px)}80%{transform:translateX(2px)}100%{transform:translateX(0)}",
    pulse: "0%{transform:scale(1)}50%{transform:scale(1.15)}100%{transform:scale(1)}",
    wiggle: "0%{transform:rotate(0)}15%{transform:rotate(-10deg)}30%{transform:rotate(10deg)}45%{transform:rotate(-8deg)}60%{transform:rotate(8deg)}75%{transform:rotate(-4deg)}90%{transform:rotate(4deg)}100%{transform:rotate(0)}",
    flip: "0%{transform:perspective(400px) rotateY(0)}50%{transform:perspective(400px) rotateY(180deg)}100%{transform:perspective(400px) rotateY(360deg)}",
};
const ANIM_EASE = { spin: "ease-in-out", flip: "ease-in-out" };

// Variáveis de estado não herdáveis: sem isso cada Glo* passaria ~30 custom
// properties a todos os descendentes (recalc de estilo mais caro em qualquer
// filho animado) e um Glo* aninhado herdaria o hover do pai.
const PROPS = [["b", BTN_KEYS], ["c", CARD_KEYS], ["t", TOGGLE_KEYS], ["in", INPUT_KEYS]]
    .flatMap(([p, keys]) => keys.flatMap(([, k]) => ["", "-h", "-on", "-p"].map(suf => `--${p}-${k}${suf}`)));
const PROPERTY_RULES = [...new Set(PROPS)].map(n => `@property ${n}{syntax:'*';inherits:false}`).join("\n");

const CSS = `
${PROPERTY_RULES}
@keyframes dc-rainbow-move{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
.dc-rainbow-text{background:linear-gradient(90deg,#ff0000,#ffa500,#ffff00,#008000,#0000ff,#4b0082,#ee82ee,#ff0000);background-size:200% auto;color:transparent!important;-webkit-background-clip:text;background-clip:text;animation:dc-rainbow-move 3s linear infinite;font-weight:bold;text-shadow:none!important}
@keyframes dc-spin{to{transform:rotate(360deg)}}
${Object.entries(ANIMS).map(([n, k]) => `@keyframes dc-anim-${n}-keyframes{${k}}
.dc-anim-${n}{animation:dc-anim-${n}-keyframes var(--dc-anim-duration,.3s) ${ANIM_EASE[n] || "ease-out"}}
.dc-anim-${n}-loop{animation:dc-anim-${n}-keyframes var(--dc-anim-duration,.3s) ${n === "spin" ? "linear" : (ANIM_EASE[n] || "ease-out")} infinite}`).join("\n")}
@keyframes dc-tab-fade{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
@keyframes dc-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.8;transform:scale(1.05)}}
.dc-pulse-anim{animation:dc-pulse 2s ease-in-out infinite}
.dc-glo-tabs-bar::-webkit-scrollbar{display:none!important;width:0!important;height:0!important}

/* GloButton */
.dcg-btn:not(#dcg){display:inline-flex;align-items:center;justify-content:center;gap:8px;user-select:none;touch-action:manipulation;cursor:pointer;
  transition:transform .3s ease,box-shadow .3s ease,background-color .3s ease,border-color .2s ease,color .2s ease,background-position .3s ease-out;
  ${stateBlock("b", BTN_KEYS)}}
.dcg-btn:not(#dcg):hover:not(:disabled){${stateBlock("b", BTN_KEYS, "h")}}
.dcg-btn:not(#dcg)[data-on],.dcg-btn:not(#dcg)[data-on]:hover:not(:disabled){${stateBlock("b", BTN_KEYS, "on")}}
.dcg-btn:not(#dcg):active:not(:disabled){${stateBlock("b", BTN_KEYS, "p")}}
.dcg-btn:not(#dcg):disabled{cursor:not-allowed;opacity:.5}
/* liquid-glass: na Home o texto em repouso fica no meio-termo entre o suave e o claro (fora dela é a cor de texto normal) */
.home-v5-container .dcg-btn[data-lg]:not(#dcg),.home-v4-container .dcg-btn[data-lg]:not(#dcg){--b-fg:var(--b-fg-mid)!important}
.dcg-btn:not(#dcg)[data-loading]{cursor:wait;opacity:1}
.dcg-btn-spin:not(#dcg){width:1em;height:1em;border:2px solid transparent;border-radius:50%;animation:dc-spin .8s linear infinite}
.dcg-sprite:not(#dcg){flex-shrink:0}
.dcg-sprite:not(#dcg) img{width:100%;height:100%;object-fit:contain;pointer-events:none}

/* GloCard */
.dcg-card:not(#dcg){border-radius:12px;overflow:hidden;transition:transform .2s ease,box-shadow .2s ease,background-color .2s ease,border-color .2s ease;${stateBlock("c", CARD_KEYS)}}
.dcg-card:not(#dcg):hover{${stateBlock("c", CARD_KEYS, "h")}}
.dcg-card:not(#dcg)[data-clickable]{cursor:pointer;touch-action:manipulation}
.dcg-card-head:not(#dcg){display:flex;align-items:center;justify-content:space-between;gap:12px}
.dcg-card-title:not(#dcg){font-weight:bold;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dcg-card-sub:not(#dcg){font-size:12px;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dcg-card-chev:not(#dcg){transition:transform .2s ease}

/* GloToggle */
.dcg-tgl:not(#dcg){cursor:pointer;user-select:none;touch-action:manipulation;transition:transform .3s ease,box-shadow .3s ease,background-color .3s ease,border-color .3s ease;${stateBlock("t", TOGGLE_KEYS)}}
.dcg-tgl:not(#dcg):hover{${stateBlock("t", TOGGLE_KEYS, "h")}}
.dcg-tgl:not(#dcg)[data-on],.dcg-tgl:not(#dcg)[data-on]:hover{${stateBlock("t", TOGGLE_KEYS, "on")}}
.dcg-tgl:not(#dcg):active{${stateBlock("t", TOGGLE_KEYS, "p")}}
.dcg-tgl-rb:not(#dcg):hover .dcg-tgl-label{background:linear-gradient(90deg,#ff0000,#ffa500,#ffff00,#008000,#0000ff,#4b0082,#ee82ee,#ff0000);background-size:200% auto;color:transparent!important;-webkit-background-clip:text;background-clip:text;animation:dc-rainbow-move 3s linear infinite;text-shadow:none!important}

/* GloInput / GloSelect: foco usa o bloco "on" */
.dcg-in:not(#dcg){position:relative;display:flex;align-items:center;touch-action:manipulation;transition:background-color .2s ease,border-color .2s ease,box-shadow .2s ease,background-position .3s ease-out;${stateBlock("in", INPUT_KEYS)}}
.dcg-in:not(#dcg):focus-within,.dcg-in:not(#dcg)[data-on]{${stateBlock("in", INPUT_KEYS, "on")}}
.dcg-in:not(#dcg)[data-err]{border-color:var(--in-err)}
.dcg-in-field:not(#dcg){flex:1;width:100%;background:transparent;border:none;outline:none;box-shadow:none;font-family:inherit}
.dcg-in-icon:not(#dcg){position:absolute;pointer-events:none;display:flex;align-items:center}
.dcg-in-clear:not(#dcg){position:absolute;right:4px;display:flex;align-items:center;justify-content:center;min-width:44px;min-height:44px;cursor:pointer;touch-action:manipulation}

.dcg-opt:not(#dcg){display:flex;align-items:center;gap:10px;min-height:44px;cursor:pointer;touch-action:manipulation;transition:background-color .15s ease}
.dcg-opt:not(#dcg):hover,.dcg-opt:not(#dcg)[data-focus]{background:var(--background-secondary-alt,rgba(0,0,0,.05))}
.dcg-opt:not(#dcg)[data-sel]{background:var(--opt-sel-bg);color:var(--opt-sel-fg)}
.dcg-opt:not(#dcg)[aria-disabled=true]{cursor:not-allowed;opacity:.4}

/* GloRating: forma chapada no lugar do emoji (mesmo tamanho e opacidades do original); hover só cresce, em CSS (ordem invertida no DOM) */
.dcg-rate:not(#dcg){display:inline-flex;flex-direction:row-reverse;gap:2px;align-items:center}
.dcg-pip:not(#dcg){width:var(--cell,22px);height:var(--cell,22px);display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--text-muted);opacity:.2;transition:all .15s ease;user-select:none;touch-action:manipulation}
.dcg-pip:not(#dcg) svg{width:var(--pip,15px);height:var(--pip,15px);display:block;overflow:visible}
.dcg-pip:not(#dcg) .on{display:none}
.dcg-pip:not(#dcg)[data-on]{color:var(--rate-c);opacity:.65}
.dcg-pip:not(#dcg)[data-on] .on{display:block}
.dcg-pip:not(#dcg)[data-on] .off{display:none}
.dcg-pip:not(#dcg):hover,.dcg-pip:not(#dcg):hover ~ .dcg-pip{transform:scale(1.2)}
.dcg-pip:not(#dcg)[data-on]:hover,.dcg-pip:not(#dcg):hover ~ .dcg-pip[data-on]{opacity:.95}
.dcg-rate:not(#dcg)[data-ro] .dcg-pip{cursor:default}
.dcg-rate:not(#dcg)[data-ro] .dcg-pip:hover,.dcg-rate:not(#dcg)[data-ro] .dcg-pip:hover ~ .dcg-pip{transform:none}

.dcg-chip:not(#dcg){transition:transform .15s ease,background-color .15s ease,border-color .15s ease}
.dcg-chip:not(#dcg):hover{transform:translateY(-1px);background-color:color-mix(in srgb,var(--text-muted) 7%,transparent)}
.dcg-tag-x:not(#dcg):hover{color:var(--text-error);background:color-mix(in srgb,var(--text-error) 15%,transparent)!important}

.dcg-link:not(#dcg){text-decoration:underline;text-decoration-color:color-mix(in srgb,currentColor 25%,transparent);transition:color .12s ease}
.dcg-link:not(#dcg):hover{color:var(--text-accent)}

/* GloBadge */
.dcg-badge:not(#dcg){display:inline-flex;align-items:center;justify-content:center;font-weight:600;line-height:1;white-space:nowrap;user-select:none;transition:background-color .2s ease,box-shadow .2s ease}
.dcg-badge-x:not(#dcg){display:flex;align-items:center;justify-content:center;border-radius:50%;cursor:pointer;touch-action:manipulation;margin-left:2px;margin-right:-4px;
  background:var(--background-modifier-hover,rgba(0,0,0,.1));transition:background .15s ease}
.dcg-badge-x:not(#dcg):hover,.dcg-badge-x:not(#dcg):active{background:var(--background-modifier-active,rgba(0,0,0,.2))}
`;

function ensureCSS() {
    let el = document.getElementById(CSS_ID);
    if (el && el.dataset.v === CSS_VERSION) return;
    if (!el) { el = document.createElement("style"); el.id = CSS_ID; document.head.appendChild(el); }
    el.dataset.v = CSS_VERSION;
    el.textContent = CSS;
}
ensureCSS();

/** Mantido por compatibilidade: a folha já é injetada no carregamento do módulo. */
function useComponentCSS() { ensureCSS(); }

/** Leitura síncrona de flashy-mode (antes: estado + efeito por instância). */
function useFlashyMode() { return getFlashyMode(); }

/** Reaplica uma classe de animação num elemento (reinicia a animação se já estiver nela). */
function playClass(el, cls, ms) {
    if (!el || !cls) return;
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
    clearTimeout(el.__dcAnim);
    el.__dcAnim = setTimeout(() => el.classList.remove(cls), ms);
}

// ═══════════════════════════════════════════════════════════════════════════════
// GLOBUTTON
// ═══════════════════════════════════════════════════════════════════════════════

const SIZES = {
    small: { pad: "6px 12px", fs: "12px", rad: "6px" },
    medium: { pad: "10px 20px", fs: "14px", rad: "8px" },
    large: { pad: "10px 20px", fs: "14px", rad: "8px" },
};

function GloButton({
    label,
    onClick = () => {},
    variant = "primary",
    size = "medium",
    bg = null, hoverBg = null, activeBg = null,
    bgSize = null, bgRepeat = null, bgPosition = null,
    hoverBgSize = null, hoverBgRepeat = null, hoverBgPosition = null,
    activeBgSize = null, activeBgRepeat = null, activeBgPosition = null,
    transitionDirection = null,
    glow = true, lift = true, press = true, rainbow = false,
    icon = null, iconRight = null,
    showSprite = false, sprite = null, spriteWidth = null, spriteHeight = null,
    spriteAnimation = null, spritePosition = "left",
    disabled = false, loading = false, active = false,
    style = {}, className = "", flashy = null,
    themeOverride = null,
}) {
    const { theme: loaded } = useTheme();
    const theme = themeOverride || loaded;
    const fx = flashy !== null ? flashy : getFlashyMode();
    const spriteRef = dc.useRef(null);
    const labelRef = dc.useRef(null);

    const t = (k, d) => theme[k] || d;
    const sk = `button-size-${size}`;
    const base = SIZES[size] || SIZES.medium;
    const primary = t("color-primary", "#ff69b4");
    const accent = t("color-accent", "#ffff00");
    const solid = t("color-primary", "#667eea");

    const spriteUrl = sprite || theme["button-sprite"] || null;
    const spW = spriteWidth || parseInt(theme["button-sprite-width"]) || 34;
    const spH = spriteHeight || parseInt(theme["button-sprite-height"]) || 21;
    const animation = spriteAnimation || theme["button-sprite-click-animation"] || "bounce";
    const animDuration = theme["button-sprite-click-duration"] || "0.3s";

    // ── valores por estado ───────────────────────────────────────────────────
    const bgState = (value, themeKey, fallback, sz, rp, ps, szK, rpK, psK) => {
        const { c, i } = splitBg(resolveBackground(value, theme[themeKey] || fallback, solid));
        return { c, i, s: sz || theme[szK] || "auto", r: rp || theme[rpK] || "repeat", p: ps || theme[psK] || "center" };
    };
    const idle = { ...bgState(bg, "button-idle-bg", "#667eea", bgSize, bgRepeat, bgPosition, "button-idle-bg-size", "button-idle-bg-repeat", "button-idle-bg-position"), b: "none", fg: t("button-text-color", "var(--text-on-accent)"), sh: "none", t: "none", fw: "bold" };
    const hover = bgState(hoverBg, "button-hover-bg", "#764ba2", hoverBgSize, hoverBgRepeat, hoverBgPosition, "button-hover-bg-size", "button-hover-bg-repeat", "button-hover-bg-position");
    const on = bgState(activeBg, "button-active-bg", "#5a67d8", activeBgSize, activeBgRepeat, activeBgPosition, "button-active-bg-size", "button-active-bg-repeat", "button-active-bg-position");
    let press_ = { ...on };
    let inline = { padding: t(`${sk}-padding`, base.pad), fontSize: t(`${sk}-font`, base.fs), borderRadius: t(`${sk}-radius`, base.rad), textShadow: "0 1px 3px rgba(0,0,0,0.4)" };

    // Efeitos (flashy): elevação/brilho no hover, afundar ao pressionar, brilho ativo.
    if (fx && !disabled) {
        const glowHover = theme["glow-color-hover"] || hexToRgba(accent, 0.4);
        const glowActive = theme["glow-color-active"] || hexToRgba(accent, 0.3);
        const shadows = [glow && `0 0 15px 3px ${glowHover}`, lift && "0 4px 12px rgba(0,0,0,0.25)"].filter(Boolean);
        Object.assign(hover, { t: lift ? "translateY(-2px)" : "none", sh: shadows.length ? shadows.join(", ") : "none" });
        const activeGlow = glow ? `0 0 20px 5px ${glowActive}` : "none";
        Object.assign(on, { t: press ? "translateY(1px) scale(0.98)" : "none", sh: activeGlow });
        Object.assign(press_, { t: press ? "translateY(1px) scale(0.98)" : "none", sh: active ? activeGlow : "none" });
    }

    let states = { idle, hover, on, press: press_ };
    const clear = { i: "none" };
    if (variant === "ghost") {
        states = {
            idle: { ...idle, ...clear, c: "transparent", b: `2px solid ${primary}`, fg: primary },
            hover: { ...hover, ...clear, c: hexToRgba(primary, 0.15) },
            on: { ...on, ...clear, c: hexToRgba(primary, 0.25) },
            press: { ...press_, ...clear, c: hexToRgba(primary, 0.25) },
        };
    } else if (variant === "secondary") {
        const hov = { ...hover, ...clear, c: hexToRgba(primary, 0.1), b: `1px solid ${accent}` };
        states = {
            idle: { ...idle, ...clear, c: "transparent", b: `1px solid ${primary}`, fg: primary },
            hover: hov,
            on: { ...on, ...clear, c: "transparent", b: `1px solid ${primary}` },
            press: { ...press_, ...clear, c: hov.c, b: hov.b },
        };
    } else if (variant === "tab") {
        const lit = { ...clear, c: hexToRgba(primary, 0.15), b: `1px solid ${primary}`, fg: primary };
        states = {
            idle: { ...idle, ...clear, c: "transparent", b: `1px solid ${primary}44`, fg: t("color-text-muted", "#a0a0b0"), fw: 500 },
            hover: { ...hover, ...lit }, on: { ...on, ...lit, fw: 600 }, press: { ...press_, ...lit },
        };
        inline = { ...inline, borderRadius: "16px", padding: "4px 12px", fontSize: "12px" };
    } else if (variant === "liquid-glass") {
        // O liquid-glass tem elevação própria, independente de flashy (como antes).
        const gl = { ...clear, sh: "inset 0 1px 0 rgba(255,255,255,0.15), 0 2px 8px rgba(0,0,0,0.2)", t: "translateY(0px)" };
        const lit = { ...clear, c: hexToRgba(primary, 0.35), b: `1px solid ${primary}88`, sh: "inset 0 1px 0 rgba(255,255,255,0.28), 0 2px 8px rgba(0,0,0,0.2)", fg: primary, fw: 600, t: "translateY(0px)" };
        states = {
            idle: { ...idle, ...gl, c: "transparent", b: `1px solid ${primary}22`, fg: t("color-text", "var(--text-normal)"), fw: 400 },   // texto claro; na Home, meio-termo por CSS (--b-fg-mid)
            hover: { ...clear, c: hexToRgba(primary, 0.2), fg: t("color-text", "var(--text-normal)"), sh: "inset 0 1px 0 rgba(255,255,255,0.22), 0 4px 16px rgba(0,0,0,0.25)", t: "translateY(-2px)" },
            on: lit, press: lit,
        };
        inline = { ...inline, borderRadius: "8px", padding: "8px 12px", fontSize: "12px", textShadow: "none", backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)", "--b-fg-mid": `color-mix(in srgb, ${t("color-text", "var(--text-normal)")} 55%, ${t("color-text-muted", "#a0a0b0")})` };
    }

    const showRainbow = fx && rainbow;
    if (showRainbow) inline.textShadow = "none";

    const handleClick = () => {
        if (disabled || loading) return;
        if (showSprite && spriteUrl && fx && animation !== "none") {
            playClass(spriteRef.current, `dc-anim-${animation}`, (parseFloat(animDuration) || 0.3) * 1000 + 100);
        }
        if (fx && !rainbow && labelRef.current) {
            labelRef.current.classList.add("dc-rainbow-text");
            clearTimeout(labelRef.current.__dcRb);
            labelRef.current.__dcRb = setTimeout(() => labelRef.current?.classList.remove("dc-rainbow-text"), 2000);
        }
        onClick();
    };

    const spriteEl = (
        <div ref={spriteRef} className="dcg-sprite" style={{ width: `${spW}px`, height: `${spH}px`, "--dc-anim-duration": animDuration }}>
            <img src={spriteUrl} alt="" draggable={false} />
        </div>
    );
    const withSprite = showSprite && spriteUrl && !loading;

    return (
        <button
            onClick={handleClick}
            disabled={disabled || loading}
            data-on={active ? "" : undefined}
            data-lg={variant === "liquid-glass" ? "" : undefined}
            data-loading={loading ? "" : undefined}
            className={`dcg-btn dc-glo-button ${className}`.trim()}
            style={{ ...stateVars("b", states), ...inline, ...style }}
        >
            {loading && <span className="dcg-btn-spin" style={{ borderTopColor: idle.fg }} />}
            {withSprite && spritePosition === "left" && spriteEl}
            {icon && !loading && !showSprite && <span>{icon}</span>}
            <span ref={labelRef} className={showRainbow ? "dc-rainbow-text" : ""}>{label}</span>
            {iconRight && !showSprite && <span>{iconRight}</span>}
            {withSprite && spritePosition === "right" && spriteEl}
        </button>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEMO E EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

const renderedView = (
    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", padding: "1rem" }}>
        <GloButton label="Primary" />
        <GloButton label="Secondary" variant="secondary" />
        <GloButton label="Liquid glass" variant="liquid-glass" />
        <GloButton label="Ativo" variant="liquid-glass" active />
    </div>
);

return {
    renderedView,
    GloButton,
    resolveBackground,
    useComponentCSS,
    useFlashyMode,
    hexToRgba,
    alpha,
    splitBg,
    stateVars,
    asset,
    playClass,
};
