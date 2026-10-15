// ═══════════════════════════════════════════════════════════════════════════════
// DC-GLO-SELECT v3 - seletor (simples ou múltiplo, com busca) da família Glo*
// - Valor: controlado (value), ligado ao frontmatter (targetKey, reativo,
//   gravando na nota do bloco) ou local.
// - Hover das opções em CSS; o índice sob o mouse fica num ref (o Enter
//   continua escolhendo a opção sob o mouse, sem render por opção sobrevoada).
// ═══════════════════════════════════════════════════════════════════════════════

const { useTheme, getFlashyMode } = await dc.require(dc.fileLink("System/Scripts/Core/dc-themeProvider.jsx"));
const { resolveBackground, hexToRgba, splitBg, stateVars, useComponentCSS } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloButton.jsx"));

const SIZES = {
    small: { padding: "6px 10px", fontSize: "12px", radius: "6px", height: "32px" },
    medium: { padding: "10px 14px", fontSize: "14px", radius: "8px", height: "40px" },
    large: { padding: "14px 18px", fontSize: "16px", radius: "10px", height: "48px" },
};
const normalize = (opt) => typeof opt === "string" ? { value: opt, label: opt }
    : { value: opt.value, label: opt.label || opt.value, icon: opt.icon, disabled: opt.disabled || false };

function GloSelect({
    options = [], value = null, defaultValue = null, targetKey = null, targetFile = null,
    placeholder = "Selecionar...", label = null, showIcon = true,
    searchable = false, searchPlaceholder = "Search...",
    multiple = false, maxSelections = null,
    size = "medium", variant = "default", width = "100%", maxHeight = "250px",
    position = "bottom", align = "left", glow = true,
    onChange = null, onOpen = null, onClose = null,
    style = {}, className = "", disabled = false, flashy = null,
    bgOverride = null, borderOverride = null, accentColorOverride = null,
    bgSize = null, bgRepeat = null, bgPosition = null, openBgSize = null, openBgRepeat = null, openBgPosition = null,
    transitionDirection = null, themeOverride = null,
}) {
    useComponentCSS();
    const { theme: loaded } = useTheme();
    const theme = themeOverride || loaded;
    const fx = flashy !== null ? flashy : getFlashyMode();
    const ownPath = dc.useCurrentPath();
    const page = dc.useFile(targetFile || ownPath);
    const [isOpen, setIsOpen] = dc.useState(false);
    const [query, setQuery] = dc.useState("");
    const [local, setLocal] = dc.useState(defaultValue);
    const [pending, setPending] = dc.useState(undefined);
    const [kbIndex, setKbIndex] = dc.useState(-1);
    const [dropPos, setDropPos] = dc.useState(position);
    const boxRef = dc.useRef(null), searchRef = dc.useRef(null), hoverIdx = dc.useRef(-1);

    const opts = options.map(normalize);
    const stored = targetKey ? (page?.value?.(targetKey) ?? null) : null;
    dc.useEffect(() => { if (pending !== undefined && JSON.stringify(stored) === JSON.stringify(pending)) setPending(undefined); }, [stored, pending]);
    const current = value !== null ? value : targetKey ? (pending !== undefined ? pending : stored) : local;
    const selected = multiple ? (Array.isArray(current) ? current : current ? [current] : []) : current;
    const shown = searchable && query
        ? opts.filter(o => String(o.label).toLowerCase().includes(query.toLowerCase()) || String(o.value).toLowerCase().includes(query.toLowerCase()))
        : opts;

    const close = () => { setIsOpen(false); setQuery(""); setKbIndex(-1); hoverIdx.current = -1; if (onClose) onClose(); };
    const open = () => {
        setIsOpen(true);
        setKbIndex(multiple ? -1 : opts.findIndex(o => o.value === current));
        if (onOpen) onOpen();
    };

    // Fora do componente fecha; posição "auto" escolhe o lado com mais espaço.
    dc.useEffect(() => {
        if (!isOpen) return;
        const outside = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) close(); };
        document.addEventListener("pointerdown", outside);
        if (searchable) setTimeout(() => searchRef.current?.focus(), 50);
        if (position === "auto" && boxRef.current) {
            const r = boxRef.current.getBoundingClientRect();
            const below = window.innerHeight - r.bottom, above = r.top;
            setDropPos(below < (parseInt(maxHeight) || 250) && above > below ? "top" : "bottom");
        } else setDropPos(position);
        return () => document.removeEventListener("pointerdown", outside);
    }, [isOpen]);

    const choose = async (val) => {
        let next = val;
        if (multiple) {
            const arr = Array.isArray(selected) ? selected : [];
            if (arr.includes(val)) next = arr.filter(v => v !== val);
            else { if (maxSelections && arr.length >= maxSelections) return; next = [...arr, val]; }
        }
        setLocal(next);
        if (targetKey) {
            setPending(next);
            const file = app.vault.getAbstractFileByPath(targetFile || ownPath);
            if (file) await app.fileManager.processFrontMatter(file, fm => { fm[targetKey] = next; });
        }
        if (onChange) onChange(next);
        if (!multiple) close();
    };

    const onKey = (e) => {
        if (disabled) return;
        const idx = kbIndex >= 0 ? kbIndex : hoverIdx.current;
        switch (e.key) {
            case "Enter": case " ":
                if (!isOpen) { e.preventDefault(); open(); }
                else if (idx >= 0 && shown[idx]) { e.preventDefault(); if (!shown[idx].disabled) choose(shown[idx].value); }
                break;
            case "Escape": close(); break;
            case "ArrowDown": e.preventDefault(); if (!isOpen) open(); else setKbIndex(Math.min(idx + 1, shown.length - 1)); break;
            case "ArrowUp": e.preventDefault(); setKbIndex(Math.max(idx - 1, 0)); break;
        }
    };

    const t = (k, d) => theme[k] || d;
    const sizing = SIZES[size] || SIZES.medium;
    const text = t("color-text", "var(--text-normal)");
    const muted = t("color-text-muted", "#888");
    const primary = accentColorOverride || t("color-primary", "#ff69b4");
    const bgRaw = resolveBackground(bgOverride || t("select-bg", t("input-bg", "var(--background-secondary-alt, rgba(0,0,0,0.05))")));
    const border = borderOverride || t("select-border", t("input-border", "1px solid rgba(255,105,180,0.3)"));
    const borderFocus = t("select-border-focus", t("input-border-focus", "1px solid #ff69b4"));
    const idleBg = { s: bgSize || t("select-bg-size", "auto"), r: bgRepeat || t("select-bg-repeat", "repeat"), p: bgPosition || t("select-bg-position", "center") };
    const openBg = { s: openBgSize || t("select-open-bg-size", "auto"), r: openBgRepeat || t("select-open-bg-repeat", "repeat"), p: openBgPosition || t("select-open-bg-position", "center") };
    const glowSh = fx && glow ? `0 0 15px 3px ${hexToRgba(primary, 0.4)}` : "none";
    let idle, on;
    if (variant === "ghost") { idle = { ...idleBg, c: "transparent", i: "none", b: "1px solid transparent", sh: "none" }; on = { ...openBg, b: border, sh: glowSh }; }
    else if (variant === "minimal") { idle = { ...idleBg, c: "transparent", i: "none", b: "none", sh: "none" }; on = { ...openBg, sh: glowSh }; }
    else { idle = { ...idleBg, ...splitBg(bgRaw), b: border, sh: "none" }; on = { ...openBg, b: borderFocus, sh: glowSh }; }

    const labels = multiple ? selected.map(v => opts.find(o => o.value === v)?.label ?? v) : [];
    const display = multiple
        ? (labels.length === 0 ? placeholder : labels.length <= 2 ? labels.join(", ") : `${labels.length} selecionados`)
        : (opts.find(o => o.value === current)?.label ?? placeholder);
    const icon = !multiple && showIcon ? opts.find(o => o.value === current)?.icon : null;
    const hasValue = multiple ? selected.length > 0 : !!current;
    const surface = splitBg(resolveBackground(t("color-surface", "#2a2a4e")));

    return (
        <div ref={boxRef} className={`dc-glo-select ${className}`.trim()} style={{ width, position: "relative", ...style }}>
            {label && <div style={{ marginBottom: "6px", fontSize: "12px", fontWeight: "bold", color: text }}>{label}</div>}
            <div
                tabIndex={disabled ? -1 : 0} role="combobox" aria-expanded={isOpen} aria-haspopup="listbox" aria-disabled={disabled}
                className="dcg-in" data-on={isOpen ? "" : undefined}
                onClick={() => { if (disabled) return; isOpen ? close() : open(); }}
                onKeyDown={onKey}
                style={{
                    ...stateVars("in", { idle, on }),
                    justifyContent: "space-between", gap: "8px", width: "100%", minHeight: "44px", height: sizing.height,
                    padding: sizing.padding, fontSize: sizing.fontSize, borderRadius: sizing.radius,
                    color: hasValue ? text : muted, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1, outline: "none",
                }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", overflow: "hidden", flex: 1 }}>
                    {icon && <span style={{ flexShrink: 0 }}>{icon}</span>}
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{display}</span>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={muted} strokeWidth="2"
                    style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s ease", flexShrink: 0 }}>
                    <polyline points="6 9 12 15 18 9" />
                </svg>
            </div>
            {isOpen && (
                <div role="listbox" style={{
                    position: "absolute", width: "100%", minWidth: "150px", zIndex: 1000, overflow: "hidden",
                    top: dropPos === "top" ? "auto" : "100%", bottom: dropPos === "top" ? "100%" : "auto",
                    left: align === "right" ? "auto" : 0, right: align === "right" ? 0 : "auto",
                    marginTop: dropPos === "top" ? 0 : "4px", marginBottom: dropPos === "top" ? "4px" : 0,
                    backgroundColor: surface.c, backgroundImage: surface.i, border, borderRadius: sizing.radius,
                    boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
                }}>
                    {searchable && (
                        <div style={{ padding: "8px" }}>
                            <input ref={searchRef} type="text" value={query} placeholder={searchPlaceholder}
                                onInput={e => { setQuery(e.target.value); setKbIndex(0); }}
                                onClick={e => e.stopPropagation()} onKeyDown={onKey}
                                style={{ width: "100%", padding: "8px 12px", fontSize: sizing.fontSize, backgroundColor: splitBg(bgRaw).c, backgroundImage: splitBg(bgRaw).i, border, borderRadius: "4px", color: text, outline: "none" }} />
                        </div>
                    )}
                    <div style={{ maxHeight, overflowY: "auto" }}>
                        {shown.length === 0 ? (
                            <div style={{ padding: sizing.padding, color: muted, textAlign: "center", fontSize: sizing.fontSize }}>No options found</div>
                        ) : shown.map((o, i) => {
                            const sel = multiple ? selected.includes(o.value) : o.value === current;
                            return (
                                <div key={o.value} role="option" aria-selected={sel} aria-disabled={o.disabled}
                                    className="dcg-opt" data-sel={sel ? "" : undefined} data-focus={i === kbIndex ? "" : undefined}
                                    onPointerEnter={() => { hoverIdx.current = i; }}
                                    onClick={() => { if (!o.disabled) choose(o.value); }}
                                    style={{ padding: sizing.padding, fontSize: sizing.fontSize, color: text, "--opt-sel-bg": `${primary}33`, "--opt-sel-fg": primary }}>
                                    {multiple && (
                                        <div style={{ width: "16px", height: "16px", border: `2px solid ${sel ? primary : muted}`, borderRadius: "3px", background: sel ? primary : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                            {sel && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--text-on-accent)" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>}
                                        </div>
                                    )}
                                    {showIcon && o.icon && <span style={{ flexShrink: 0 }}>{o.icon}</span>}
                                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.label}</span>
                                    {!multiple && sel && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={primary} strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

const renderedView = (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem", padding: "1rem", maxWidth: "300px" }}>
        <GloSelect label="Refeição" options={["Café", "Almoço", "Jantar"]} placeholder="Escolha" />
        <GloSelect label="Busca" options={["Maçã", "Banana", "Cereja", "Figo", "Uva"]} searchable />
        <GloSelect label="Vários" options={["Força", "Cardio", "Flexibilidade"]} multiple />
    </div>
);

return { renderedView, GloSelect };
