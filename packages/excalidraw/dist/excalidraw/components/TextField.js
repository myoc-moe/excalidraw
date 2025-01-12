import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { forwardRef, useRef, useImperativeHandle, useLayoutEffect, useState, } from "react";
import clsx from "clsx";
import "./TextField.scss";
import { Button } from "./Button";
import { eyeIcon, eyeClosedIcon } from "./icons";
export const TextField = forwardRef(({ onChange, label, fullWidth, placeholder, readonly, selectOnRender, onKeyDown, isRedacted = false, icon, className, ...rest }, ref) => {
    const innerRef = useRef(null);
    useImperativeHandle(ref, () => innerRef.current);
    useLayoutEffect(() => {
        if (selectOnRender) {
            // focusing first is needed because vitest/jsdom
            innerRef.current?.focus();
            innerRef.current?.select();
        }
    }, [selectOnRender]);
    const [isTemporarilyUnredacted, setIsTemporarilyUnredacted] = useState(false);
    return (_jsxs("div", { className: clsx("ExcTextField", className, {
            "ExcTextField--fullWidth": fullWidth,
            "ExcTextField--hasIcon": !!icon,
        }), onClick: () => {
            innerRef.current?.focus();
        }, children: [icon, label && _jsx("div", { className: "ExcTextField__label", children: label }), _jsxs("div", { className: clsx("ExcTextField__input", {
                    "ExcTextField__input--readonly": readonly,
                }), children: [_jsx("input", { className: clsx({
                            "is-redacted": "value" in rest &&
                                rest.value &&
                                isRedacted &&
                                !isTemporarilyUnredacted,
                        }), readOnly: readonly, value: "value" in rest ? rest.value : undefined, defaultValue: "defaultValue" in rest ? rest.defaultValue : undefined, placeholder: placeholder, ref: innerRef, onChange: (event) => onChange?.(event.target.value), onKeyDown: onKeyDown }), isRedacted && (_jsx(Button, { onSelect: () => setIsTemporarilyUnredacted(!isTemporarilyUnredacted), style: { border: 0, userSelect: "none" }, children: isTemporarilyUnredacted ? eyeClosedIcon : eyeIcon }))] })] }));
});
