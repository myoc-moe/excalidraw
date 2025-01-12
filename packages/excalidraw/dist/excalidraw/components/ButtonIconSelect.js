import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import clsx from "clsx";
import { ButtonIcon } from "./ButtonIcon";
// TODO: It might be "clever" to add option.icon to the existing component <ButtonSelect />
export const ButtonIconSelect = (props) => (_jsx("div", { className: "buttonList", children: props.options.map((option) => props.type === "button" ? (_jsx(ButtonIcon, { icon: option.icon, title: option.text, testId: option.testId, active: option.active ?? props.value === option.value, onClick: (event) => props.onClick(option.value, event) }, option.text)) : (_jsxs("label", { className: clsx({ active: props.value === option.value }), title: option.text, children: [_jsx("input", { type: "radio", name: props.group, onChange: () => props.onChange(option.value), checked: props.value === option.value, "data-testid": option.testId }), option.icon] }, option.text))) }));
