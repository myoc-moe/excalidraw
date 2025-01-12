import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { flushSync } from "react-dom";
import { t } from "../i18n";
import { Dialog } from "./Dialog";
import "./ConfirmDialog.scss";
import DialogActionButton from "./DialogActionButton";
import { useSetAtom } from "jotai";
import { isLibraryMenuOpenAtom } from "./LibraryMenu";
import { useExcalidrawContainer, useExcalidrawSetAppState } from "./App";
import { jotaiScope } from "../jotai";
const ConfirmDialog = (props) => {
    const { onConfirm, onCancel, children, confirmText = t("buttons.confirm"), cancelText = t("buttons.cancel"), className = "", ...rest } = props;
    const setAppState = useExcalidrawSetAppState();
    const setIsLibraryMenuOpen = useSetAtom(isLibraryMenuOpenAtom, jotaiScope);
    const { container } = useExcalidrawContainer();
    return (_jsxs(Dialog, { onCloseRequest: onCancel, size: "small", ...rest, className: `confirm-dialog ${className}`, children: [children, _jsxs("div", { className: "confirm-dialog-buttons", children: [_jsx(DialogActionButton, { label: cancelText, onClick: () => {
                            setAppState({ openMenu: null });
                            setIsLibraryMenuOpen(false);
                            // flush any pending updates synchronously,
                            // otherwise it could lead to crash in some chromium versions (131.0.6778.86),
                            // when `.focus` is invoked with container in some intermediate state
                            // (container seems mounted in DOM, but focus still causes a crash)
                            flushSync(() => {
                                onCancel();
                            });
                            container?.focus();
                        } }), _jsx(DialogActionButton, { label: confirmText, onClick: () => {
                            setAppState({ openMenu: null });
                            setIsLibraryMenuOpen(false);
                            // flush any pending updates synchronously,
                            // otherwise it leads to crash in some chromium versions (131.0.6778.86),
                            // when `.focus` is invoked with container in some intermediate state
                            // (container seems mounted in DOM, but focus still causes a crash)
                            flushSync(() => {
                                onConfirm();
                            });
                            container?.focus();
                        }, actionType: "danger" })] })] }));
};
export default ConfirmDialog;
