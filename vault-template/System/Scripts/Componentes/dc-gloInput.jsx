// ═══════════════════════════════════════════════════════════════════════════════
// DC-GLO-INPUT v3 - campo de texto/número/área da família Glo*
//
// - Com targetKey, o campo mostra um rascunho local enquanto tem foco e o
//   frontmatter fora do foco. Antes o valor exibido vinha do frontmatter a cada
//   tecla e, até o índice atualizar, o Preact devolvia o valor velho: letras
//   sumiam ao digitar rápido.
// - Foco (borda, fundo, brilho) é CSS :focus-within; não re-renderiza.
// - Sem targetFile grava na nota do bloco.
// ═══════════════════════════════════════════════════════════════════════════════

const { useTheme, getFlashyMode } = await dc.require(dc.fileLink("System/Scripts/Core/dc-themeProvider.jsx"));
const { resolveBackground, hexToRgba, splitBg, stateVars, useComponentCSS } = await dc.require(dc.fileLink("System/Scripts/Componentes/dc-gloButton.jsx"));

const SIZES = {
    small: { padding: "6px 10px", fontSize: "12px", height: "32px", labelSize: "11px" },
    medium: { padding: "10px 14px", fontSize: "14px", height: "40px", labelSize: "12px" },
    large: { padding: "14px 18px", fontSize: "16px", height: "48px", labelSize: "14px" },
};

function GloInput({
    value = "", defaultValue = "", targetKey = null, targetFile = null,
    type = "text", label = null, placeholder = "", helperText = null,
    iconLeft = null, iconRight = null,
    required = false, minLength = null, maxLength = null, min = null, max = null, pattern = null, validate = null, showError = true,
    size = "medium", variant = "default", width = "100%", rows = 3, autoResize = false,
    disabled = false, readOnly = false, autoFocus = false, clearable = false, debounce = 0, glow = true,
    onChange = null, onFocus = null, onBlur = null, onEnter = null, onClear = null,
    style = {}, inputStyle = {}, className = "", flashy = null,
    bgOverride = null, borderOverride = null, borderFocusOverride = null, accentColorOverride = null,
    bgSize = null, bgRepeat = null, bgPosition = null, focusBgSize = null, focusBgRepeat = null, focusBgPosition = null,
    transitionDirection = null, themeOverride = null,
}) {
    useComponentCSS();
    const { theme: loaded } = useTheme();
    const theme = themeOverride || loaded;
    const fx = flashy !== null ? flashy : getFlashyMode();
    const ownPath = dc.useCurrentPath();
    const page = dc.useFile(targetFile || ownPath);
    const [local, setLocal] = dc.useState(defaultValue);
    const [draft, setDraft] = dc.useState(null);      // rascunho enquanto focado (com targetKey)
    const [error, setError] = dc.useState(null);
    const [touched, setTouched] = dc.useState(false);
    const inputRef = dc.useRef(null), debounceRef = dc.useRef(null);

    dc.useEffect(() => { if (autoFocus) inputRef.current?.focus(); }, []);
    dc.useEffect(() => () => clearTimeout(debounceRef.current), []);

    const stored = targetKey ? (page?.value?.(targetKey) ?? "") : "";
    const current = value !== "" ? value : targetKey ? (draft !== null ? draft : stored) : local;

    const validateValue = (val) => {
        const v = val == null ? "" : String(val);
        if (required && !v) return "This field is required";
        if (minLength && v.length < minLength) return `Minimum ${minLength} characters required`;
        if (maxLength && v.length > maxLength) return `Maximum ${maxLength} characters allowed`;
        if (type === "number") {
            const n = parseFloat(v);
            if (min !== null && n < min) return `Minimum value is ${min}`;
            if (max !== null && n > max) return `Maximum value is ${max}`;
        }
        if (pattern && !new RegExp(pattern).test(v)) return "Invalid format";
        if (validate) return validate(v);
        return null;
    };

    const commit = async (next) => {
        const out = type === "number" ? parseFloat(next) || 0 : next;
        if (targetKey) {
            const file = app.vault.getAbstractFileByPath(targetFile || ownPath);
            if (file) await app.fileManager.processFrontMatter(file, fm => { fm[targetKey] = out; });
        }
        if (onChange) onChange(out);
    };
    const update = (next) => {
        setLocal(next);
        if (targetKey) setDraft(next);
        if (touched) setError(validateValue(next));
        clearTimeout(debounceRef.current);
        if (debounce > 0) debounceRef.current = setTimeout(() => commit(next), debounce);
        else commit(next);
    };

    const t = (k, d) => theme[k] || d;
    const sizing = SIZES[size] || SIZES.medium;
    const primary = accentColorOverride || t("color-primary", "#ff69b4");
    const text = t("input-text-color", t("color-text", "var(--text-normal)"));
    const muted = t("color-text-muted", "#888");
    const errorColor = t("color-error", "#ff0000");
    const border = borderOverride || t("input-border", "1px solid rgba(255,105,180,0.3)");
    const borderFocus = borderFocusOverride || t("input-border-focus", "1px solid #ff69b4");
    const hasError = touched && error;

    const bgIdle = { s: bgSize || t("input-bg-size", "auto"), r: bgRepeat || t("input-bg-repeat", "repeat"), p: bgPosition || t("input-bg-position", "center") };
    const bgFocus = { s: focusBgSize || t("input-focus-bg-size", "auto"), r: focusBgRepeat || t("input-focus-bg-repeat", "repeat"), p: focusBgPosition || t("input-focus-bg-position", "center") };
    const glowSh = fx && glow ? `0 0 15px ${hexToRgba(hasError ? errorColor : primary, 0.4)}` : null;
    let idle, focus;
    switch (variant) {
        case "filled": {
            const sf = splitBg(resolveBackground(t("color-surface", "#2a2a4e")));
            idle = { ...bgIdle, ...sf, b: "1px solid transparent", sh: "none" };
            focus = { ...bgFocus, b: borderFocus, sh: glowSh || "none" };
            break;
        }
        case "ghost":
            idle = { ...bgIdle, c: "transparent", i: "none", b: "1px solid transparent", sh: "none" };
            focus = { ...bgFocus, b: borderFocus, sh: glowSh || "none" };
            break;
        case "liquid-glass":
            idle = { ...bgIdle, c: "transparent", i: "none", b: `1px solid ${primary}22`, sh: "inset 0 1px 0 rgba(255,255,255,0.15), 0 2px 8px rgba(0,0,0,0.2)" };
            focus = { ...bgFocus, c: hexToRgba(primary, 0.15), b: borderFocus, sh: ["inset 0 1px 0 rgba(255,255,255,0.22)", glowSh].filter(Boolean).join(", ") };
            break;
        default:
            idle = { ...bgIdle, ...splitBg(resolveBackground(bgOverride || t("input-bg", "var(--background-secondary-alt, rgba(0,0,0,0.05))"))), b: border, sh: "none" };
            focus = { ...bgFocus, b: borderFocus, sh: glowSh || "none" };
    }

    const Field = type === "textarea" ? "textarea" : "input";
    const padX = sizing.padding.split(" ")[1];
    const showClear = clearable && current;

    return (
        <div className={`dc-glo-input ${className}`.trim()} style={{ width, ...style }}>
            {label && (
                <label style={{ display: "block", marginBottom: "6px", fontSize: sizing.labelSize, fontWeight: "bold", color: text }}>
                    {label}{required && <span style={{ color: errorColor, marginLeft: "4px" }}>*</span>}
                </label>
            )}
            <div className="dcg-in" data-err={hasError ? "" : undefined}
                style={{
                    ...stateVars("in", { idle, on: focus }), "--in-err": errorColor,
                    minHeight: type === "textarea" ? "auto" : sizing.height,
                    borderRadius: t("input-border-radius", "6px"),
                    ...(variant === "liquid-glass" ? { backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)" } : null),
                }}>
                {iconLeft && (
                    <span className="dcg-in-icon" style={{ left: "12px", color: muted, fontSize: sizing.fontSize, ...(type === "textarea" ? { top: "12px" } : { top: "50%", transform: "translateY(-50%)" }) }}>{iconLeft}</span>
                )}
                <Field
                    ref={inputRef} className="dcg-in-field"
                    type={type === "textarea" ? undefined : type}
                    rows={type === "textarea" ? rows : undefined}
                    value={current ?? ""} placeholder={placeholder}
                    disabled={disabled} readOnly={readOnly} maxLength={maxLength} min={min} max={max}
                    onInput={e => update(e.target.value)}
                    onFocus={e => { if (targetKey) setDraft(String(stored ?? "")); if (onFocus) onFocus(e); }}
                    onBlur={e => { setTouched(true); setError(validateValue(current)); if (targetKey) setDraft(null); if (onBlur) onBlur(e); }}
                    onKeyDown={e => { if (e.key === "Enter" && type !== "textarea" && onEnter) onEnter(current); }}
                    style={{
                        padding: sizing.padding, paddingLeft: iconLeft ? "36px" : padX, paddingRight: (iconRight || clearable) ? "36px" : padX,
                        fontSize: sizing.fontSize, color: text,
                        resize: type === "textarea" ? (autoResize ? "none" : "vertical") : undefined,
                        ...inputStyle,
                    }}
                />
                {showClear && (
                    <span className="dcg-in-clear" style={{ color: muted, ...(type === "textarea" ? { top: "4px" } : { top: "50%", transform: "translateY(-50%)" }) }}
                        onClick={() => { update(""); if (onClear) onClear(); inputRef.current?.focus(); }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                    </span>
                )}
                {iconRight && !showClear && (
                    <span className="dcg-in-icon" style={{ right: "12px", color: muted, fontSize: sizing.fontSize, ...(type === "textarea" ? { top: "12px" } : { top: "50%", transform: "translateY(-50%)" }) }}>{iconRight}</span>
                )}
            </div>
            {(helperText || (showError && hasError)) && (
                <div style={{ marginTop: "4px", fontSize: "11px", color: hasError ? errorColor : muted }}>{hasError ? error : helperText}</div>
            )}
        </div>
    );
}

const renderedView = (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem", padding: "1rem", maxWidth: "350px" }}>
        <GloInput label="Nome" placeholder="Seu nome" helperText="Nome de exibição" />
        <GloInput label="Busca" placeholder="Buscar notas" clearable />
        <GloInput label="Quantidade" type="number" min={0} max={100} />
        <GloInput label="Notas" type="textarea" rows={4} />
    </div>
);

return { renderedView, GloInput };
