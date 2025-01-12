import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from "react";
import clsx from "clsx";
import * as Popover from "@radix-ui/react-popover";
import { useDevice } from "./App";
import { Island } from "./Island";
import { isInteractive } from "../utils";
export const PropertiesPopover = React.forwardRef(({ className, container, children, style, onClose, onKeyDown, onFocusOutside, onPointerLeave, onPointerDownOutside, }, ref) => {
    const device = useDevice();
    return (_jsx(Popover.Portal, { container: container, children: _jsxs(Popover.Content, { ref: ref, className: clsx("focus-visible-none", className), "data-prevent-outside-click": true, side: device.editor.isMobile && !device.viewport.isLandscape
                ? "bottom"
                : "right", align: device.editor.isMobile && !device.viewport.isLandscape
                ? "center"
                : "start", alignOffset: -16, sideOffset: 20, style: {
                zIndex: "var(--zIndex-popup)",
            }, onPointerLeave: onPointerLeave, onKeyDown: onKeyDown, onFocusOutside: onFocusOutside, onPointerDownOutside: onPointerDownOutside, onCloseAutoFocus: (e) => {
                e.stopPropagation();
                // prevents focusing the trigger
                e.preventDefault();
                // return focus to excalidraw container unless
                // user focuses an interactive element, such as a button, or
                // enters the text editor by clicking on canvas with the text tool
                if (container && !isInteractive(document.activeElement)) {
                    container.focus();
                }
                onClose();
            }, children: [_jsx(Island, { padding: 3, style: style, children: children }), _jsx(Popover.Arrow, { width: 20, height: 10, style: {
                        fill: "var(--popup-bg-color)",
                        filter: "drop-shadow(rgba(0, 0, 0, 0.05) 0px 3px 2px)",
                    } })] }) }));
});
