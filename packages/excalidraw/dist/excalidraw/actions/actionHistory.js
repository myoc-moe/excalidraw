import { jsx as _jsx } from "react/jsx-runtime";
import { UndoIcon, RedoIcon } from "../components/icons";
import { ToolButton } from "../components/ToolButton";
import { t } from "../i18n";
import { HistoryChangedEvent } from "../history";
import { KEYS, matchKey } from "../keys";
import { arrayToMap } from "../utils";
import { isWindows } from "../constants";
import { StoreAction } from "../store";
import { useEmitter } from "../hooks/useEmitter";
const executeHistoryAction = (app, appState, updater) => {
    if (!appState.multiElement &&
        !appState.resizingElement &&
        !appState.editingTextElement &&
        !appState.newElement &&
        !appState.selectedElementsAreBeingDragged &&
        !appState.selectionElement &&
        !app.flowChartCreator.isCreatingChart) {
        const result = updater();
        if (!result) {
            return { storeAction: StoreAction.NONE };
        }
        const [nextElementsMap, nextAppState] = result;
        const nextElements = Array.from(nextElementsMap.values());
        return {
            appState: nextAppState,
            elements: nextElements,
            storeAction: StoreAction.UPDATE,
        };
    }
    return { storeAction: StoreAction.NONE };
};
export const createUndoAction = (history, store) => ({
    name: "undo",
    label: "buttons.undo",
    icon: UndoIcon,
    trackEvent: { category: "history" },
    viewMode: false,
    perform: (elements, appState, value, app) => executeHistoryAction(app, appState, () => history.undo(arrayToMap(elements), // TODO: #7348 refactor action manager to already include `SceneElementsMap`
    appState, store.snapshot)),
    keyTest: (event) => event[KEYS.CTRL_OR_CMD] && matchKey(event, KEYS.Z) && !event.shiftKey,
    PanelComponent: ({ updateData, data }) => {
        const { isUndoStackEmpty } = useEmitter(history.onHistoryChangedEmitter, new HistoryChangedEvent(history.isUndoStackEmpty, history.isRedoStackEmpty));
        return (_jsx(ToolButton, { type: "button", icon: UndoIcon, "aria-label": t("buttons.undo"), onClick: updateData, size: data?.size || "medium", disabled: isUndoStackEmpty, "data-testid": "button-undo" }));
    },
});
export const createRedoAction = (history, store) => ({
    name: "redo",
    label: "buttons.redo",
    icon: RedoIcon,
    trackEvent: { category: "history" },
    viewMode: false,
    perform: (elements, appState, _, app) => executeHistoryAction(app, appState, () => history.redo(arrayToMap(elements), // TODO: #7348 refactor action manager to already include `SceneElementsMap`
    appState, store.snapshot)),
    keyTest: (event) => (event[KEYS.CTRL_OR_CMD] && event.shiftKey && matchKey(event, KEYS.Z)) ||
        (isWindows && event.ctrlKey && !event.shiftKey && matchKey(event, KEYS.Y)),
    PanelComponent: ({ updateData, data }) => {
        const { isRedoStackEmpty } = useEmitter(history.onHistoryChangedEmitter, new HistoryChangedEvent(history.isUndoStackEmpty, history.isRedoStackEmpty));
        return (_jsx(ToolButton, { type: "button", icon: RedoIcon, "aria-label": t("buttons.redo"), onClick: updateData, size: data?.size || "medium", disabled: isRedoStackEmpty, "data-testid": "button-redo" }));
    },
});
