import { getSelectedElements } from "../scene";
export const showSelectedShapeActions = (appState, elements) => Boolean(!appState.viewModeEnabled &&
    appState.openDialog?.name !== "elementLinkSelector" &&
    ((appState.activeTool.type !== "custom" &&
        (appState.editingTextElement ||
            (appState.activeTool.type !== "selection" &&
                appState.activeTool.type !== "eraser" &&
                appState.activeTool.type !== "hand" &&
                appState.activeTool.type !== "laser"))) ||
        getSelectedElements(elements, appState).length));
