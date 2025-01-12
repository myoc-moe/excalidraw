import { jsx as _jsx } from "react/jsx-runtime";
import { forwardRef } from "react";
import clsx from "clsx";
import "./ButtonIcon.scss";
export const ButtonIcon = forwardRef((props, ref) => {
    const { title, className, testId, active, standalone, icon, onClick } = props;
    return (_jsx("button", { type: "button", ref: ref, title: title, "data-testid": testId, className: clsx(className, { standalone, active }), onClick: onClick, children: icon }, title));
});
