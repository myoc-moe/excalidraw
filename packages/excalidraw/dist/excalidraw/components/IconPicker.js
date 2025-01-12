import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { useEffect } from "react";
import * as Popover from "@radix-ui/react-popover";
import "./IconPicker.scss";
import { isArrowKey, KEYS } from "../keys";
import { getLanguage, t } from "../i18n";
import clsx from "clsx";
import Collapsible from "./Stats/Collapsible";
import { atom, useAtom } from "jotai";
import { jotaiScope } from "../jotai";
import { useDevice } from "..";
const moreOptionsAtom = atom(false);
function Picker({ options, value, label, onChange, onClose, numberOfOptionsToAlwaysShow = options.length, }) {
    const device = useDevice();
    const handleKeyDown = (event) => {
        const pressedOption = options.find((option) => option.keyBinding === event.key.toLowerCase());
        if (!(event.metaKey || event.altKey || event.ctrlKey) && pressedOption) {
            // Keybinding navigation
            onChange(pressedOption.value);
            event.preventDefault();
        }
        else if (event.key === KEYS.TAB) {
            const index = options.findIndex((option) => option.value === value);
            const nextIndex = event.shiftKey
                ? (options.length + index - 1) % options.length
                : (index + 1) % options.length;
            onChange(options[nextIndex].value);
        }
        else if (isArrowKey(event.key)) {
            // Arrow navigation
            const isRTL = getLanguage().rtl;
            const index = options.findIndex((option) => option.value === value);
            if (index !== -1) {
                const length = options.length;
                let nextIndex = index;
                switch (event.key) {
                    // Select the next option
                    case isRTL ? KEYS.ARROW_LEFT : KEYS.ARROW_RIGHT:
                        nextIndex = (index + 1) % length;
                        break;
                    // Select the previous option
                    case isRTL ? KEYS.ARROW_RIGHT : KEYS.ARROW_LEFT:
                        nextIndex = (length + index - 1) % length;
                        break;
                    // Go the next row
                    case KEYS.ARROW_DOWN: {
                        nextIndex = (index + (numberOfOptionsToAlwaysShow ?? 1)) % length;
                        break;
                    }
                    // Go the previous row
                    case KEYS.ARROW_UP: {
                        nextIndex =
                            (length + index - (numberOfOptionsToAlwaysShow ?? 1)) % length;
                        break;
                    }
                }
                onChange(options[nextIndex].value);
            }
            event.preventDefault();
        }
        else if (event.key === KEYS.ESCAPE || event.key === KEYS.ENTER) {
            // Close on escape or enter
            event.preventDefault();
            onClose();
        }
        event.nativeEvent.stopImmediatePropagation();
        event.stopPropagation();
    };
    const [showMoreOptions, setShowMoreOptions] = useAtom(moreOptionsAtom, jotaiScope);
    const alwaysVisibleOptions = React.useMemo(() => options.slice(0, numberOfOptionsToAlwaysShow), [options, numberOfOptionsToAlwaysShow]);
    const moreOptions = React.useMemo(() => options.slice(numberOfOptionsToAlwaysShow), [options, numberOfOptionsToAlwaysShow]);
    useEffect(() => {
        if (!alwaysVisibleOptions.some((option) => option.value === value)) {
            setShowMoreOptions(true);
        }
    }, [value, alwaysVisibleOptions, setShowMoreOptions]);
    const renderOptions = (options) => {
        return (_jsx("div", { className: "picker-content", children: options.map((option, i) => (_jsxs("button", { type: "button", className: clsx("picker-option", {
                    active: value === option.value,
                }), onClick: (event) => {
                    onChange(option.value);
                }, title: `${option.text} ${option.keyBinding && `— ${option.keyBinding.toUpperCase()}`}`, "aria-label": option.text || "none", "aria-keyshortcuts": option.keyBinding || undefined, ref: (ref) => {
                    if (value === option.value) {
                        // Use a timeout here to render focus properly
                        setTimeout(() => {
                            ref?.focus();
                        }, 0);
                    }
                }, children: [option.icon, option.keyBinding && (_jsx("span", { className: "picker-keybinding", children: option.keyBinding }))] }, option.text))) }));
    };
    return (_jsx(Popover.Content, { side: device.editor.isMobile && !device.viewport.isLandscape
            ? "top"
            : "bottom", align: "start", sideOffset: 12, style: { zIndex: "var(--zIndex-popup)" }, onKeyDown: handleKeyDown, children: _jsxs("div", { className: `picker`, role: "dialog", "aria-modal": "true", "aria-label": label, children: [renderOptions(alwaysVisibleOptions), moreOptions.length > 0 && (_jsx(Collapsible, { label: t("labels.more_options"), open: showMoreOptions, openTrigger: () => {
                        setShowMoreOptions((value) => !value);
                    }, className: "picker-collapsible", children: renderOptions(moreOptions) }))] }) }));
}
export function IconPicker({ value, label, options, onChange, group = "", numberOfOptionsToAlwaysShow, }) {
    const [isActive, setActive] = React.useState(false);
    const rPickerButton = React.useRef(null);
    return (_jsx("div", { children: _jsxs(Popover.Root, { open: isActive, onOpenChange: (open) => setActive(open), children: [_jsx(Popover.Trigger, { name: group, type: "button", "aria-label": label, onClick: () => setActive(!isActive), ref: rPickerButton, className: isActive ? "active" : "", children: options.find((option) => option.value === value)?.icon }), isActive && (_jsx(Picker, { options: options, value: value, label: label, onChange: onChange, onClose: () => {
                        setActive(false);
                    }, numberOfOptionsToAlwaysShow: numberOfOptionsToAlwaysShow }))] }) }));
}
