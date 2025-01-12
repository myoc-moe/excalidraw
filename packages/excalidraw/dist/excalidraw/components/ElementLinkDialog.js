import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { TextField } from "./TextField";
import DialogActionButton from "./DialogActionButton";
import { getSelectedElements } from "../scene";
import { defaultGetElementLinkFromSelection, getLinkIdAndTypeFromSelection, } from "../element/elementLink";
import { mutateElement } from "../element/mutateElement";
import { useCallback, useEffect, useState } from "react";
import { t } from "../i18n";
import { ToolButton } from "./ToolButton";
import { TrashIcon } from "./icons";
import { KEYS } from "../keys";
import "./ElementLinkDialog.scss";
import { normalizeLink } from "../data/url";
const ElementLinkDialog = ({ sourceElementId, onClose, elementsMap, appState, generateLinkForSelection = defaultGetElementLinkFromSelection, }) => {
    const originalLink = elementsMap.get(sourceElementId)?.link ?? null;
    const [nextLink, setNextLink] = useState(originalLink);
    const [linkEdited, setLinkEdited] = useState(false);
    useEffect(() => {
        const selectedElements = getSelectedElements(elementsMap, appState);
        let nextLink = originalLink;
        if (selectedElements.length > 0 && generateLinkForSelection) {
            const idAndType = getLinkIdAndTypeFromSelection(selectedElements, appState);
            if (idAndType) {
                nextLink = normalizeLink(generateLinkForSelection(idAndType.id, idAndType.type));
            }
        }
        setNextLink(nextLink);
    }, [
        elementsMap,
        appState,
        appState.selectedElementIds,
        originalLink,
        generateLinkForSelection,
    ]);
    const handleConfirm = useCallback(() => {
        if (nextLink && nextLink !== elementsMap.get(sourceElementId)?.link) {
            const elementToLink = elementsMap.get(sourceElementId);
            elementToLink &&
                mutateElement(elementToLink, {
                    link: nextLink,
                });
        }
        if (!nextLink && linkEdited && sourceElementId) {
            const elementToLink = elementsMap.get(sourceElementId);
            elementToLink &&
                mutateElement(elementToLink, {
                    link: null,
                });
        }
        onClose?.();
    }, [sourceElementId, nextLink, elementsMap, linkEdited, onClose]);
    useEffect(() => {
        const handleKeyDown = (event) => {
            if (appState.openDialog?.name === "elementLinkSelector" &&
                event.key === KEYS.ENTER) {
                handleConfirm();
            }
            if (appState.openDialog?.name === "elementLinkSelector" &&
                event.key === KEYS.ESCAPE) {
                onClose?.();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [appState, onClose, handleConfirm]);
    return (_jsxs("div", { className: "ElementLinkDialog", children: [_jsxs("div", { className: "ElementLinkDialog__header", children: [_jsx("h2", { children: t("elementLink.title") }), _jsx("p", { children: t("elementLink.desc") })] }), _jsxs("div", { className: "ElementLinkDialog__input", children: [_jsx(TextField, { value: nextLink ?? "", onChange: (value) => {
                            if (!linkEdited) {
                                setLinkEdited(true);
                            }
                            setNextLink(value);
                        }, onKeyDown: (event) => {
                            if (event.key === KEYS.ENTER) {
                                handleConfirm();
                            }
                        }, className: "ElementLinkDialog__input-field", selectOnRender: true }), originalLink && nextLink && (_jsx(ToolButton, { type: "button", title: t("buttons.remove"), "aria-label": t("buttons.remove"), label: t("buttons.remove"), onClick: () => {
                            // removes the link from the input
                            // but doesn't update the element
                            // when confirmed, will remove the link from the element
                            setNextLink(null);
                            setLinkEdited(true);
                        }, className: "ElementLinkDialog__remove", icon: TrashIcon }))] }), _jsxs("div", { className: "ElementLinkDialog__actions", children: [_jsx(DialogActionButton, { label: t("buttons.cancel"), onClick: () => {
                            onClose?.();
                        }, style: {
                            marginRight: 10,
                        } }), _jsx(DialogActionButton, { label: t("buttons.confirm"), onClick: handleConfirm, actionType: "primary" })] })] }));
};
export default ElementLinkDialog;
