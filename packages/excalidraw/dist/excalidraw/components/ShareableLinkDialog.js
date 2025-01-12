import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useRef, useState } from "react";
import { copyTextToSystemClipboard } from "../clipboard";
import { useI18n } from "../i18n";
import { Dialog } from "./Dialog";
import { TextField } from "./TextField";
import { FilledButton } from "./FilledButton";
import { useCopyStatus } from "../hooks/useCopiedIndicator";
import { copyIcon } from "./icons";
import "./ShareableLinkDialog.scss";
export const ShareableLinkDialog = ({ link, onCloseRequest, setErrorMessage, }) => {
    const { t } = useI18n();
    const [, setJustCopied] = useState(false);
    const timerRef = useRef(0);
    const ref = useRef(null);
    const copyRoomLink = async () => {
        try {
            await copyTextToSystemClipboard(link);
        }
        catch (e) {
            setErrorMessage(t("errors.copyToSystemClipboardFailed"));
        }
        setJustCopied(true);
        if (timerRef.current) {
            window.clearTimeout(timerRef.current);
        }
        timerRef.current = window.setTimeout(() => {
            setJustCopied(false);
        }, 3000);
        ref.current?.select();
    };
    const { onCopy, copyStatus } = useCopyStatus();
    return (_jsx(Dialog, { onCloseRequest: onCloseRequest, title: false, size: "small", children: _jsxs("div", { className: "ShareableLinkDialog", children: [_jsx("h3", { children: "Shareable link" }), _jsxs("div", { className: "ShareableLinkDialog__linkRow", children: [_jsx(TextField, { ref: ref, label: "Link", readonly: true, fullWidth: true, value: link, selectOnRender: true }), _jsx(FilledButton, { size: "large", label: t("buttons.copyLink"), icon: copyIcon, status: copyStatus, onClick: () => {
                                onCopy();
                                copyRoomLink();
                            } })] }), _jsxs("div", { className: "ShareableLinkDialog__description", children: ["\uD83D\uDD12 ", t("alerts.uploadedSecurly")] })] }) }));
};
