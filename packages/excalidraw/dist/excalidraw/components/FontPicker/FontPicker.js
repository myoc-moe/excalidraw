import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { useCallback, useMemo } from "react";
import * as Popover from "@radix-ui/react-popover";
import { FontPickerList } from "./FontPickerList";
import { FontPickerTrigger } from "./FontPickerTrigger";
import { ButtonIconSelect } from "../ButtonIconSelect";
import { FontFamilyCodeIcon, FontFamilyNormalIcon, FreedrawIcon, } from "../icons";
import { ButtonSeparator } from "../ButtonSeparator";
import { FONT_FAMILY } from "../../constants";
import { t } from "../../i18n";
import "./FontPicker.scss";
export const DEFAULT_FONTS = [
    {
        value: FONT_FAMILY.Excalifont,
        icon: FreedrawIcon,
        text: t("labels.handDrawn"),
        testId: "font-family-hand-drawn",
    },
    {
        value: FONT_FAMILY.Nunito,
        icon: FontFamilyNormalIcon,
        text: t("labels.normal"),
        testId: "font-family-normal",
    },
    {
        value: FONT_FAMILY["Comic Shanns"],
        icon: FontFamilyCodeIcon,
        text: t("labels.code"),
        testId: "font-family-code",
    },
];
const defaultFontFamilies = new Set(DEFAULT_FONTS.map((x) => x.value));
export const isDefaultFont = (fontFamily) => {
    if (!fontFamily) {
        return false;
    }
    return defaultFontFamilies.has(fontFamily);
};
export const FontPicker = React.memo(({ isOpened, selectedFontFamily, hoveredFontFamily, onSelect, onHover, onLeave, onPopupChange, }) => {
    const defaultFonts = useMemo(() => DEFAULT_FONTS, []);
    const onSelectCallback = useCallback((value) => {
        if (value) {
            onSelect(value);
        }
    }, [onSelect]);
    return (_jsxs("div", { role: "dialog", "aria-modal": "true", className: "FontPicker__container", children: [_jsx(ButtonIconSelect, { type: "button", options: defaultFonts, value: selectedFontFamily, onClick: onSelectCallback }), _jsx(ButtonSeparator, {}), _jsxs(Popover.Root, { open: isOpened, onOpenChange: onPopupChange, children: [_jsx(FontPickerTrigger, { selectedFontFamily: selectedFontFamily }), isOpened && (_jsx(FontPickerList, { selectedFontFamily: selectedFontFamily, hoveredFontFamily: hoveredFontFamily, onSelect: onSelectCallback, onHover: onHover, onLeave: onLeave, onOpen: () => onPopupChange(true), onClose: () => onPopupChange(false) }))] })] }));
}, (prev, next) => prev.isOpened === next.isOpened &&
    prev.selectedFontFamily === next.selectedFontFamily &&
    prev.hoveredFontFamily === next.hoveredFontFamily);
