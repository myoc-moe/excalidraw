import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { forwardRef, useState } from "react";
import clsx from "clsx";
import "./FilledButton.scss";
import { AbortError } from "../errors";
import Spinner from "./Spinner";
import { isPromiseLike } from "../utils";
import { tablerCheckIcon } from "./icons";
export const FilledButton = forwardRef(({ children, icon, onClick, label, variant = "filled", color = "primary", size = "medium", fullWidth, className, status, }, ref) => {
    const [isLoading, setIsLoading] = useState(false);
    const _onClick = async (event) => {
        const ret = onClick?.(event);
        if (isPromiseLike(ret)) {
            // delay loading state to prevent flicker in case of quick response
            const timer = window.setTimeout(() => {
                setIsLoading(true);
            }, 50);
            try {
                await ret;
            }
            catch (error) {
                if (!(error instanceof AbortError)) {
                    throw error;
                }
                else {
                    console.warn(error);
                }
            }
            finally {
                clearTimeout(timer);
                setIsLoading(false);
            }
        }
    };
    const _status = isLoading ? "loading" : status;
    color = _status === "success" ? "success" : color;
    return (_jsx("button", { className: clsx("ExcButton", `ExcButton--color-${color}`, `ExcButton--variant-${variant}`, `ExcButton--size-${size}`, `ExcButton--status-${_status}`, { "ExcButton--fullWidth": fullWidth }, className), onClick: _onClick, type: "button", "aria-label": label, ref: ref, disabled: _status === "loading" || _status === "success", children: _jsxs("div", { className: "ExcButton__contents", children: [_status === "loading" ? (_jsx(Spinner, { className: "ExcButton__statusIcon" })) : (_status === "success" && (_jsx("div", { className: "ExcButton__statusIcon", children: tablerCheckIcon }))), icon && (_jsx("div", { className: "ExcButton__icon", "aria-hidden": true, children: icon })), variant !== "icon" && (children ?? label)] }) }));
});
