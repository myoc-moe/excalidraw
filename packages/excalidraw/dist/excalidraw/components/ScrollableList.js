import { jsx as _jsx } from "react/jsx-runtime";
import clsx from "clsx";
import { Children } from "react";
import "./ScrollableList.scss";
export const ScrollableList = ({ className, placeholder, children, }) => {
    const isEmpty = !Children.count(children);
    return (_jsx("div", { className: clsx("ScrollableList__wrapper", className), role: "menu", children: isEmpty ? _jsx("div", { className: "empty", children: placeholder }) : children }));
};
