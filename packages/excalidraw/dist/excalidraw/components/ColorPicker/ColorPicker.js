import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { isTransparent } from "../../utils";
import { TopPicks } from "./TopPicks";
import { ButtonSeparator } from "../ButtonSeparator";
import { Picker } from "./Picker";
import * as Popover from "@radix-ui/react-popover";
import { useAtom } from "jotai";
import { activeColorPickerSectionAtom } from "./colorPickerUtils";
import { useExcalidrawContainer } from "../App";
import { COLOR_PALETTE } from "../../colors";
import PickerHeading from "./PickerHeading";
import { t } from "../../i18n";
import clsx from "clsx";
import { useRef } from "react";
import { jotaiScope } from "../../jotai";
import { ColorInput } from "./ColorInput";
import { activeEyeDropperAtom } from "../EyeDropper";
import { PropertiesPopover } from "../PropertiesPopover";
import "./ColorPicker.scss";
const isValidColor = (color) => {
    const style = new Option().style;
    style.color = color;
    return !!style.color;
};
export const getColor = (color) => {
    if (isTransparent(color)) {
        return color;
    }
    // testing for `#` first fixes a bug on Electron (more specfically, an
    // Obsidian popout window), where a hex color without `#` is (incorrectly)
    // considered valid
    return isValidColor(`#${color}`)
        ? `#${color}`
        : isValidColor(color)
            ? color
            : null;
};
const ColorPickerPopupContent = ({ type, color, onChange, label, elements, palette = COLOR_PALETTE, updateData, }) => {
    const { container } = useExcalidrawContainer();
    const [, setActiveColorPickerSection] = useAtom(activeColorPickerSectionAtom);
    const [eyeDropperState, setEyeDropperState] = useAtom(activeEyeDropperAtom, jotaiScope);
    const colorInputJSX = (_jsxs("div", { children: [_jsx(PickerHeading, { children: t("colorPicker.hexCode") }), _jsx(ColorInput, { color: color, label: label, onChange: (color) => {
                    onChange(color);
                }, colorPickerType: type })] }));
    const popoverRef = useRef(null);
    const focusPickerContent = () => {
        popoverRef.current
            ?.querySelector(".color-picker-content")
            ?.focus();
    };
    return (_jsx(PropertiesPopover, { container: container, style: { maxWidth: "13rem" }, onFocusOutside: (event) => {
            // refocus due to eye dropper
            focusPickerContent();
            event.preventDefault();
        }, onPointerDownOutside: (event) => {
            if (eyeDropperState) {
                // prevent from closing if we click outside the popover
                // while eyedropping (e.g. click when clicking the sidebar;
                // the eye-dropper-backdrop is prevented downstream)
                event.preventDefault();
            }
        }, onClose: () => {
            updateData({ openPopup: null });
            setActiveColorPickerSection(null);
        }, children: palette ? (_jsx(Picker, { palette: palette, color: color, onChange: (changedColor) => {
                onChange(changedColor);
            }, onEyeDropperToggle: (force) => {
                setEyeDropperState((state) => {
                    if (force) {
                        state = state || {
                            keepOpenOnAlt: true,
                            onSelect: onChange,
                            colorPickerType: type,
                        };
                        state.keepOpenOnAlt = true;
                        return state;
                    }
                    return force === false || state
                        ? null
                        : {
                            keepOpenOnAlt: false,
                            onSelect: onChange,
                            colorPickerType: type,
                        };
                });
            }, onEscape: (event) => {
                if (eyeDropperState) {
                    setEyeDropperState(null);
                }
                else {
                    updateData({ openPopup: null });
                }
            }, label: label, type: type, elements: elements, updateData: updateData, children: colorInputJSX })) : (colorInputJSX) }));
};
const ColorPickerTrigger = ({ label, color, type, }) => {
    return (_jsx(Popover.Trigger, { type: "button", className: clsx("color-picker__button active-color properties-trigger", {
            "is-transparent": color === "transparent" || !color,
        }), "aria-label": label, style: color ? { "--swatch-color": color } : undefined, title: type === "elementStroke"
            ? t("labels.showStroke")
            : t("labels.showBackground"), children: _jsx("div", { className: "color-picker__button-outline" }) }));
};
export const ColorPicker = ({ type, color, onChange, label, elements, palette = COLOR_PALETTE, topPicks, updateData, appState, }) => {
    return (_jsx("div", { children: _jsxs("div", { role: "dialog", "aria-modal": "true", className: "color-picker-container", children: [_jsx(TopPicks, { activeColor: color, onChange: onChange, type: type, topPicks: topPicks }), _jsx(ButtonSeparator, {}), _jsxs(Popover.Root, { open: appState.openPopup === type, onOpenChange: (open) => {
                        updateData({ openPopup: open ? type : null });
                    }, children: [_jsx(ColorPickerTrigger, { color: color, label: label, type: type }), appState.openPopup === type && (_jsx(ColorPickerPopupContent, { type: type, color: color, onChange: onChange, label: label, elements: elements, palette: palette, updateData: updateData }))] })] }) }));
};
