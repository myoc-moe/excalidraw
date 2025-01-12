import { jsx as _jsx } from "react/jsx-runtime";
import * as Popover from "@radix-ui/react-popover";
import { useMemo } from "react";
import { ButtonIcon } from "../ButtonIcon";
import { TextIcon } from "../icons";
import { t } from "../../i18n";
import { isDefaultFont } from "./FontPicker";
export const FontPickerTrigger = ({ selectedFontFamily, }) => {
    const isTriggerActive = useMemo(() => Boolean(selectedFontFamily && !isDefaultFont(selectedFontFamily)), [selectedFontFamily]);
    return (_jsx(Popover.Trigger, { asChild: true, children: _jsx("div", { children: _jsx(ButtonIcon, { standalone: true, icon: TextIcon, title: t("labels.showFonts"), className: "properties-trigger", testId: "font-family-show-fonts", active: isTriggerActive, 
                // no-op
                onClick: () => { } }) }) }));
};
