import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useRef } from "react";
import { getDropdownMenuItemClassName, useHandleDropdownMenuItemClick, } from "./common";
import MenuItemContent from "./DropdownMenuItemContent";
import { useExcalidrawAppState } from "../App";
import { THEME } from "../../constants";
const DropdownMenuItem = ({ icon, value, order, children, shortcut, className, hovered, selected, textStyle, onSelect, onClick, ...rest }) => {
    const handleClick = useHandleDropdownMenuItemClick(onClick, onSelect);
    const ref = useRef(null);
    useEffect(() => {
        if (hovered) {
            if (order === 0) {
                // scroll into the first item differently, so it's visible what is above (i.e. group title)
                ref.current?.scrollIntoView({ block: "end" });
            }
            else {
                ref.current?.scrollIntoView({ block: "nearest" });
            }
        }
    }, [hovered, order]);
    return (_jsx("button", { ...rest, ref: ref, value: value, onClick: handleClick, className: getDropdownMenuItemClassName(className, selected, hovered), title: rest.title ?? rest["aria-label"], children: _jsx(MenuItemContent, { textStyle: textStyle, icon: icon, shortcut: shortcut, children: children }) }));
};
DropdownMenuItem.displayName = "DropdownMenuItem";
export const DropDownMenuItemBadgeType = {
    GREEN: "green",
    RED: "red",
    BLUE: "blue",
};
export const DropDownMenuItemBadge = ({ type = DropDownMenuItemBadgeType.BLUE, children, }) => {
    const { theme } = useExcalidrawAppState();
    const style = {
        display: "inline-flex",
        marginLeft: "auto",
        padding: "2px 4px",
        borderRadius: 6,
        fontSize: 9,
        fontFamily: "Cascadia, monospace",
        border: theme === THEME.LIGHT ? "1.5px solid white" : "none",
    };
    switch (type) {
        case DropDownMenuItemBadgeType.GREEN:
            Object.assign(style, {
                backgroundColor: "var(--background-color-badge)",
                color: "var(--color-badge)",
            });
            break;
        case DropDownMenuItemBadgeType.RED:
            Object.assign(style, {
                backgroundColor: "pink",
                color: "darkred",
            });
            break;
        case DropDownMenuItemBadgeType.BLUE:
        default:
            Object.assign(style, {
                background: "var(--color-promo)",
                color: "var(--color-surface-lowest)",
            });
    }
    return (_jsx("div", { className: "DropDownMenuItemBadge", style: style, children: children }));
};
DropDownMenuItemBadge.displayName = "DropdownMenuItemBadge";
DropdownMenuItem.Badge = DropDownMenuItemBadge;
export default DropdownMenuItem;
