import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import clsx from "clsx";
import React from "react";
import { searchIcon } from "./icons";
import "./QuickSearch.scss";
export const QuickSearch = React.forwardRef(({ className, placeholder, onChange }, ref) => {
    return (_jsxs("div", { className: clsx("QuickSearch__wrapper", className), children: [searchIcon, _jsx("input", { ref: ref, className: "QuickSearch__input", type: "text", placeholder: placeholder, onChange: (e) => onChange(e.target.value.trim().toLowerCase()) })] }));
});
