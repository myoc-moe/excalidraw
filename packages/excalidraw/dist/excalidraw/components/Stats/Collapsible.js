import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { InlineIcon } from "../InlineIcon";
import { collapseDownIcon, collapseUpIcon } from "../icons";
const Collapsible = ({ label, open, openTrigger, children, className, }) => {
    return (_jsxs(_Fragment, { children: [_jsxs("div", { style: {
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                }, className: className, onClick: openTrigger, children: [label, _jsx(InlineIcon, { icon: open ? collapseUpIcon : collapseDownIcon })] }), open && (_jsx("div", { style: { display: "flex", flexDirection: "column" }, children: children }))] }));
};
export default Collapsible;
